-- road_status_estimates の RLS。
-- 方針は docs/er/07-safety-moderation.md#行レベルセキュリティの方針 に置く。

alter table public.road_status_estimates enable row level security;

-- マスタに近い公開データなので全員が読める（areas と同じ扱い）
create policy road_status_estimates_select_all
  on public.road_status_estimates
  for select
  to anon, authenticated
  using (true);

-- INSERT / UPDATE のポリシーは作らない。
-- ここに直接書き込めるユーザー向けのポリシーを用意すると、
-- 投稿もせず Gemini の検証も経ずに、任意の mesh_code の推定を
-- 書き換えられてしまう。書き込みは service role 経由（BE-16 の
-- refreshRoadStatusEstimate）だけに限定する
