-- アカウントと世帯の RLS。
-- 方針は docs/er/07-safety-moderation.md#行レベルセキュリティの方針 に置く。
-- ポリシーの条件はテーブルごとに書き下ろさず、関数へ集約する。

-- ----------------------------------------------------------------------------
-- 認可の土台になる関数
-- ----------------------------------------------------------------------------

-- 呼び出し元が対象の世帯に属しているか。
-- household_members のポリシー自身から呼ぶため security definer にする。
-- 呼び出し側に search_path を差し替えられないよう固定する
create or replace function public.is_household_member(target uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = target
      and m.user_id = (select auth.uid())
  );
$$;

comment on function public.is_household_member(uuid) is
  '呼び出し元が対象の世帯の構成員か。世帯まわりの SELECT / UPDATE ポリシーはすべてこれを通す';

-- 呼び出し元が対象の世帯の管理者か。管理者向けの操作はこれで絞る
create or replace function public.is_household_owner(target uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.households h
    where h.id = target
      and h.owner_user_id = (select auth.uid())
  );
$$;

comment on function public.is_household_owner(uuid) is
  '呼び出し元が対象の世帯の管理者か。招待、構成員の削除、世帯の削除で使う';

revoke all on function public.is_household_member(uuid) from public;
revoke all on function public.is_household_owner(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated, service_role;
grant execute on function public.is_household_owner(uuid) to authenticated, service_role;

-- 管理者の付け替えは管理者だけができる。
-- UPDATE ポリシーは列を絞れないため、列の変更はトリガで見張る
create or replace function public.guard_household_owner_change()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.owner_user_id is distinct from old.owner_user_id
     and old.owner_user_id is distinct from (select auth.uid())
     -- service role とバッチ（auth.uid() が無い実行）はこの検査の対象外
     and (select auth.uid()) is not null then
    raise exception '世帯の管理者を変更できるのは現在の管理者だけです'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger households_guard_owner_change
  before update on public.households
  for each row execute function public.guard_household_owner_change();

-- ----------------------------------------------------------------------------
-- areas（地区マスタ）
-- ----------------------------------------------------------------------------
alter table public.areas enable row level security;

-- マスタなので全員が読める。書き込みは service role だけ（ポリシーを作らない）
create policy areas_select_all
  on public.areas
  for select
  to anon, authenticated
  using (true);

-- ----------------------------------------------------------------------------
-- users
-- ----------------------------------------------------------------------------
alter table public.users enable row level security;

-- RLS は列を隠せない。第三者に読ませると area_id と home_mesh_code まで一緒に読める
create policy users_select_self
  on public.users
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy users_insert_self
  on public.users
  for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy users_update_self
  on public.users
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- DELETE のポリシーは作らない。退会は deleted_at による論理削除で行う

-- ----------------------------------------------------------------------------
-- households
-- ----------------------------------------------------------------------------
alter table public.households enable row level security;

create policy households_select_member
  on public.households
  for select
  to authenticated
  using (public.is_household_member(id));

-- 世帯を作れるのは自分を管理者にする場合だけ
create policy households_insert_self_owned
  on public.households
  for insert
  to authenticated
  with check (owner_user_id = (select auth.uid()));

create policy households_update_member
  on public.households
  for update
  to authenticated
  using (public.is_household_member(id))
  with check (public.is_household_member(id));

create policy households_delete_owner
  on public.households
  for delete
  to authenticated
  using (owner_user_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- household_members
-- ----------------------------------------------------------------------------
alter table public.household_members enable row level security;

create policy household_members_select_member
  on public.household_members
  for select
  to authenticated
  using (public.is_household_member(household_id));

-- 構成員を足せるのは、その世帯の構成員か管理者に限る。
-- 「自分の行だから」を根拠にすると、他人の世帯に自分を入れられる
create policy household_members_insert_member
  on public.household_members
  for insert
  to authenticated
  with check (
    public.is_household_member(household_id)
    or public.is_household_owner(household_id)
  );

create policy household_members_update_member
  on public.household_members
  for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- 構成員を外すのは管理者向けの操作
create policy household_members_delete_owner
  on public.household_members
  for delete
  to authenticated
  using (public.is_household_owner(household_id));
