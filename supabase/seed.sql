-- 開発とテスト用の最小限の地区マスタ。
-- 本番用の一括投入は別途行うため、ここには動作確認に足りるだけ入れる。
-- `supabase db reset` で毎回流れるので、再実行できる形で書く。

insert into public.areas (id, code, name, parent_area_id, level, city, prefecture, centroid)
values
  (
    '00000000-0000-4000-8000-000000000001',
    '33000',
    '岡山県',
    null,
    1,
    '岡山県',
    '岡山県',
    extensions.st_setsrid(extensions.st_makepoint(133.9350, 34.6618), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    '33202',
    '倉敷市',
    '00000000-0000-4000-8000-000000000001',
    2,
    '倉敷市',
    '岡山県',
    extensions.st_setsrid(extensions.st_makepoint(133.7720, 34.5850), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    '332020001',
    '真備町箭田',
    '00000000-0000-4000-8000-000000000002',
    3,
    '倉敷市',
    '岡山県',
    extensions.st_setsrid(extensions.st_makepoint(133.6903, 34.6383), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    '332020002',
    '真備町川辺',
    '00000000-0000-4000-8000-000000000002',
    3,
    '倉敷市',
    '岡山県',
    extensions.st_setsrid(extensions.st_makepoint(133.7085, 34.6297), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-8000-000000000005',
    '332020003',
    '玉島阿賀崎',
    '00000000-0000-4000-8000-000000000002',
    3,
    '倉敷市',
    '岡山県',
    extensions.st_setsrid(extensions.st_makepoint(133.6690, 34.5406), 4326)::extensions.geography
  )
on conflict (code) do nothing;
