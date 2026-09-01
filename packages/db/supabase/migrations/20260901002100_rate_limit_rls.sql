-- レート制限の RLS。
-- 方針は docs/er/07-safety-moderation.md#行レベルセキュリティの方針 に置く。

alter table public.rate_limits enable row level security;

-- 上限は隠す情報ではない。何件まで投稿できるかを画面に出せるようにする
create policy rate_limits_select_all
  on public.rate_limits
  for select
  to anon, authenticated
  using (true);

-- INSERT / UPDATE / DELETE のポリシーは作らない。上限の変更は service role だけ

alter table public.rate_limit_counters enable row level security;

-- 自分の実績だけ読める。他人の投稿ペースは見せない
create policy rate_limit_counters_select_self
  on public.rate_limit_counters
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- INSERT / UPDATE のポリシーは作らない。
-- 直接書ける経路を開くと、カウンタを 0 に戻して上限を回避できてしまう。
-- 加算は create_field_report（security definer）だけが行う
