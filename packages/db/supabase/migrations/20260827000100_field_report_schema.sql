-- 現地報告（通行可否）の基盤テーブル。
-- 設計の根拠は docs/er/00-conventions.md と docs/er/04-field-report.md に置く。
--
-- BE-11 の範囲は「通行可否（report_type = 'road'）の登録と一覧取得」のみ。
-- observed_area_id / reporter_area_id（地区。BE-10）、road_segment_id、
-- 写真（BE-13）、確認投票は後続タスクで別マイグレーションとして足す。
-- report_type / hazard_type の列は docs/er/00-conventions.md の ENUM 一覧を
-- そのまま再利用するために先に用意するが、この API では 'road' しか作らない。

-- ----------------------------------------------------------------------------
-- ENUM
-- ----------------------------------------------------------------------------

-- 投稿の種別（docs/er/00-conventions.md#投稿と地図）。BE-11 では 'road' のみ使う
create type public.field_report_type as enum (
  'road',
  'hazard',
  'shop',
  'other'
);

-- 通行可否の状態（C3）
create type public.road_condition as enum (
  'passable',
  'caution',
  'impassable'
);

-- 危険箇所の原因（C4）。report_type = 'hazard' のときだけ使う。BE-11 では未使用
create type public.hazard_type as enum (
  'flood',
  'inland_flood',
  'landslide',
  'storm_surge',
  'tsunami',
  'earthquake',
  'fire'
);

-- ----------------------------------------------------------------------------
-- field_reports（現地報告）
-- ----------------------------------------------------------------------------
create table public.field_reports (
  id uuid primary key default gen_random_uuid(),
  -- 退会は論理削除にするため物理削除は起きない（docs/er/00-conventions.md#外部キーの削除規則）
  user_id uuid not null references public.users (id) on delete restrict,
  report_type public.field_report_type not null default 'road',
  -- report_type = 'road' のとき NOT NULL
  road_condition public.road_condition,
  -- report_type = 'hazard' のとき NOT NULL。BE-11 では常に NULL
  hazard_type public.hazard_type,
  -- 投稿位置。4 分の 1 地域メッシュ（250m）が既定（S1）。
  -- 生の座標は保存しない。GPS からの変換はクライアント側の丸めに一時的に頼る
  -- （BE-12 でサーバ側変換に置き換える。docs/er/00-conventions.md#位置情報の扱い）
  mesh_code char(10) not null,
  mesh_level public.mesh_level not null default 'mesh_250m',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 投稿者による取り消し用。BE-11 では更新する経路がまだ無い
  deleted_at timestamptz,
  constraint field_reports_mesh_code_format check (mesh_code ~ '^[0-9]{10}$'),
  constraint field_reports_type_check
    check (
      (report_type = 'road' and road_condition is not null and hazard_type is null)
      or (report_type = 'hazard' and hazard_type is not null and road_condition is null)
      or (report_type in ('shop', 'other'))
    )
);

comment on table public.field_reports is
  '住民が地図に上げる現地の情報（BE-11 は通行可否のみ）。docs/er/04-field-report.md';
comment on column public.field_reports.mesh_code is
  'GPS からの変換は現状クライアント任せ。サーバ側変換は BE-12 で行う';

create index field_reports_user_id_idx on public.field_reports (user_id);
create index field_reports_mesh_code_idx
  on public.field_reports (mesh_code bpchar_pattern_ops);
create index field_reports_created_at_idx
  on public.field_reports (created_at desc)
  where deleted_at is null;

create trigger field_reports_set_updated_at
  before update on public.field_reports
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 権限
-- ----------------------------------------------------------------------------
grant select on public.field_reports to anon, authenticated;
grant insert on public.field_reports to authenticated;
grant all on public.field_reports to service_role;
