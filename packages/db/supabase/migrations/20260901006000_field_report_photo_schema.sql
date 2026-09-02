-- 現地報告の写真（BE-13、機能 C3 / S2）。
-- 設計の根拠は docs/er/04-field-report.md に置く。
--
-- 写真は Storage に置き、DB にはパスと Exif 除去の完了フラグを持つ。
-- 除去はサーバ側（tRPC の procedure）で行い、除去してからでないと
-- アップロードしない。クライアントの実装や設定に頼らない。

-- ----------------------------------------------------------------------------
-- Storage のバケット
-- ----------------------------------------------------------------------------
-- 公開バケットにする。現地報告そのものが未ログインでも見える設計なので、
-- 写真だけを伏せても意味がない。代わりに、Exif を落としてからしか
-- 置かれないようにする。
--
-- 形式を JPEG と PNG に絞るのは、Exif を落とせない形式（HEIC など）が
-- そのまま公開される経路を残さないためである。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'field-report-photos',
  'field-report-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png']
)
on conflict (id) do nothing;

-- 置けるのは自分の user_id のフォルダの下だけ。
-- 他人のフォルダへ置けると、投稿と写真の持ち主が食い違う
create policy field_report_photos_object_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'field-report-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy field_report_photos_object_select_all
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'field-report-photos');

-- UPDATE / DELETE のポリシーは作らない。
-- 差し替えを許すと、通報された写真を別の画像にすり替えられる

-- ----------------------------------------------------------------------------
-- field_report_photos
-- ----------------------------------------------------------------------------
create table public.field_report_photos (
  id uuid primary key default gen_random_uuid(),
  field_report_id uuid not null
    references public.field_reports (id) on delete cascade,
  -- バケット内のパス。`{user_id}/{field_report_id}/{uuid}.jpg`
  storage_path text not null unique,
  mime_type text not null,
  byte_size integer not null,
  width integer,
  height integer,
  -- 除去処理が落ちたときに、位置情報つきの写真がそのまま公開される事故を防ぐ。
  -- true でない行は投稿者以外に見せない（RLS）
  exif_stripped boolean not null default false,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint field_report_photos_mime_type_check
    check (mime_type in ('image/jpeg', 'image/png')),
  constraint field_report_photos_byte_size_positive check (byte_size > 0),
  constraint field_report_photos_size_range
    check (width is null or (width > 0 and height > 0)),
  -- 除去が終わった行には必ず時刻が入る
  constraint field_report_photos_processed_at_required
    check (not exif_stripped or processed_at is not null)
);

comment on table public.field_report_photos is
  '現地報告の写真（C3）。Exif を落としてから Storage に置く（S2）';
comment on column public.field_report_photos.exif_stripped is
  'Exif の除去が終わったか。false の行は投稿者以外に見せない';

create index field_report_photos_field_report_id_idx
  on public.field_report_photos (field_report_id);

-- ----------------------------------------------------------------------------
-- 権限
-- ----------------------------------------------------------------------------
grant select on public.field_report_photos to anon, authenticated;
grant insert on public.field_report_photos to authenticated;
grant all on public.field_report_photos to service_role;

notify pgrst, 'reload schema';
