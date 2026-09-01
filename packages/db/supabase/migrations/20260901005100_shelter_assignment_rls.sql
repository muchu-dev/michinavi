-- 避難先の割り当ての RLS。
-- 方針は docs/er/07-safety-moderation.md#行レベルセキュリティの方針 に置く。

alter table public.shelter_assignments enable row level security;

-- 自分の世帯の割り当てだけが見える。
-- 他人がどこへ避難するつもりかは、居場所の予告に等しい
create policy shelter_assignments_select_member
  on public.shelter_assignments
  for select
  to authenticated
  using (public.is_household_member(household_id));

-- INSERT / UPDATE / DELETE のポリシーは作らない。
-- 書き込みは assign_shelter（security definer）だけが行う。
-- 直接書けると、他の世帯の想定人数を水増しして候補から外させることができる
