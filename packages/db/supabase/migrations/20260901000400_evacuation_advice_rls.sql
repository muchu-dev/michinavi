-- 避難の提案まわりの RLS。
-- 方針は docs/er/07-safety-moderation.md#行レベルセキュリティの方針 に置く。
--
-- 提案は世帯の構成・要配慮・自宅位置を写した内容を含む。
-- 他人に読ませない（S6）ため、公開している road_status_estimates とは扱いを変え、
-- anon には一切見せず、世帯の構成員だけが読めるようにする。

-- ----------------------------------------------------------------------------
-- evacuation_advices
-- ----------------------------------------------------------------------------
alter table public.evacuation_advices enable row level security;

create policy evacuation_advices_select_member
  on public.evacuation_advices
  for select
  to authenticated
  using (public.is_household_member(household_id));

-- INSERT / UPDATE / DELETE のポリシーは作らない。
-- 書き込みは save_evacuation_advice（security definer）だけが行う。
-- 直接 INSERT できると、AI の検証も候補の絞り込みも経ていない選択肢を
-- 自分の世帯の提案として作れてしまう

-- ----------------------------------------------------------------------------
-- evacuation_options
-- ----------------------------------------------------------------------------
alter table public.evacuation_options enable row level security;

-- 親の提案が読めることを条件にする。
-- evacuation_advices 側のポリシーがそのまま効くため、条件を二重に書かない
create policy evacuation_options_select_via_advice
  on public.evacuation_options
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.evacuation_advices a
      where a.id = evacuation_advice_id
    )
  );

-- ----------------------------------------------------------------------------
-- evacuation_switch_criteria
-- ----------------------------------------------------------------------------
alter table public.evacuation_switch_criteria enable row level security;

create policy evacuation_switch_criteria_select_via_advice
  on public.evacuation_switch_criteria
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.evacuation_advices a
      where a.id = evacuation_advice_id
    )
  );
