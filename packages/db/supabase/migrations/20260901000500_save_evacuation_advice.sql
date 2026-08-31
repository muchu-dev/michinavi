-- 避難の提案の保存（BE-19）。
-- evacuation_advices → evacuation_options → evacuation_switch_criteria への
-- 書き込みを 1 トランザクションにまとめる
-- （docs/er/00-conventions.md#トランザクションの境界）。
--
-- 対象の世帯は setup_user_account / update_household_account と同じく
-- auth.uid() から解決し、クライアントから渡された household_id は使わない。
-- security definer にすることで、この関数を通す以外に提案を作る経路が無くなる。

create or replace function public.save_evacuation_advice(
  p_summary text,
  p_is_ai_generated boolean,
  p_input_snapshot jsonb,
  p_options jsonb,
  -- 提案が有効な時間。状況は動くので、古い提案をそのまま出し続けない
  p_valid_minutes int default 180
)
returns table (
  evacuation_advice_id uuid,
  household_id uuid,
  option_count int
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_household_id uuid;
  v_area_id uuid;
  v_home_mesh_code char(10);
  v_advice_id uuid;
  v_option jsonb;
  v_criterion jsonb;
  v_option_id uuid;
  v_switch_to_id uuid;
  -- 選択肢のキー（stay_home など）から採番された id への対応表。
  -- 切り替え先の解決に使う
  v_option_ids jsonb := '{}'::jsonb;
  v_option_count int := 0;
begin
  -- 1. 対象の世帯を JWT から解決する
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception '避難の提案の保存には認証が必要です'
      using errcode = '28000';
  end if;

  select h.id, h.area_id, h.home_mesh_code
  into v_household_id, v_area_id, v_home_mesh_code
  from public.household_members m
  join public.households h on h.id = m.household_id
  where m.user_id = v_user_id
    and m.is_primary;

  if v_household_id is null then
    raise exception '世帯が見つかりません'
      using errcode = 'P0002';
  end if;

  if jsonb_array_length(coalesce(p_options, '[]'::jsonb)) = 0 then
    raise exception '選択肢が 1 つも含まれていません'
      using errcode = '23514';
  end if;

  -- 2. 提案の本体
  insert into public.evacuation_advices (
    user_id,
    household_id,
    area_id,
    home_mesh_code,
    input_snapshot,
    summary,
    is_ai_generated,
    expires_at
  )
  values (
    v_user_id,
    v_household_id,
    v_area_id,
    v_home_mesh_code,
    coalesce(p_input_snapshot, '{}'::jsonb),
    p_summary,
    coalesce(p_is_ai_generated, false),
    now() + make_interval(mins => p_valid_minutes)
  )
  returning id into v_advice_id;

  -- 3. 選択肢。キーと id の対応を作りながら入れる
  for v_option in select * from jsonb_array_elements(p_options)
  loop
    insert into public.evacuation_options (
      evacuation_advice_id,
      rank,
      option_type,
      travel_mode,
      title,
      reason,
      risk_note,
      estimated_minutes
    )
    values (
      v_advice_id,
      (v_option ->> 'rank')::smallint,
      (v_option ->> 'optionType')::public.evacuation_option_type,
      (v_option ->> 'travelMode')::public.travel_mode,
      v_option ->> 'title',
      v_option ->> 'reason',
      nullif(btrim(coalesce(v_option ->> 'riskNote', '')), ''),
      (v_option ->> 'estimatedMinutes')::smallint
    )
    returning id into v_option_id;

    if v_option_ids ? (v_option ->> 'key') then
      raise exception '選択肢のキーが重複しています'
        using errcode = '23505';
    end if;

    v_option_ids := v_option_ids || jsonb_build_object(v_option ->> 'key', v_option_id::text);
    v_option_count := v_option_count + 1;
  end loop;

  -- 4. 切り替え基準。切り替え先は同じ提案の選択肢に限る。
  --    すべての選択肢を入れ終わってから解決するため、後ろの選択肢も指せる
  for v_option in select * from jsonb_array_elements(p_options)
  loop
    v_option_id := (v_option_ids ->> (v_option ->> 'key'))::uuid;

    for v_criterion in
      select * from jsonb_array_elements(coalesce(v_option -> 'switchCriteria', '[]'::jsonb))
    loop
      if v_criterion ->> 'switchToKey' is null then
        v_switch_to_id := null;
      else
        v_switch_to_id := (v_option_ids ->> (v_criterion ->> 'switchToKey'))::uuid;

        -- 提案に含まれない選択肢を指す基準は、画面で行き先を出せない
        if v_switch_to_id is null then
          raise exception '切り替え先の選択肢が提案に含まれていません'
            using errcode = '23503';
        end if;
      end if;

      insert into public.evacuation_switch_criteria (
        evacuation_option_id,
        evacuation_advice_id,
        trigger_type,
        description,
        threshold_value,
        threshold_unit,
        comparator,
        switch_to_option_id,
        display_order
      )
      values (
        v_option_id,
        v_advice_id,
        (v_criterion ->> 'triggerType')::public.switch_trigger_type,
        v_criterion ->> 'description',
        (v_criterion ->> 'thresholdValue')::numeric,
        nullif(btrim(coalesce(v_criterion ->> 'thresholdUnit', '')), ''),
        nullif(btrim(coalesce(v_criterion ->> 'comparator', '')), ''),
        v_switch_to_id,
        coalesce((v_criterion ->> 'displayOrder')::smallint, 0)
      );
    end loop;
  end loop;

  return query select v_advice_id, v_household_id, v_option_count;
end;
$$;

comment on function public.save_evacuation_advice(text, boolean, jsonb, jsonb, int) is
  'AI が生成した避難の選択肢を 1 トランザクションで保存する（BE-19）。対象の世帯は auth.uid() から解決する';

revoke all on function public.save_evacuation_advice(text, boolean, jsonb, jsonb, int) from public;
grant execute on function public.save_evacuation_advice(text, boolean, jsonb, jsonb, int)
  to authenticated, service_role;

-- PostgREST のスキーマキャッシュを更新する
notify pgrst, 'reload schema';
