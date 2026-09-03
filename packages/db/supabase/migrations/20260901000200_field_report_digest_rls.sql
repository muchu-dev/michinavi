-- field_report_digests の RLS。
-- 方針は docs/er/07-safety-moderation.md#行レベルセキュリティの方針 に置く。

alter table public.field_report_digests enable row level security;

-- 地図のカードは未ログインでも見えてよい。
-- 元になる field_reports 自体が全員に見える設計なので、
-- 集計結果を伏せても何も守れない
create policy field_report_digests_select_all
  on public.field_report_digests
  for select
  to anon, authenticated
  using (true);

-- INSERT / UPDATE のポリシーは作らない。
-- ここへ直接書ける経路を開くと、投稿もせずに任意の地点の
-- 「◯件の報告があります」という表示を捏造できてしまう。
-- 書き込みは service role 経由（BE-18 の refreshFieldReportDigest）だけに限定する
