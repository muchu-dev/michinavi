-- 投稿のレート制限（BE-23、機能 S3）。
-- 設計の根拠は docs/er/07-safety-moderation.md#レート制限 に置く。
--
-- 上限をコードに埋めずマスタテーブルに持つのは、運用中に調整する値だからである。
-- 加算と本体の INSERT は 1 つの DB 関数にまとめる。例外を投げるとトランザクションが
-- 巻き戻り、加算も取り消される。つまり count は「成功した投稿の回数」を数える。

-- ----------------------------------------------------------------------------
-- ENUM
-- ----------------------------------------------------------------------------
create type public.rate_limit_action as enum (
  'field_report',
  'confirmation',
  'community_post',
  'content_flag'
);

create type public.rate_limit_scope as enum (
  'hour',
  'day'
);

-- ----------------------------------------------------------------------------
-- 本人確認の段階を初期化する
-- ----------------------------------------------------------------------------

-- 上限は verification_level ごとに変わる（S3）。anonymous の上限は 0 なので、
-- users の行を作った時点で段階を決めておかないと誰も投稿できない。
-- メールの確認が済んでいるかは auth.users にしか無いため、security definer で読む。
create or replace function public.set_initial_verification_level()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from auth.users u
    where u.id = new.id
      and u.email_confirmed_at is not null
  ) then
    new.verification_level := 'email';
  end if;

  return new;
end;
$$;

comment on function public.set_initial_verification_level() is
  'users の作成時に、メール確認済みなら verification_level を email にする（S3）';

create trigger users_set_initial_verification_level
  before insert on public.users
  for each row execute function public.set_initial_verification_level();

-- すでに作られている行にも同じ規則を当てる
update public.users u
set verification_level = 'email'
where u.verification_level = 'anonymous'
  and exists (
    select 1
    from auth.users a
    where a.id = u.id
      and a.email_confirmed_at is not null
  );

-- ----------------------------------------------------------------------------
-- rate_limits（上限のマスタ）
-- ----------------------------------------------------------------------------
create table public.rate_limits (
  action public.rate_limit_action not null,
  scope public.rate_limit_scope not null,
  level public.verification_level not null,
  max_count integer not null,
  updated_at timestamptz not null default now(),
  primary key (action, scope, level),
  constraint rate_limits_max_count_non_negative check (max_count >= 0)
);

comment on table public.rate_limits is
  '操作ごとの上限（S3）。運用中に調整するためコードではなくテーブルに持つ';

-- docs/er/07-safety-moderation.md#レート制限 の表をそのまま入れる
insert into public.rate_limits (action, scope, level, max_count) values
  ('field_report', 'hour', 'anonymous', 0),
  ('field_report', 'hour', 'email', 5),
  ('field_report', 'hour', 'phone', 20),
  ('field_report', 'day', 'anonymous', 0),
  ('field_report', 'day', 'email', 20),
  ('field_report', 'day', 'phone', 100),
  ('confirmation', 'hour', 'anonymous', 0),
  ('confirmation', 'hour', 'email', 20),
  ('confirmation', 'hour', 'phone', 60),
  ('confirmation', 'day', 'anonymous', 0),
  ('confirmation', 'day', 'email', 60),
  ('confirmation', 'day', 'phone', 300),
  ('community_post', 'hour', 'anonymous', 0),
  ('community_post', 'hour', 'email', 3),
  ('community_post', 'hour', 'phone', 10),
  ('community_post', 'day', 'anonymous', 0),
  ('community_post', 'day', 'email', 10),
  ('community_post', 'day', 'phone', 40),
  ('content_flag', 'day', 'anonymous', 0),
  ('content_flag', 'day', 'email', 5),
  ('content_flag', 'day', 'phone', 20)
on conflict (action, scope, level) do nothing;

create trigger rate_limits_set_updated_at
  before update on public.rate_limits
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- rate_limit_counters（実績）
-- ----------------------------------------------------------------------------
create table public.rate_limit_counters (
  user_id uuid not null references public.users (id) on delete cascade,
  action public.rate_limit_action not null,
  scope public.rate_limit_scope not null,
  -- UTC 基準の date_trunc(scope, now())
  window_start timestamptz not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, action, scope, window_start),
  constraint rate_limit_counters_count_non_negative check (count >= 0)
);

comment on table public.rate_limit_counters is
  '窓ごとの成功回数（S3）。上限を超えた試行は巻き戻るため記録されない';

-- 窓を過ぎた行は日次で削除する（docs/er/00-conventions.md#保持期間）
create index rate_limit_counters_window_start_idx
  on public.rate_limit_counters (window_start);

-- ----------------------------------------------------------------------------
-- 投稿とレート制限をまとめた関数
-- ----------------------------------------------------------------------------

-- 投稿の INSERT とカウンタの加算を 1 トランザクションにまとめる
-- （docs/er/00-conventions.md#トランザクションの境界）。
-- 対象のユーザは auth.uid() から解決し、入力の user_id は使わない。
create or replace function public.create_field_report(
  p_mesh_code text,
  p_road_condition public.road_condition
)
returns table (
  id uuid,
  mesh_code text,
  road_condition public.road_condition,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_level public.verification_level;
  v_scope public.rate_limit_scope;
  v_count integer;
  v_max integer;
  v_id uuid;
  v_created_at timestamptz;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception '投稿には認証が必要です'
      using errcode = '28000';
  end if;

  select u.verification_level into v_level
  from public.users u
  where u.id = v_user_id;

  if v_level is null then
    -- public.users がまだ無い（初期登録前）
    raise exception '先に初期登録を行ってください'
      using errcode = '23503';
  end if;

  -- 時間窓ごとに加算し、上限を超えていたら例外で巻き戻す
  foreach v_scope in array array['hour', 'day']::public.rate_limit_scope[]
  loop
    insert into public.rate_limit_counters (user_id, action, scope, window_start, count)
    values (
      v_user_id,
      'field_report',
      v_scope,
      date_trunc(v_scope::text, now()),
      1
    )
    on conflict (user_id, action, scope, window_start)
      do update set count = rate_limit_counters.count + 1,
                    updated_at = now()
    returning rate_limit_counters.count into v_count;

    select rl.max_count into v_max
    from public.rate_limits rl
    where rl.action = 'field_report'
      and rl.scope = v_scope
      and rl.level = v_level;

    if v_count > coalesce(v_max, 0) then
      -- 例外でトランザクションごと巻き戻るので、この加算も無かったことになる。
      -- count は成功した投稿の回数だけを数える
      raise exception '投稿の回数が上限に達しました（% あたり % 件）', v_scope, coalesce(v_max, 0)
        using errcode = 'P0001';
    end if;
  end loop;

  insert into public.field_reports (user_id, report_type, road_condition, mesh_code)
  values (v_user_id, 'road', p_road_condition, p_mesh_code)
  returning field_reports.id, field_reports.created_at
  into v_id, v_created_at;

  return query select v_id, p_mesh_code, p_road_condition, v_created_at;
end;
$$;

comment on function public.create_field_report(text, public.road_condition) is
  '現地報告の投稿。レート制限の加算と INSERT を 1 トランザクションで行う（BE-11 / S3）';

revoke all on function public.create_field_report(text, public.road_condition) from public;
grant execute on function public.create_field_report(text, public.road_condition)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 権限
-- ----------------------------------------------------------------------------
grant select on public.rate_limits to anon, authenticated;
grant select on public.rate_limit_counters to authenticated;
grant all on public.rate_limits, public.rate_limit_counters to service_role;

notify pgrst, 'reload schema';
