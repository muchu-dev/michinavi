-- 避難所（BE-14、機能 D1 / D2）。
-- 設計の根拠は docs/er/02-shelter.md に置く。
--
-- このドメインだけは投入時にすべて確定する静的データで、住民は書き換えない。
-- 災害種別ごとの対応可否と受入条件を避難所本体のカラムに持たせないのは、
-- 洪水には使えるが土砂災害には使えない避難所があり、受入条件は運営が
-- 後から増やしたいためである。
--
-- 受入条件を真偽値にせず 4 値にするのは、自治体の公開データに
-- 「ペット可（ケージ持参）」のような条件付きが多く、可否の 2 値では
-- 現実を写せないためである。

-- ----------------------------------------------------------------------------
-- ENUM
-- ----------------------------------------------------------------------------
create type public.shelter_category as enum (
  'emergency_site',
  'designated_shelter',
  'welfare_shelter',
  'temporary',
  'other'
);

create type public.acceptance_status as enum (
  'available',
  'limited',
  'unavailable',
  'unknown'
);

-- ----------------------------------------------------------------------------
-- shelters（避難所）
-- ----------------------------------------------------------------------------
create table public.shelters (
  id uuid primary key default gen_random_uuid(),
  -- 出典データの施設コード。再取り込みの突合キー
  external_code text not null unique,
  name text not null,
  name_kana text,
  -- 公開情報なので丸めない（docs/er/00-conventions.md#位置情報の扱い）
  address text not null,
  area_id uuid not null references public.areas (id),
  -- 最寄り検索に使う。ここも公開情報なので丸めない
  location extensions.geography(Point, 4326) not null,
  -- 不明なら NULL。0 で埋めると混雑率が無限大になり候補から永久に外れる
  capacity integer,
  category public.shelter_category not null default 'designated_shelter',
  elevation_m numeric(6, 1),
  -- 垂直避難の可否の材料
  floors smallint,
  operator text,
  phone text,
  -- 出典と、その版の日付。どこから来たデータかを必ず持つ
  source text not null,
  source_updated_at timestamptz,
  -- 廃止された施設は行を残して false にする。過去の避難記録が壊れるため削除しない
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shelters_name_length check (char_length(name) between 1 and 100),
  constraint shelters_capacity_positive check (capacity is null or capacity > 0),
  constraint shelters_floors_positive check (floors is null or floors > 0)
);

comment on table public.shelters is
  '指定緊急避難場所・指定避難所（D1）。出典データを external_code で突合して再取り込みする';
comment on column public.shelters.capacity is
  '不明なら NULL。0 で埋めない（混雑率が無限大になり候補から外れるため）';

create index shelters_location_gist on public.shelters using gist (location);
create index shelters_area_id_is_active_idx on public.shelters (area_id, is_active);

create trigger shelters_set_updated_at
  before update on public.shelters
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- shelter_hazard_supports（対応災害）
-- ----------------------------------------------------------------------------
create table public.shelter_hazard_supports (
  shelter_id uuid not null references public.shelters (id) on delete cascade,
  hazard_type public.hazard_type not null,
  -- 「対応していないと明記されている」と「データに記載がない」を区別する。
  -- 行が無い場合は不明として扱う
  is_supported boolean not null,
  note text,
  primary key (shelter_id, hazard_type)
);

comment on table public.shelter_hazard_supports is
  '避難所ごとの災害種別への対応可否（D1）。行が無い種別は不明として扱う';

-- ----------------------------------------------------------------------------
-- acceptance_conditions / shelter_acceptances（受入条件）
-- ----------------------------------------------------------------------------
create table public.acceptance_conditions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  display_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.acceptance_conditions is
  '受入条件のマスタ（D2）。運営が画面から増やせるよう ENUM ではなくテーブルにする';

