-- アカウントと世帯の基盤テーブル。
-- 設計の根拠は docs/er/00-conventions.md と docs/er/01-account-household.md に置く。

-- ----------------------------------------------------------------------------
-- 拡張
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;

-- ----------------------------------------------------------------------------
-- ENUM
-- ----------------------------------------------------------------------------

-- メッシュの丸め次数（S1）。桁数と対応する
create type public.mesh_level as enum (
  'mesh_1km',
  'mesh_500m',
  'mesh_250m',
  'mesh_125m'
);

-- 本人確認の段階（S3）。投稿レート制限の強さを決める
create type public.verification_level as enum (
  'anonymous',
  'email',
  'phone'
);

-- 安否を誰に見せるか（E5）
create type public.status_share_scope as enum (
  'household',
  'family',
  'none'
);

-- 年齢層。生年月日は持たない
create type public.age_group as enum (
  'infant',
  'child',
  'adult',
  'senior'
);

-- ----------------------------------------------------------------------------
-- 共通処理
-- ----------------------------------------------------------------------------

-- updated_at を現在時刻で埋めるトリガ関数。
-- 呼び出し側が updated_at を渡してきても無視する
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  '更新時刻を now() で上書きするトリガ関数（docs/er/00-conventions.md#共通カラム）';

-- ----------------------------------------------------------------------------
-- areas（地区）
-- ----------------------------------------------------------------------------
create table public.areas (
  id uuid primary key default gen_random_uuid(),
  -- 全国地方公共団体コード + 町字 ID
  code text not null unique,
  name text not null,
  -- 最上位（都道府県）は NULL
  parent_area_id uuid references public.areas (id),
  -- 1 = 都道府県、2 = 市区町村、3 = 町字
  level smallint not null,
  city text not null,
  prefecture text not null,
  -- 住所と投稿位置からの地区判定に使う
  boundary extensions.geometry(MultiPolygon, 4326),
  -- 地図の初期表示位置
  centroid extensions.geography(Point, 4326),
  created_at timestamptz not null default now(),
  constraint areas_level_range check (level between 1 and 3)
);

comment on table public.areas is '地区マスタ。町字を既定の粒度とし parent_area_id で市区町村を親に持つ';
comment on column public.areas.city is '表示用に非正規化して持つ（親を辿らない）';

create index areas_parent_area_id_idx on public.areas (parent_area_id);
create index areas_boundary_gist on public.areas using gist (boundary);

-- ----------------------------------------------------------------------------
-- users（ユーザ）
-- ----------------------------------------------------------------------------
create table public.users (
  -- auth.users.id と同値。認証側の削除に追随する
  id uuid primary key references auth.users (id) on delete cascade,
  -- 実名は求めない
  display_name text not null,
  area_id uuid references public.areas (id),
  -- 自宅の 250m メッシュ（S1）
  home_mesh_code char(10),
  home_mesh_level public.mesh_level not null default 'mesh_250m',
  verification_level public.verification_level not null default 'anonymous',
  status_share_scope public.status_share_scope not null default 'household',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 退会後も投稿の表示を保つため論理削除にする
  deleted_at timestamptz,
  constraint users_display_name_length check (char_length(display_name) between 1 and 50),
  constraint users_home_mesh_code_format check (home_mesh_code ~ '^[0-9]{10}$')
);

comment on table public.users is 'auth.users と 1 対 1 で対応するアプリ側のユーザ。本人しか SELECT できない';

create index users_area_id_idx on public.users (area_id);
create index users_home_mesh_code_idx on public.users (home_mesh_code bpchar_pattern_ops);

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- households（世帯）
-- ----------------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  -- 「山田家」など。既定値は作成者の表示名
  name text not null,
  -- 世帯の管理者。招待と削除ができる
  owner_user_id uuid not null references public.users (id) on delete cascade,
  area_id uuid not null references public.areas (id),
  -- 避難ルートの出発点（A5、C3）
  home_mesh_code char(10) not null,
  home_mesh_level public.mesh_level not null default 'mesh_250m',
  car_count smallint not null default 0,
  -- 「車あり・0 台」を作れないよう生成列にする
  has_car boolean generated always as (car_count > 0) stored,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint households_name_length check (char_length(name) between 1 and 50),
  constraint households_home_mesh_code_format check (home_mesh_code ~ '^[0-9]{10}$'),
  constraint households_car_count_non_negative check (car_count >= 0)
);

comment on table public.households is '家族構成の受け皿。複数のアカウントが同じ家族構成を共有する単位';
comment on column public.households.has_car is 'car_count > 0 の生成列。移動手段の切り分け（B4）が見る';

create index households_owner_user_id_idx on public.households (owner_user_id);
create index households_area_id_idx on public.households (area_id);

create trigger households_set_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- household_members（世帯構成員）
-- ----------------------------------------------------------------------------
create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- アカウントを持つ場合のみ。ユーザが消えても構成員の枠は残す
  user_id uuid references public.users (id) on delete set null,
  -- 本人が決める表示名、または登録者が付ける続柄（「母」「長男」）
  display_name text not null,
  age_group public.age_group not null,
  -- 徒歩避難の可否判定に効く
  needs_assistance boolean not null default false,
  -- このユーザの既定の世帯か
  is_primary boolean not null default false,
  -- 代理登録した安否の共有範囲（E5）。アカウントを持たない構成員にだけ意味がある
  proxy_share_scope public.status_share_scope,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint household_members_display_name_length
    check (char_length(display_name) between 1 and 50),
  -- 既定の世帯という概念はアカウントを持つ人にしか無い
  constraint household_members_primary_requires_user
    check (not is_primary or user_id is not null),
  constraint household_members_proxy_scope_requires_no_user
    check (user_id is null or proxy_share_scope is null),
  -- 同じ世帯に同じユーザが二重に入らない。
  -- user_id が NULL の行は互いに重複と見なされないため、
  -- アカウントを持たない構成員は同じ世帯に何行あってもよい。
  -- 部分インデックスにしないのは、households からの複合外部キーの参照先になるため
  constraint household_members_user_uniq unique (household_id, user_id)
);

comment on table public.household_members is
  'アカウントを持たない家族も 1 人 1 行で登録する。人数と年齢層の内訳が D2 と B1 の入力になる';

create index household_members_household_id_idx on public.household_members (household_id);
create index household_members_user_id_idx on public.household_members (user_id);

-- 既定の世帯はユーザごとに 1 つまで
create unique index household_members_primary_uniq
  on public.household_members (user_id)
  where is_primary and user_id is not null;

create trigger household_members_set_updated_at
  before update on public.household_members
  for each row execute function public.set_updated_at();

-- 世帯の管理者がその世帯の構成員であることを保証する。
-- 世帯と最初の構成員は同じトランザクションで INSERT するため遅延可能にする。
-- owner_user_id は NOT NULL なので、アカウントを持たない構成員は管理者になれない
alter table public.households
  add constraint households_owner_is_member
  foreign key (id, owner_user_id)
  references public.household_members (household_id, user_id)
  deferrable initially deferred;

-- ----------------------------------------------------------------------------
-- 権限
-- ----------------------------------------------------------------------------
-- config.toml の auto_expose_new_tables を有効にしていないため、
-- Data API のロールには明示的に GRANT する。行の絞り込みは RLS が行う
grant select on public.areas to anon, authenticated;
grant select, insert, update on public.users to authenticated;
grant select, insert, update, delete on public.households to authenticated;
grant select, insert, update, delete on public.household_members to authenticated;
grant all on public.areas, public.users, public.households, public.household_members
  to service_role;
