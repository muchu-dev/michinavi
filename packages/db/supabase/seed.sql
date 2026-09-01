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

-- ----------------------------------------------------------------------------
-- 避難所（BE-14）
-- ----------------------------------------------------------------------------
-- **これは架空のデータである。** 実在の施設ではない。
--
-- 本番用の指定緊急避難場所データ（国土地理院・各自治体の公開データ）は
-- まだ調査できていないため、開発とテストが進む分だけの架空の施設を置く。
-- 実データが揃ったら public.import_shelters に同じ形の JSON を渡して
-- 取り込む（external_code で突合して UPSERT する）。
-- 架空だと分かるよう、名前は「デモ」で始め、external_code は DEMO- 接頭辞、
-- source にもその旨を書く。
select public.import_shelters(
  jsonb_build_array(
    jsonb_build_object(
      'externalCode', 'DEMO-SHELTER-001',
      'name', 'デモ第一小学校',
      'nameKana', 'デモダイイチショウガッコウ',
      'address', '岡山県倉敷市真備町箭田（架空）',
      'areaId', '00000000-0000-4000-8000-000000000003',
      'latitude', 34.6395,
      'longitude', 133.6890,
      'capacity', 300,
      'category', 'designated_shelter',
      'elevationM', 12.5,
      'floors', 3,
      'operator', 'デモ市教育委員会',
      'source', 'デモ用の架空データ（実在の施設ではありません）',
      'acceptances', jsonb_build_array(
        jsonb_build_object('key', 'pet', 'status', 'limited', 'note', 'ケージ持参が条件'),
        jsonb_build_object('key', 'wheelchair', 'status', 'available'),
        jsonb_build_object('key', 'barrier_free_toilet', 'status', 'available'),
        jsonb_build_object('key', 'infant', 'status', 'available'),
        jsonb_build_object('key', 'medical_care', 'status', 'unavailable')
      ),
      'hazardSupports', jsonb_build_array(
        jsonb_build_object('hazardType', 'flood', 'isSupported', true, 'note', '洪水時は2階以上'),
        jsonb_build_object('hazardType', 'landslide', 'isSupported', true)
      )
    ),
    jsonb_build_object(
      'externalCode', 'DEMO-SHELTER-002',
      'name', 'デモ中央公民館',
      'address', '岡山県倉敷市真備町箭田（架空）',
      'areaId', '00000000-0000-4000-8000-000000000003',
      'latitude', 34.6360,
      'longitude', 133.6935,
      'capacity', 120,
      'category', 'designated_shelter',
      'elevationM', 9.0,
      'floors', 2,
      'source', 'デモ用の架空データ（実在の施設ではありません）',
      'acceptances', jsonb_build_array(
        jsonb_build_object('key', 'pet', 'status', 'unavailable'),
        jsonb_build_object('key', 'wheelchair', 'status', 'limited', 'note', '正面のみ段差あり')
      ),
      'hazardSupports', jsonb_build_array(
        jsonb_build_object('hazardType', 'flood', 'isSupported', false, 'note', '浸水想定区域内')
      )
    ),
    jsonb_build_object(
      'externalCode', 'DEMO-SHELTER-003',
      'name', 'デモ高台公園',
      'address', '岡山県倉敷市真備町箭田（架空）',
      'areaId', '00000000-0000-4000-8000-000000000003',
      'latitude', 34.6440,
      'longitude', 133.6820,
      'category', 'emergency_site',
      'elevationM', 28.0,
      'source', 'デモ用の架空データ（実在の施設ではありません）',
      'acceptances', jsonb_build_array(
        jsonb_build_object('key', 'pet', 'status', 'available')
      ),
      'hazardSupports', jsonb_build_array(
        jsonb_build_object('hazardType', 'flood', 'isSupported', true)
      )
    ),
    jsonb_build_object(
      'externalCode', 'DEMO-SHELTER-004',
      'name', 'デモ福祉センター',
      'address', '岡山県倉敷市真備町川辺（架空）',
      'areaId', '00000000-0000-4000-8000-000000000004',
      'latitude', 34.6300,
      'longitude', 133.7050,
      'capacity', 60,
      'category', 'welfare_shelter',
      'elevationM', 8.5,
      'floors', 2,
      'source', 'デモ用の架空データ（実在の施設ではありません）',
      'acceptances', jsonb_build_array(
        jsonb_build_object('key', 'welfare', 'status', 'available'),
        jsonb_build_object('key', 'medical_care', 'status', 'available'),
        jsonb_build_object('key', 'power_supply', 'status', 'available'),
        jsonb_build_object('key', 'wheelchair', 'status', 'available'),
        jsonb_build_object('key', 'pet', 'status', 'unavailable')
      )
    ),
    jsonb_build_object(
      'externalCode', 'DEMO-SHELTER-005',
      'name', 'デモ玉島体育館',
      'address', '岡山県倉敷市玉島阿賀崎（架空）',
      'areaId', '00000000-0000-4000-8000-000000000005',
      'latitude', 34.5420,
      'longitude', 133.6700,
      'capacity', 400,
      'category', 'designated_shelter',
      'floors', 1,
      'source', 'デモ用の架空データ（実在の施設ではありません）',
      'acceptances', jsonb_build_array(
        jsonb_build_object('key', 'pet', 'status', 'limited')
      )
    )
  )
);
