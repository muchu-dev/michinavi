-- 避難所の RLS。
-- 方針は docs/er/07-safety-moderation.md#行レベルセキュリティの方針 に置く。
--
-- 避難所は公開情報のマスタなので全員が読める。書き込みは service role だけ
-- （ポリシーを作らない）。住民が書き換えられると、避難先の情報が汚染される。

alter table public.shelters enable row level security;
alter table public.shelter_hazard_supports enable row level security;
alter table public.acceptance_conditions enable row level security;
alter table public.shelter_acceptances enable row level security;

create policy shelters_select_all
  on public.shelters for select to anon, authenticated using (true);

create policy shelter_hazard_supports_select_all
  on public.shelter_hazard_supports for select to anon, authenticated using (true);

create policy acceptance_conditions_select_all
  on public.acceptance_conditions for select to anon, authenticated using (true);

create policy shelter_acceptances_select_all
  on public.shelter_acceptances for select to anon, authenticated using (true);
