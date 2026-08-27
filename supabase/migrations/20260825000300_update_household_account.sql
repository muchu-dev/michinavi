-- 世帯情報の更新（BE-09）。
-- 車・住所・構成員・要配慮・ペットへの書き込みを 1 トランザクションにまとめる
-- （docs/er/00-conventions.md#トランザクションの境界）。
-- 対象は setup_user_account と同じく auth.uid() から解決し、
-- クライアントから渡された household_id は使わない。

create or replace function public.update_household_account(
  p_area_id uuid,
  p_home_mesh_code text,
  p_car_count smallint,
  p_members jsonb,
  p_pets jsonb default '[]'::jsonb
)
returns table (
  household_id uuid,
  area_id uuid,
  home_mesh_code text,
  car_count smallint,
  has_car boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_household_id uuid;
  v_member jsonb;
  v_member_id uuid;
  v_keep_member_ids uuid[] := '{}';
  v_care_need_count int;
begin
  -- 1. 対象の世帯を JWT から解決する。呼び出し元の既定の世帯に限る
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception '世帯情報の更新には認証が必要です'
      using errcode = '28000';
  end if;

  select m.household_id into v_household_id
  from public.household_members m
  where m.user_id = v_user_id
    and m.is_primary;

  if v_household_id is null then
    raise exception '世帯が見つかりません'
      using errcode = 'P0002';
  end if;

  -- 同じ世帯への同時更新を直列化する
  perform pg_advisory_xact_lock(hashtextextended(v_household_id::text, 1));

  -- 2. households（車・住所）
  update public.households
  set area_id = p_area_id,
      home_mesh_code = p_home_mesh_code,
      car_count = p_car_count
  where id = v_household_id;

  -- users 側の住所も揃える。
  -- setup_user_account が両方に書いているため、片方だけ更新すると食い違う
  update public.users
  set area_id = p_area_id,
      home_mesh_code = p_home_mesh_code
  where id = v_user_id;

  -- 3. household_members（人数・年齢層・要配慮）を入力どおりに揃える。
  --    id があれば既存の行を更新し、無ければアカウントを持たない構成員として新規に足す
  for v_member in select * from jsonb_array_elements(coalesce(p_members, '[]'::jsonb))
  loop
    if v_member ->> 'id' is not null then
      v_member_id := (v_member ->> 'id')::uuid;

      update public.household_members hm
      set display_name = v_member ->> 'displayName',
          age_group = (v_member ->> 'ageGroup')::public.age_group,
          needs_assistance = (v_member ->> 'needsAssistance')::boolean
      where hm.id = v_member_id
        and hm.household_id = v_household_id;

      if not found then
        raise exception '存在しない構成員です'
          using errcode = 'P0002';
      end if;
    else
      insert into public.household_members (
        household_id,
        display_name,
        age_group,
        needs_assistance,
        -- 代理登録した安否の共有範囲（E5）。既定は世帯の内側
        -- （docs/er/01-account-household.md）
        proxy_share_scope
      )
      values (
        v_household_id,
        v_member ->> 'displayName',
        (v_member ->> 'ageGroup')::public.age_group,
        (v_member ->> 'needsAssistance')::boolean,
        'household'
      )
      returning id into v_member_id;
    end if;

    v_keep_member_ids := v_keep_member_ids || v_member_id;

    -- 要配慮は構成員 × 種別ごとに入力どおり全置換する。detail は種別ごとに別々に持てる
    delete from public.household_member_care_needs
    where household_member_id = v_member_id;

    insert into public.household_member_care_needs (household_member_id, care_need_id, detail)
    select distinct
      v_member_id,
      c.id,
      nullif(btrim(cn ->> 'detail'), '')
    from jsonb_array_elements(coalesce(v_member -> 'careNeeds', '[]'::jsonb)) as cn
    join public.care_needs c on c.key = (cn ->> 'key')
    where c.is_active;

    get diagnostics v_care_need_count = row_count;

    -- マスタに無いキー、無効化されたキーを黙って捨てない
    if v_care_need_count <> (
      select count(distinct cn ->> 'key')
      from jsonb_array_elements(coalesce(v_member -> 'careNeeds', '[]'::jsonb)) as cn
    ) then
      raise exception '存在しない要配慮です'
        using errcode = 'P0002';
    end if;
  end loop;

  -- 入力に含まれなかった構成員は脱退として扱う。本人の行（is_primary）は対象外
  delete from public.household_members hm
  where hm.household_id = v_household_id
    and not hm.is_primary
    and hm.id <> all (v_keep_member_ids);

  -- 4. pets（ペット）を入力どおり全置換する
  delete from public.pets pt where pt.household_id = v_household_id;

  insert into public.pets (household_id, species, size, count, is_crate_trained, note)
  select
    v_household_id,
    (p ->> 'species')::public.pet_species,
    (p ->> 'size')::public.pet_size,
    (p ->> 'count')::smallint,
    coalesce((p ->> 'isCrateTrained')::boolean, false),
    nullif(btrim(p ->> 'note'), '')
  from jsonb_array_elements(coalesce(p_pets, '[]'::jsonb)) as p;

  -- 5. 更新後の世帯を返す
  return query
  select h.id, h.area_id, h.home_mesh_code::text, h.car_count, h.has_car
  from public.households h
  where h.id = v_household_id;
end;
$$;

comment on function public.update_household_account(uuid, text, smallint, jsonb, jsonb) is
  '世帯の車・住所・構成員・要配慮・ペットをまとめて更新する。構成員とペットは入力どおりに全置換する（本人の構成員行を除く）';

revoke all on function public.update_household_account(uuid, text, smallint, jsonb, jsonb)
  from public;
grant execute on function public.update_household_account(uuid, text, smallint, jsonb, jsonb)
  to authenticated;

-- PostgREST のスキーマキャッシュを更新する
notify pgrst, 'reload schema';