-- docs/er/02-shelter.md の初期値。「参照元」列が世帯の登録内容との対応になる
insert into public.acceptance_conditions (key, label, display_order) values
  ('pet', 'ペット同行', 1),
  ('wheelchair', '車いすで入れる', 2),
  ('barrier_free_toilet', '多目的トイレ', 3),
  ('infant', '乳幼児の受入', 4),
  ('nursing_room', '授乳スペース', 5),
  ('medical_care', '医療的ケアに対応', 6),
  ('power_supply', '電源が使える', 7),
  ('allergy_food', 'アレルギー対応食', 8),
  ('welfare', '福祉避難所として受入', 9)
on conflict (key) do nothing;

create table public.shelter_acceptances (
  shelter_id uuid not null references public.shelters (id) on delete cascade,
  condition_id uuid not null references public.acceptance_conditions (id),
  status public.acceptance_status not null default 'unknown',
  -- 条件の但し書き。「ケージ持参」など
  note text,
  -- 自治体データで裏が取れた日付。古い確認日は画面で添えて出す
  confirmed_at timestamptz,
  primary key (shelter_id, condition_id)
);

comment on table public.shelter_acceptances is
  '避難所ごとの受入条件（D2）。unknown を既定に置き、確認できていないことを画面でそのまま出す';

-- 「ペット可の避難所」の逆引き
create index shelter_acceptances_condition_id_idx
  on public.shelter_acceptances (condition_id);

-- ----------------------------------------------------------------------------
-- 取り込み
-- ----------------------------------------------------------------------------

-- 出典データを external_code で突合して UPSERT する。
-- 行を消して入れ直さないのは、避難の記録から shelter_id を参照するためで、
-- 削除すると過去の記録が壊れる（docs/er/02-shelter.md#取り込み運用）。
-- 廃止された施設は is_active = false にする。
--
-- service role からのみ呼ぶ。住民は避難所データを書き換えない
create or replace function public.import_shelters(p_shelters jsonb)
-- 戻り値の名前を external_code にすると、plpgsql が
-- on conflict (external_code) の列名と OUT パラメータのどちらか判別できず
-- 42702（ambiguous）になる。列名と重ならない名前にする
returns table (imported_code text, is_created boolean)
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
  v_shelter jsonb;
  v_shelter_id uuid;
  v_is_created boolean;
  v_condition jsonb;
begin
  for v_shelter in select * from jsonb_array_elements(coalesce(p_shelters, '[]'::jsonb))
  loop
    select s.id into v_shelter_id
    from public.shelters s
    where s.external_code = v_shelter ->> 'externalCode';

    v_is_created := v_shelter_id is null;

    insert into public.shelters (
      external_code, name, name_kana, address, area_id, location,
      capacity, category, elevation_m, floors, operator, phone,
      source, source_updated_at, is_active
    )
    values (
      v_shelter ->> 'externalCode',
      v_shelter ->> 'name',
      v_shelter ->> 'nameKana',
      v_shelter ->> 'address',
      (v_shelter ->> 'areaId')::uuid,
      st_setsrid(
        st_makepoint(
          (v_shelter ->> 'longitude')::double precision,
          (v_shelter ->> 'latitude')::double precision
        ),
        4326
      )::geography,
      (v_shelter ->> 'capacity')::integer,
      coalesce((v_shelter ->> 'category')::public.shelter_category, 'designated_shelter'),
      (v_shelter ->> 'elevationM')::numeric,
      (v_shelter ->> 'floors')::smallint,
      v_shelter ->> 'operator',
      v_shelter ->> 'phone',
      v_shelter ->> 'source',
      (v_shelter ->> 'sourceUpdatedAt')::timestamptz,
      coalesce((v_shelter ->> 'isActive')::boolean, true)
    )
    on conflict (external_code) do update
    set name = excluded.name,
        name_kana = excluded.name_kana,
        address = excluded.address,
        area_id = excluded.area_id,
        location = excluded.location,
        capacity = excluded.capacity,
        category = excluded.category,
        elevation_m = excluded.elevation_m,
        floors = excluded.floors,
        operator = excluded.operator,
        phone = excluded.phone,
        source = excluded.source,
        source_updated_at = excluded.source_updated_at,
        is_active = excluded.is_active
    returning id into v_shelter_id;

    -- 受入条件は入力にあるものだけを入れ替える。
    -- 記載の無い条件を unavailable で埋めない（unknown のままにする）
    for v_condition in
      select * from jsonb_array_elements(coalesce(v_shelter -> 'acceptances', '[]'::jsonb))
    loop
      insert into public.shelter_acceptances (shelter_id, condition_id, status, note, confirmed_at)
      select
        v_shelter_id,
        c.id,
        (v_condition ->> 'status')::public.acceptance_status,
        v_condition ->> 'note',
        (v_condition ->> 'confirmedAt')::timestamptz
      from public.acceptance_conditions c
      where c.key = (v_condition ->> 'key')
      on conflict (shelter_id, condition_id) do update
      set status = excluded.status,
          note = excluded.note,
          confirmed_at = excluded.confirmed_at;
    end loop;

    -- 対応災害も同じく、入力にあるものだけを入れ替える
    for v_condition in
      select * from jsonb_array_elements(coalesce(v_shelter -> 'hazardSupports', '[]'::jsonb))
    loop
      insert into public.shelter_hazard_supports (shelter_id, hazard_type, is_supported, note)
      values (
        v_shelter_id,
        (v_condition ->> 'hazardType')::public.hazard_type,
        (v_condition ->> 'isSupported')::boolean,
        v_condition ->> 'note'
      )
      on conflict (shelter_id, hazard_type) do update
      set is_supported = excluded.is_supported,
          note = excluded.note;
    end loop;

    return query select (v_shelter ->> 'externalCode')::text, v_is_created;
  end loop;
