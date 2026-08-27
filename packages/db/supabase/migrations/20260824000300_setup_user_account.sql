-- 認証済みユーザの初期登録。
-- users、households、household_members への INSERT を 1 トランザクションにまとめる
-- （docs/er/00-conventions.md#トランザクションの境界）。
-- 対象は必ず auth.uid() から解決し、クライアントから渡された ID は使わない。

create or replace function public.setup_user_account(
  p_display_name text,
  p_area_id uuid,
  p_home_mesh_code text,
  p_household_name text default null,
  p_age_group public.age_group default 'adult',
  p_car_count smallint default 0
)
returns table (
  user_id uuid,
  display_name text,
  area_id uuid,
  home_mesh_code text,
  household_id uuid,
  household_name text,
  household_member_id uuid,
  car_count smallint,
  has_car boolean,
  is_created boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_household_id uuid;
  v_member_id uuid;
  v_is_created boolean := false;
begin
  -- 1. 対象のユーザを JWT から解決する
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception '初期登録には認証が必要です'
      using errcode = '28000';
  end if;

  -- 同じユーザからの同時実行を直列化する。
  -- 二本が同時に既定世帯の不在を見ると、両方が世帯を作ろうとして
  -- household_members_primary_uniq で片方が落ちる
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  -- 2. users を作る。すでにあれば既存の行を使う（再実行で作り直さない）
  insert into public.users (id, display_name, area_id, home_mesh_code)
  values (v_user_id, p_display_name, p_area_id, p_home_mesh_code)
  on conflict (id) do nothing;

  -- 3. 既定の世帯がすでにあるなら、世帯と構成員は作らない
  select m.household_id, m.id
  into v_household_id, v_member_id
  from public.household_members m
  where m.user_id = v_user_id
    and m.is_primary;

  if v_household_id is null then
    -- 4. 本人用の世帯を作る。名前の既定値は本人の表示名
    insert into public.households (
      name,
      owner_user_id,
      area_id,
      home_mesh_code,
      car_count
    )
    values (
      coalesce(nullif(btrim(p_household_name), ''), p_display_name),
      v_user_id,
      p_area_id,
      p_home_mesh_code,
      p_car_count
    )
    returning id into v_household_id;

    -- 5. 本人を構成員として追加し、既定の世帯にする。
    --    households_owner_is_member は遅延させてあるので、
    --    この INSERT より前に世帯を入れてよい
    insert into public.household_members (
      household_id,
      user_id,
      display_name,
      age_group,
      is_primary
    )
    values (
      v_household_id,
      v_user_id,
      p_display_name,
      p_age_group,
      true
    )
    returning id into v_member_id;

    v_is_created := true;
  end if;

  -- 6. 作成したユーザと世帯を返す
  return query
  select
    u.id,
    u.display_name,
    u.area_id,
    u.home_mesh_code::text,
    h.id,
    h.name,
    v_member_id,
    h.car_count,
    h.has_car,
    v_is_created
  from public.users u
  join public.households h on h.id = v_household_id
  where u.id = v_user_id;
end;
$$;

comment on function public.setup_user_account(text, uuid, text, text, public.age_group, smallint) is
  '認証済みユーザの初期登録。users と本人 1 人の世帯を同じトランザクションで作る。再実行しても重複を作らない';

revoke all on function public.setup_user_account(text, uuid, text, text, public.age_group, smallint)
  from public;
grant execute on function public.setup_user_account(text, uuid, text, text, public.age_group, smallint)
  to authenticated;

-- PostgREST のスキーマキャッシュを更新する
notify pgrst, 'reload schema';
