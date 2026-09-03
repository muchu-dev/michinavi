-- 安否と家族共有（BE-22、機能 E4 / E5）。
-- 設計の根拠は docs/er/06-community-status.md に置く。
--
-- 現在値（member_statuses）を 1 構成員 1 行で持ち、変化（member_status_events）を
-- 追記する。現在値を履歴から毎回導出しない。災害時に最も引かれるのが現在値であり、
-- そこを集計にすると遅い。
--
-- 安否の主体はユーザではなく世帯構成員にする。アカウントを持たない家族
-- （高齢の親、子ども）の安否も代理で登録する必要があるためである。
--
-- BE-22 の範囲では次を持たない。参照先のテーブルがまだ無い。
--   - shelter_id（滞在先の避難所。BE-14 で足す）
--   - disaster_event_id（災害イベント）
--   - family_connections（別世帯の家族。共有先は同じ世帯に限る）

-- ----------------------------------------------------------------------------
-- ENUM
-- ----------------------------------------------------------------------------

-- 安否と避難の状況（E4）
create type public.user_status as enum (
  'unknown',
  'safe_home',
  'preparing',
  'evacuating',
  'at_shelter',
  'needs_help',
  'safe_other'
);

-- 状態が変わった経緯。あとから「誰が入れた値か」を追えるようにする
create type public.member_status_source as enum (
  'self',
  'proxy'
);

-- ----------------------------------------------------------------------------
-- 共有範囲の判定
-- ----------------------------------------------------------------------------

-- 対象の構成員の安否を、呼び出し元が見てよいか（E5）。
-- household_members と users を読むため security definer にする。
--
-- 共有範囲は 2 か所にある。アカウントを持つ人は本人の users.status_share_scope、
-- 持たない人は household_members.proxy_share_scope（既定は世帯の内側）。
-- 本人が同意を示せない以上、代理登録の既定は外へ出さない。
create or replace function public.can_view_member_status(target uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.household_members target_member
    left join public.users target_user on target_user.id = target_member.user_id
    where target_member.id = target
      and (
        -- 本人はいつでも見える
        target_member.user_id = (select auth.uid())
        or (
          -- 同じ世帯の構成員であること
          exists (
            select 1
            from public.household_members viewer
            where viewer.household_id = target_member.household_id
              and viewer.user_id = (select auth.uid())
          )
          -- かつ、共有範囲が「誰にも見せない」でないこと
          and coalesce(
            target_user.status_share_scope,
            target_member.proxy_share_scope,
            'household'
          ) <> 'none'
        )
      )
  );
$$;

comment on function public.can_view_member_status(uuid) is
  '対象の構成員の安否を呼び出し元が見てよいか（E5）。同じ世帯であることと共有範囲で決まる';

-- 対象の構成員の安否を、呼び出し元が更新してよいか。
-- 本人か、アカウントを持たない構成員を同じ世帯の人が代理で登録する場合に限る。
-- アカウントを持つ他人の安否を勝手に書き換えられないようにする
create or replace function public.can_update_member_status(target uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.household_members target_member
    where target_member.id = target
      and (
        target_member.user_id = (select auth.uid())
        or (
          target_member.user_id is null
          and exists (
            select 1
            from public.household_members viewer
            where viewer.household_id = target_member.household_id
              and viewer.user_id = (select auth.uid())
          )
        )
      )
  );
$$;

comment on function public.can_update_member_status(uuid) is
  '対象の構成員の安否を更新してよいか。本人か、アカウントを持たない家族の代理登録に限る（E4）';

revoke all on function public.can_view_member_status(uuid) from public;
revoke all on function public.can_update_member_status(uuid) from public;
grant execute on function public.can_view_member_status(uuid) to authenticated, service_role;
grant execute on function public.can_update_member_status(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- member_statuses（現在の安否）
-- ----------------------------------------------------------------------------
create table public.member_statuses (
  household_member_id uuid primary key
    references public.household_members (id) on delete cascade,
  status public.user_status not null default 'unknown',
  -- 現在地は既定で保存しない。共有を明示的に選んだときだけ埋める（S1）
  mesh_code char(10),
  mesh_level public.mesh_level not null default 'mesh_250m',
  -- 自由記述。「薬が切れそう」など
  message text,
  -- status と別に持つ。避難済みでも支援が要ることがある
  needs_help boolean not null default false,
  -- 最後に状態が変わった時刻。updated_at とは別（表示は「◯分前」で出す）
  status_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_statuses_mesh_code_format
    check (mesh_code is null or mesh_code ~ '^[0-9]{10}$'),
  constraint member_statuses_message_length
    check (message is null or char_length(message) between 1 and 200)
);

comment on table public.member_statuses is
  '構成員ごとの現在の安否（E4）。書き込みは member_status_events のトリガ経由に限る';

create index member_statuses_needs_help_idx
  on public.member_statuses (needs_help)
  where needs_help;

-- ----------------------------------------------------------------------------
-- member_status_events（履歴）
-- ----------------------------------------------------------------------------
create table public.member_status_events (
  id uuid primary key default gen_random_uuid(),
  household_member_id uuid not null
    references public.household_members (id) on delete cascade,
  status public.user_status not null,
  mesh_code char(10),
  message text,
  needs_help boolean not null default false,
  -- 代理登録なら登録した人。本人の登録なら本人
  actor_user_id uuid references public.users (id) on delete set null,
  source public.member_status_source not null default 'self',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint member_status_events_mesh_code_format
    check (mesh_code is null or mesh_code ~ '^[0-9]{10}$'),
  constraint member_status_events_message_length
    check (message is null or char_length(message) between 1 and 200)
);

comment on table public.member_status_events is
  '安否の変化の履歴（E4）。現在値はこのテーブルへの追記からトリガで反映する';

create index member_status_events_member_occurred_at_idx
  on public.member_status_events (household_member_id, occurred_at desc);

-- ----------------------------------------------------------------------------
-- 履歴から現在値を反映するトリガ
-- ----------------------------------------------------------------------------

-- 現在値を直接 UPDATE させず、履歴の追記からしか変わらないようにする。
-- 「いま何なのか」と「なぜそうなったか」が食い違う状態を作らないため。
create or replace function public.apply_member_status_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.member_statuses (
    household_member_id,
    status,
    mesh_code,
    message,
    needs_help,
    status_updated_at,
    updated_at
  )
  values (
    new.household_member_id,
    new.status,
    new.mesh_code,
    new.message,
    new.needs_help,
    new.occurred_at,
    now()
  )
  on conflict (household_member_id) do update
  set status = excluded.status,
      mesh_code = excluded.mesh_code,
      message = excluded.message,
      needs_help = excluded.needs_help,
      status_updated_at = excluded.status_updated_at,
      updated_at = now()
  -- 古い時刻の履歴が後から届いても、現在値を巻き戻さない
  where member_statuses.status_updated_at <= excluded.status_updated_at;

  return new;
end;
$$;

create trigger member_status_events_apply
  after insert on public.member_status_events
  for each row execute function public.apply_member_status_event();

-- ----------------------------------------------------------------------------
-- 権限
-- ----------------------------------------------------------------------------
grant select on public.member_statuses to authenticated;
grant select, insert on public.member_status_events to authenticated;
grant all on public.member_statuses, public.member_status_events to service_role;

notify pgrst, 'reload schema';
