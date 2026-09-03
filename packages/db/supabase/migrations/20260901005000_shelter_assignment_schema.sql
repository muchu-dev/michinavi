-- 避難先の分散（BE-21、機能 B3）。
-- 設計の根拠は docs/er/02-shelter.md と docs/er/03-evacuation.md に置く。
--
-- 避難所ごとの想定人数を集計し、定員を超えたら別の候補を割り当てる。
-- 「想定人数」は、この世帯はここへ行くつもりだという申告（shelter_assignments）の
-- 合計であって、実際の滞在者数ではない。実際の人数は避難所側のアカウントが
-- 要る（D3）ため、まだ扱わない。

-- ----------------------------------------------------------------------------
-- shelter_assignments（世帯ごとの避難先）
-- ----------------------------------------------------------------------------
create table public.shelter_assignments (
  -- 1 世帯 1 行。行き先を変えたら上書きする
  household_id uuid primary key references public.households (id) on delete cascade,
  -- 過去の割り当てから参照されるため、避難所は削除させない
  shelter_id uuid not null references public.shelters (id) on delete restrict,
  -- その世帯が連れて行く人数。構成員の数から決まる
  party_size smallint not null,
  -- 定員を超えた状態で割り当てたか。候補が 1 つも残らないより、
  -- 超過を明示して出すほうが安全である
  is_over_capacity boolean not null default false,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shelter_assignments_party_size_positive check (party_size > 0)
);

comment on table public.shelter_assignments is
  '世帯ごとの避難先の申告（B3）。避難所の想定人数はこの合計で出す';
comment on column public.shelter_assignments.party_size is
  '実際の滞在者数ではなく、その世帯の構成員の数から決まる想定人数';

create index shelter_assignments_shelter_id_idx
  on public.shelter_assignments (shelter_id);

create trigger shelter_assignments_set_updated_at
  before update on public.shelter_assignments
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 避難所ごとの想定人数
-- ----------------------------------------------------------------------------

-- 集計だけを返す。どの世帯が行くかは返さない。
-- 生の shelter_assignments を読める人を増やすと、他人の避難先が分かってしまう。
-- security definer にして、集計の形でだけ外に出す
create or replace function public.shelter_loads(p_shelter_ids uuid[])
returns table (
  shelter_id uuid,
  expected_people integer,
  household_count integer,
  capacity integer,
  -- 定員が不明な避難所では NULL。0 で割らない
  occupancy_rate numeric
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    s.id,
    coalesce(sum(a.party_size), 0)::integer as expected_people,
    count(a.household_id)::integer as household_count,
    s.capacity,
    case
      when s.capacity is null or s.capacity = 0 then null
      else round(coalesce(sum(a.party_size), 0)::numeric / s.capacity, 3)
    end as occupancy_rate
  from public.shelters s
  left join public.shelter_assignments a on a.shelter_id = s.id
  where s.id = any (p_shelter_ids)
  group by s.id, s.capacity;
$$;

comment on function public.shelter_loads(uuid[]) is
  '避難所ごとの想定人数（B3）。どの世帯が行くかは返さず集計だけを出す';

revoke all on function public.shelter_loads(uuid[]) from public;
grant execute on function public.shelter_loads(uuid[]) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 避難先の割り当て
-- ----------------------------------------------------------------------------

-- 現在地から近い候補を順に見て、想定人数が定員に収まる最初の避難所を割り当てる。
-- 収まる候補が 1 つも無ければ、最も混雑率の低い避難所を超過ありとして割り当てる。
-- 候補が 0 件になるより、超過を明示して出すほうが安全である。
--
-- 対象の世帯は auth.uid() から解決し、入力の household_id は使わない。
create or replace function public.assign_shelter(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_m double precision default 5000,
  p_candidate_limit integer default 10
)
returns table (
  shelter_id uuid,
  party_size smallint,
  is_over_capacity boolean,
  distance_m double precision,
  expected_people integer
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid;
  v_household_id uuid;
  v_party_size smallint;
  v_shelter_id uuid;
  v_is_over boolean := false;
  v_distance double precision;
  v_expected integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception '避難先の割り当てには認証が必要です'
      using errcode = '28000';
  end if;

  select m.household_id into v_household_id
  from public.household_members m
  where m.user_id = v_user_id
    and m.is_primary;

  if v_household_id is null then
    raise exception '世帯が見つかりません'
      using errcode = 'P0002';
  end if;

  select count(*)::smallint into v_party_size
  from public.household_members m
  where m.household_id = v_household_id;

  -- 候補と、その時点の想定人数を 1 つの問い合わせで決める。
  -- 自分の世帯の既存の割り当ては数え直しの対象から外す。
  --
  -- 並べ方は 2 段になる。
  --   1. 定員に収まる候補（capacity が NULL の避難所は「上限不明」として収まる側）を
  --      近い順に見る
  --   2. どこにも収まらなければ、最も混雑率の低い避難所を選ぶ。
  --      候補が 1 つも残らないより、超過を明示して出すほうが安全である
  with candidates as (
    select
      n.id as shelter_id,
      n.distance_m,
      n.capacity,
      coalesce(
        (
          select sum(a.party_size)
          from public.shelter_assignments a
          where a.shelter_id = n.id
            and a.household_id <> v_household_id
        ),
        0
      )::integer as expected_people
    from public.nearby_shelters(p_latitude, p_longitude, p_radius_m, p_candidate_limit) n
  ),
  ranked as (
    select
      c.*,
      (c.capacity is null or c.expected_people + v_party_size <= c.capacity) as fits
    from candidates c
  )
  select r.shelter_id, r.distance_m, r.expected_people, not r.fits
  into v_shelter_id, v_distance, v_expected, v_is_over
  from ranked r
  order by
    r.fits desc,
    case when r.fits then r.distance_m end asc,
    case
      when not r.fits
      then (r.expected_people + v_party_size)::numeric / nullif(r.capacity, 0)
    end asc,
    r.distance_m asc
  limit 1;

  if v_shelter_id is null then
    raise exception '周辺に避難所が見つかりません'
      using errcode = 'P0002';
  end if;

  insert into public.shelter_assignments (
    household_id, shelter_id, party_size, is_over_capacity
  )
  values (v_household_id, v_shelter_id, v_party_size, v_is_over)
  on conflict (household_id) do update
  set shelter_id = excluded.shelter_id,
      party_size = excluded.party_size,
      is_over_capacity = excluded.is_over_capacity,
      assigned_at = now();

  return query select v_shelter_id, v_party_size, v_is_over, v_distance, v_expected;
end;
$$;

comment on function public.assign_shelter(double precision, double precision, double precision, integer) is
  '世帯の避難先を割り当てる（B3）。定員に収まる最寄りを選び、収まらなければ最も空いている避難所を超過ありで返す';

revoke all on function public.assign_shelter(double precision, double precision, double precision, integer) from public;
grant execute on function public.assign_shelter(double precision, double precision, double precision, integer)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 権限
-- ----------------------------------------------------------------------------
grant select on public.shelter_assignments to authenticated;
grant all on public.shelter_assignments to service_role;

notify pgrst, 'reload schema';
