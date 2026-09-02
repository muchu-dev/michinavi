-- field_report_photos の RLS。
-- 方針は docs/er/07-safety-moderation.md#行レベルセキュリティの方針 に置く。

alter table public.field_report_photos enable row level security;

-- Exif の除去が終わった写真だけを全員に見せる。
-- 除去が落ちた行を第三者に見せると、位置情報つきの画像がそのまま公開される。
-- 投稿者本人には、除去の途中でも自分の写真として見える
create policy field_report_photos_select_stripped
  on public.field_report_photos
  for select
  to anon, authenticated
  using (
    exif_stripped
    or exists (
      select 1
      from public.field_reports r
      where r.id = field_report_id
        and r.user_id = (select auth.uid())
    )
  );

-- 足せるのは自分の投稿の写真だけ。
-- 他人の投稿に写真を差し込めると、投稿者が身に覚えのない画像の責任を負う
create policy field_report_photos_insert_own_report
  on public.field_report_photos
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.field_reports r
      where r.id = field_report_id
        and r.user_id = (select auth.uid())
    )
  );

-- UPDATE / DELETE のポリシーは作らない。
-- 写真の差し替えを許すと、通報された画像を別のものにすり替えられる