end;
$$;

comment on function public.import_shelters(jsonb) is
  '出典データの取り込み（BE-14）。external_code で突合して UPSERT する。service role から呼ぶ';

revoke all on function public.import_shelters(jsonb) from public;
grant execute on function public.import_shelters(jsonb) to service_role;

-- ----------------------------------------------------------------------------
-- 周辺の避難所を返す
-- ----------------------------------------------------------------------------

-- 現在地から近い順に返す（D1）。距離は地球楕円体上のメートルで返す。
-- 座標を丸めないのは、避難所と地区の境界が公開情報だからである
-- （投稿位置の丸めとは扱いが違う。docs/er/00-conventions.md#位置情報の扱い）
create or replace function public.nearby_shelters(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_m double precision default 5000,
  p_limit integer default 10
)
returns table (
  id uuid,
  external_code text,
  name text,
  address text,
  area_id uuid,
  category public.shelter_category,
  capacity integer,
  floors smallint,
  elevation_m numeric,
  latitude double precision,
  longitude double precision,
  distance_m double precision
)
language sql
stable
security invoker
set search_path = public, extensions, pg_temp
as $$
  select
    s.id,
    s.external_code,
    s.name,
    s.address,
    s.area_id,
    s.category,
    s.capacity,
    s.floors,
    s.elevation_m,
    st_y(s.location::geometry) as latitude,
    st_x(s.location::geometry) as longitude,
    st_distance(
      s.location,
      st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography
    ) as distance_m
  from public.shelters s
  where s.is_active
    and st_dwithin(
      s.location,
      st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography,
      p_radius_m
    )
  order by distance_m
  limit greatest(p_limit, 1);
$$;

comment on function public.nearby_shelters(double precision, double precision, double precision, integer) is
  '現在地から半径内の避難所を近い順に返す（D1）';

grant execute on function public.nearby_shelters(double precision, double precision, double precision, integer)
  to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 権限
-- ----------------------------------------------------------------------------
grant select on
  public.shelters,
  public.shelter_hazard_supports,
  public.acceptance_conditions,
  public.shelter_acceptances
  to anon, authenticated;
grant all on
  public.shelters,
  public.shelter_hazard_supports,
  public.acceptance_conditions,
  public.shelter_acceptances
  to service_role;

notify pgrst, 'reload schema';
