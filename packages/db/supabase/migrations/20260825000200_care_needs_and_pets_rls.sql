-- 要配慮とペットの RLS。
-- 方針は docs/er/01-account-household.md#認可 に置く。
-- households / household_members と同じ is_household_member() を土台にする。

-- ----------------------------------------------------------------------------
-- care_needs（マスタ）
-- ----------------------------------------------------------------------------
alter table public.care_needs enable row level security;

-- マスタなので全員が読める。書き込みは service role だけ（ポリシーを作らない）
create policy care_needs_select_all
  on public.care_needs
  for select
  to anon, authenticated
  using (true);

-- ----------------------------------------------------------------------------
-- household_member_care_needs
-- ----------------------------------------------------------------------------
alter table public.household_member_care_needs enable row level security;

create policy household_member_care_needs_select_member
  on public.household_member_care_needs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.household_members m
      where m.id = household_member_id
        and public.is_household_member(m.household_id)
    )
  );

create policy household_member_care_needs_insert_member
  on public.household_member_care_needs
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.household_members m
      where m.id = household_member_id
        and public.is_household_member(m.household_id)
    )
  );

create policy household_member_care_needs_update_member
  on public.household_member_care_needs
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.household_members m
      where m.id = household_member_id
        and public.is_household_member(m.household_id)
    )
  )
  with check (
    exists (
      select 1
      from public.household_members m
      where m.id = household_member_id
        and public.is_household_member(m.household_id)
    )
  );

create policy household_member_care_needs_delete_member
  on public.household_member_care_needs
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.household_members m
      where m.id = household_member_id
        and public.is_household_member(m.household_id)
    )
  );

-- ----------------------------------------------------------------------------
-- pets
-- ----------------------------------------------------------------------------
alter table public.pets enable row level security;

create policy pets_select_member
  on public.pets
  for select
  to authenticated
  using (public.is_household_member(household_id));

create policy pets_insert_member
  on public.pets
  for insert
  to authenticated
  with check (public.is_household_member(household_id));

create policy pets_update_member
  on public.pets
  for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy pets_delete_member
  on public.pets
  for delete
  to authenticated
  using (public.is_household_member(household_id));
