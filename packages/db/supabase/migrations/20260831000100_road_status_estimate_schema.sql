-- mesh_code ごとの道路状態の AI 推定（BE-16）。
-- 設計の根拠は docs/tasks/all-tasks.md の BE-16 と、
-- docs/er/07-safety-moderation.md のプロンプトインジェクション対策の層に置く。
--
-- 投稿（field_reports の INSERT）のたびに該当する mesh_code だけを
-- 再計算してここへ保存する。閲覧側はこのテーブルを読むだけで完結させ、
-- 一覧の表示・更新のたびに Gemini を呼ばない。

-- AI 推定の確信度。多数決にフォールバックした場合は 'low' になる
create type public.ai_confidence as enum (
  'high',
  'medium',
  'low'
);

create table public.road_status_estimates (
  -- 1 mesh_code につき 1 行。投稿のたびに同じ行を上書きする
  mesh_code char(10) primary key,
  -- 通れる／注意／通れない（既存の road_condition を再利用）
  road_condition public.road_condition not null,
  confidence public.ai_confidence not null,
  -- 推定の根拠になった有効な投稿の件数
  report_count smallint not null,
  -- 表示用の一言。AI の出力、またはフォールバック時の固定文言
  reasoning text not null,
  updated_at timestamptz not null default now(),
  constraint road_status_estimates_mesh_code_format
    check (mesh_code ~ '^[0-9]{10}$'),
  constraint road_status_estimates_report_count_positive
    check (report_count > 0)
);

comment on table public.road_status_estimates is
  'mesh_code ごとの道路状態の AI 推定（BE-16）。field_reports の投稿時にのみ再計算する';
comment on column public.road_status_estimates.confidence is
  'AI の推定に成功すれば high/medium/low、失敗して多数決にフォールバックした場合は low';

-- ----------------------------------------------------------------------------
-- 権限
-- ----------------------------------------------------------------------------
-- 書き込みは service role だけ（ポリシーを作らない。docs/er/00-conventions.md#db-クライアントの使い分け）
grant select on public.road_status_estimates to anon, authenticated;
grant all on public.road_status_estimates to service_role;
