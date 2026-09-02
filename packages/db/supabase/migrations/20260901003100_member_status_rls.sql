-- 安否の RLS。
-- 方針は docs/er/07-safety-moderation.md#行レベルセキュリティの方針 に置く。

alter table public.member_statuses enable row level security;

create policy member_statuses_select_shared
  on public.member_statuses
  for select
  to authenticated
  using (public.can_view_member_status(household_member_id));

-- INSERT / UPDATE のポリシーは作らない。
-- 現在値は member_status_events のトリガ（security definer）だけが書く。
-- 直接書ける経路があると、履歴に無い状態が現在値に現れる

alter table public.member_status_events enable row level security;

create policy member_status_events_select_shared
  on public.member_status_events
  for select
  to authenticated
  using (public.can_view_member_status(household_member_id));

-- 自分の安否か、アカウントを持たない同居家族の代理登録だけを許す。
-- actor_user_id を入力任せにすると、他人が登録したように見せかけられる
create policy member_status_events_insert_allowed
  on public.member_status_events
  for insert
  to authenticated
  with check (
    public.can_update_member_status(household_member_id)
    and actor_user_id = (select auth.uid())
  );

-- UPDATE / DELETE のポリシーは作らない。履歴は追記のみ
