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

-- 神田（千代田区）の地区マスタ。BE-10 の対象地域。
-- code は 東京都・千代田区は JIS X 0402 の団体コード、町丁目は
-- 「千代田区のコード + 連番」の仮値（公式の町字IDは未取得のため）。
-- 町丁目は千代田区役所の公開ページに載っている「神田」を含む表記を
-- すべて採用する（住居表示実施・未実施の両方）。
-- https://www.city.chiyoda.lg.jp/koho/machizukuri/tochi/jukyohyoji/hyoki.html
-- centroid は町丁目ごとの正確な中心座標を持たないため、神田駅の代表点1点で
-- 全町丁目を近似する。地図の初期表示位置にしか使わず、地区判定（name の
-- 文字列一致）の正確さには影響しない
insert into public.areas (id, code, name, parent_area_id, level, city, prefecture, centroid)
values
  (
    '00000000-0000-4000-9000-000000000001',
    '13000',
    '東京都',
    null,
    1,
    '東京都',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.6917, 35.6895), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000002',
    '13101',
    '千代田区',
    '00000000-0000-4000-9000-000000000001',
    2,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7538, 35.694), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000003',
    '131010001',
    '神田猿楽町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000004',
    '131010002',
    '神田三崎町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000005',
    '131010003',
    '神田淡路町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000006',
    '131010004',
    '神田小川町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000007',
    '131010005',
    '神田鍛冶町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000008',
    '131010006',
    '神田佐久間町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000009',
    '131010007',
    '神田神保町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000010',
    '131010008',
    '神田須田町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000011',
    '131010009',
    '神田駿河台',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000012',
    '131010010',
    '神田多町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000013',
    '131010011',
    '神田司町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000014',
    '131010012',
    '神田錦町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000015',
    '131010013',
    '神田相生町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000016',
    '131010014',
    '神田和泉町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000017',
    '131010015',
    '神田岩本町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000018',
    '131010016',
    '神田北乗物町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000019',
    '131010017',
    '神田紺屋町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000020',
    '131010018',
    '神田富山町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000021',
    '131010019',
    '神田西福田町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000022',
    '131010020',
    '神田練塀町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000023',
    '131010021',
    '神田花岡町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000024',
    '131010022',
    '神田東紺屋町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000025',
    '131010023',
    '神田東松下町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000026',
    '131010024',
    '神田平河町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000027',
    '131010025',
    '神田松永町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000028',
    '131010026',
    '神田美倉町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000029',
    '131010027',
    '神田美土代町',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000030',
    '131010028',
    '神田佐久間河岸',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000031',
    '131010029',
    '内神田',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000032',
    '131010030',
    '外神田',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000033',
    '131010031',
    '西神田',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  ),
  (
    '00000000-0000-4000-9000-000000000034',
    '131010032',
    '東神田',
    '00000000-0000-4000-9000-000000000002',
    3,
    '千代田区',
    '東京都',
    extensions.st_setsrid(extensions.st_makepoint(139.7708, 35.6918), 4326)::extensions.geography
  )
on conflict (code) do nothing;
