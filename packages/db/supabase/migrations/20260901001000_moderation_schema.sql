-- 通報と運営の措置（BE-24、機能 S4）。
-- 設計の根拠は docs/er/07-safety-moderation.md と docs/er/04-field-report.md に置く。
--
-- 通報（content_flags）と措置（moderation_actions）を分ける。
-- 「誰が何を問題だと言ったか」と「運営が何をしたか」は別の事実で、
-- 通報を経ない自発的な措置もあるためである。
--
-- 非表示は field_reports.status の更新として表す。ただし status を直接
-- 書き換える経路は作らず、措置の行を足した結果としてトリガが更新する。
-- 状態を持つ列だけを見て「なぜ非表示になったか」が分からない状態を避ける。

-- ----------------------------------------------------------------------------
-- ENUM（docs/er/00-conventions.md#enum の一覧をそのまま使う）
-- ----------------------------------------------------------------------------

-- 投稿の状態。BE-24 で使うのは 'active' と 'hidden' の 2 つ
create type public.report_status as enum (
  'active',
  'resolved',
  'expired',
  'hidden'
);

-- 通報の対象種別。BE-24 の範囲では 'field_report' だけを受け付ける
create type public.flag_target_type as enum (
  'field_report',
  'community_post',
  'community_comment',
  'user'
);

-- 通報の理由
create type public.flag_reason as enum (
  'false_info',
  'privacy',
  'spam',
  'abuse',
  'other'
);

-- 通報の処理状態
create type public.flag_status as enum (
  'open',
  'reviewing',
  'actioned',
  'dismissed'
);

-- 運営が取った措置
create type public.moderation_action as enum (
  'hide',
  'restore',
  'delete',
  'warn',
  'suspend'
);

-- ----------------------------------------------------------------------------
-- 運営かどうかの判定
-- ----------------------------------------------------------------------------

-- 運営権限は users の列ではなく JWT のカスタムクレームで判定する
-- （docs/er/07-safety-moderation.md#ポリシーの一覧）。
-- 列で持つと、その列を更新できる経路が一つでもあれば権限昇格になる。
-- app_metadata は Supabase Auth の管理 API からしか書けないため、
-- 利用者自身が付け替えることはできない。
create or replace function public.is_moderator()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    auth.jwt() -> 'app_metadata' ->> 'app_role' = 'moderator',
    false
  );
$$;

comment on function public.is_moderator() is
  '呼び出し元が運営ロールか。JWT の app_metadata.app_role で判定する（S4）';

revoke all on function public.is_moderator() from public;
grant execute on function public.is_moderator() to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- field_reports に状態を足す
-- ----------------------------------------------------------------------------
alter table public.field_reports
  add column status public.report_status not null default 'active';

comment on column public.field_reports.status is
  '運営の措置による表示状態（S4）。投稿者は更新できず、moderation_actions のトリガだけが変える';

-- 地図と一覧は「有効な投稿」で引く（docs/er/00-conventions.md#インデックスの方針）
create index field_reports_status_created_at_idx
  on public.field_reports (status, created_at desc)
  where deleted_at is null;

-- ----------------------------------------------------------------------------
-- content_flags（通報）
-- ----------------------------------------------------------------------------
create table public.content_flags (
  id uuid primary key default gen_random_uuid(),
  target_type public.flag_target_type not null,
  -- 対象が 4 つのテーブルにまたがるため外部キーは張らない
  -- （docs/er/07-safety-moderation.md#content_flags通報）。
  -- 参照整合性は、対象の削除を論理削除に限る運用で担保する
  target_id uuid not null,
  reporter_user_id uuid not null references public.users (id) on delete cascade,
  reason public.flag_reason not null,
  -- 通報者の補足。運営だけが読む
  detail text,
  status public.flag_status not null default 'open',
  resolved_by uuid references public.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_flags_detail_length
    check (detail is null or char_length(detail) between 1 and 200),
  -- 同じ人が同じ対象を何度も通報できない
  constraint content_flags_reporter_uniq
    unique (target_type, target_id, reporter_user_id),
  -- 解決の記録は「日時と担当者」が揃っているか、両方無いかのどちらか
  constraint content_flags_resolution_complete
    check (
      (resolved_at is null and resolved_by is null)
      or (resolved_at is not null and resolved_by is not null)
    )
);

