-- 通報と措置の RLS。
-- 方針は docs/er/07-safety-moderation.md#行レベルセキュリティの方針 に置く。

-- ----------------------------------------------------------------------------
-- content_flags
-- ----------------------------------------------------------------------------
alter table public.content_flags enable row level security;

-- 通報者本人と運営だけが読む。
-- 通報を全員に見せると、誰が誰を通報したかが割れて報復の材料になる
create policy content_flags_select_reporter_or_moderator
  on public.content_flags
  for select
  to authenticated
  using (reporter_user_id = (select auth.uid()) or public.is_moderator());

-- 通報できるのは自分の名前でだけ。入力の user_id は使わない
create policy content_flags_insert_self
  on public.content_flags
  for insert
  to authenticated
  with check (reporter_user_id = (select auth.uid()));

-- 通報の処理状態を進められるのは運営だけ
create policy content_flags_update_moderator
  on public.content_flags
  for update
  to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

-- DELETE のポリシーは作らない。通報の取り下げは status で表す

-- ----------------------------------------------------------------------------
-- moderation_actions
-- ----------------------------------------------------------------------------
alter table public.moderation_actions enable row level security;

create policy moderation_actions_select_moderator
  on public.moderation_actions
  for select
  to authenticated
  using (public.is_moderator());

-- 措置を記録できるのは運営だけ。かつ自分の名前でだけ記録できる。
-- moderator_user_id を入力任せにすると、他の運営者の名前で措置を残せてしまう
create policy moderation_actions_insert_moderator
  on public.moderation_actions
  for insert
  to authenticated
  with check (
    public.is_moderator()
    and moderator_user_id = (select auth.uid())
  );

-- UPDATE / DELETE のポリシーは作らない。措置の記録は追記のみで、後から書き換えない

-- ----------------------------------------------------------------------------
-- field_reports の可視範囲を、状態を見るように差し替える
-- ----------------------------------------------------------------------------

-- BE-11 では「論理削除されていない行は全員に見える」だけだった。
-- 運営が非表示にした投稿を隠すため、status を条件に加える。
--
-- 自分の投稿は状態にかかわらず見える（docs/er/04-field-report.md）。
-- 非表示にされたことが本人に分からないと、何が起きたのか確かめようがない。
-- 運営は措置の確認のためにすべて見える。
drop policy field_reports_select_visible on public.field_reports;

create policy field_reports_select_visible
  on public.field_reports
  for select
  to anon, authenticated
  using (
    (deleted_at is null and status <> 'hidden')
    or user_id = (select auth.uid())
    or public.is_moderator()
  );

-- UPDATE のポリシーは引き続き作らない。
-- 投稿者に UPDATE を許すと、運営が hidden にした投稿を本人が active へ戻せてしまう
-- （docs/er/04-field-report.md）。status を変えられるのは
-- moderation_actions のトリガ（security definer）だけである
