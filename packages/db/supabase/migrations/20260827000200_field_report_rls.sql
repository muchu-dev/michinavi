-- field_reports の RLS。
-- 方針は docs/er/07-safety-moderation.md#行レベルセキュリティの方針 に置く。
--
-- BE-11 の範囲では status / hidden の概念が無いため、
-- 論理削除されていない行を全員に見せる、投稿は本人のみ、という最小の形にする。

alter table public.field_reports enable row level security;

create policy field_reports_select_visible
  on public.field_reports
  for select
  to anon, authenticated
  using (deleted_at is null);

-- 投稿できるのは自分の user_id を持つ行だけ。
-- 入力の user_id は使わず JWT の auth.uid() で決める（docs/er/00-conventions.md#db-クライアントの使い分け）
create policy field_reports_insert_self
  on public.field_reports
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- UPDATE / DELETE のポリシーは作らない。編集・取り消しは後続タスクで扱う