comment on table public.content_flags is
  '不適切な内容の申告（S4）。住民の投稿そのものは field_reports で、名前を分けている';

create index content_flags_target_idx
  on public.content_flags (target_type, target_id);
create index content_flags_status_created_at_idx
  on public.content_flags (status, created_at desc);
create index content_flags_reporter_user_id_idx
  on public.content_flags (reporter_user_id);

create trigger content_flags_set_updated_at
  before update on public.content_flags
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- moderation_actions（措置）
-- ----------------------------------------------------------------------------
create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  -- 通報を経ない自発的な措置もあるため NULL 可
  content_flag_id uuid references public.content_flags (id) on delete set null,
  moderator_user_id uuid not null references public.users (id) on delete restrict,
  target_type public.flag_target_type not null,
  target_id uuid not null,
  action public.moderation_action not null,
  -- なぜその措置を取ったか。後から見直すために必須にする
  reason text not null,
  created_at timestamptz not null default now(),
  constraint moderation_actions_reason_length
    check (char_length(reason) between 1 and 200)
);

comment on table public.moderation_actions is
  '運営が取った措置の記録（S4）。追記のみで、対象の状態はトリガが反映する';

create index moderation_actions_target_idx
  on public.moderation_actions (target_type, target_id, created_at desc);
create index moderation_actions_content_flag_id_idx
  on public.moderation_actions (content_flag_id);
create index moderation_actions_moderator_user_id_idx
  on public.moderation_actions (moderator_user_id);

-- ----------------------------------------------------------------------------
-- 措置を対象へ反映するトリガ
-- ----------------------------------------------------------------------------

-- 措置の行が入ったら、対象の投稿の状態と、元になった通報の状態を更新する。
-- Router 側で 3 つの UPDATE を並べず、1 つの INSERT に対する副作用としてまとめる。
-- security definer にするのは、field_reports に UPDATE のポリシーを
-- 一切作らない方針（投稿者にも status を触らせない）を保つためである。
create or replace function public.apply_moderation_action()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.target_type = 'field_report' then
    if new.action = 'hide' then
      update public.field_reports
      set status = 'hidden'
      where id = new.target_id;
    elsif new.action = 'restore' then
      update public.field_reports
      set status = 'active',
          deleted_at = null
      where id = new.target_id;
    elsif new.action = 'delete' then
      -- 物理削除はしない。通報履歴と突き合わせられなくなるため
      -- （docs/er/00-conventions.md#共通カラム）
      update public.field_reports
      set status = 'hidden',
          deleted_at = coalesce(deleted_at, now())
      where id = new.target_id;
    end if;

    if not found and new.action in ('hide', 'restore', 'delete') then
      raise exception '対象の投稿が見つかりません'
        using errcode = 'P0002';
    end if;
  end if;

  -- 元になった通報があれば、対処済みとして閉じる
  if new.content_flag_id is not null then
    update public.content_flags
    set status = (
          case when new.action = 'restore' then 'dismissed' else 'actioned' end
        )::public.flag_status,
        resolved_by = new.moderator_user_id,
        resolved_at = now()
    where id = new.content_flag_id;
  end if;

  -- 同じ対象への未処理の通報も、同じ措置で閉じる。
  -- 1 つの投稿に複数の通報が付くのが普通で、1 件ずつ閉じさせると取りこぼす
  update public.content_flags
  set status = (
        case when new.action = 'restore' then 'dismissed' else 'actioned' end
      )::public.flag_status,
      resolved_by = new.moderator_user_id,
      resolved_at = now()
  where target_type = new.target_type
    and target_id = new.target_id
    and status in ('open', 'reviewing');

  return new;
end;
$$;

create trigger moderation_actions_apply
  after insert on public.moderation_actions
  for each row execute function public.apply_moderation_action();

-- ----------------------------------------------------------------------------
-- 権限
-- ----------------------------------------------------------------------------
grant select, insert on public.content_flags to authenticated;
grant update on public.content_flags to authenticated;
grant select, insert on public.moderation_actions to authenticated;
grant all on public.content_flags, public.moderation_actions to service_role;

-- PostgREST のスキーマキャッシュを更新する
notify pgrst, 'reload schema';
