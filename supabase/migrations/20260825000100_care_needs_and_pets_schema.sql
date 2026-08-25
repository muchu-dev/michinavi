-- 要配慮とペットの拡張テーブル。
-- 設計の根拠は docs/er/00-conventions.md と docs/er/01-account-household.md に置く。

-- ----------------------------------------------------------------------------
-- ENUM
-- ----------------------------------------------------------------------------
create type public.pet_species as enum (
  'dog',
  'cat',
  'small_animal',
  'bird',
  'reptile',
  'other'
);

create type public.pet_size as enum (
  'small',
  'medium',
  'large'
);

-- ----------------------------------------------------------------------------
-- care_needs（要配慮マスタ）
-- ----------------------------------------------------------------------------
create table public.care_needs (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  display_order smallint not null default 0,
  is_active boolean not null default true
);

comment on table public.care_needs is
  '要配慮の種類のマスタ。運営が画面から増減できるよう ENUM ではなくテーブルにする';

insert into public.care_needs (key, label, display_order) values
  ('wheelchair', '車いす', 1),
  ('walking_difficulty', '歩行が困難', 2),
  ('visual_impairment', '視覚の障害', 3),
  ('hearing_impairment', '聴覚の障害', 4),
  ('medical_device', '医療機器や電源が必要', 5),
  ('chronic_illness', '持病や常備薬がある', 6),
  ('pregnant', '妊娠中', 7),
  ('infant_care', '授乳やおむつが必要', 8),
  ('dementia', '認知症', 9),
  ('language_support', '日本語での案内が難しい', 10)
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- household_member_care_needs（構成員 × 要配慮）
-- ----------------------------------------------------------------------------
create table public.household_member_care_needs (
  household_member_id uuid not null references public.household_members (id) on delete cascade,
  care_need_id uuid not null references public.care_needs (id),
  -- 薬の名前など。機微性が高いため AI への入力からは除く
  detail text,
  primary key (household_member_id, care_need_id)
);

comment on table public.household_member_care_needs is
  '構成員ごとの要配慮。detail は自由記述で AI の入力ログから除く（docs/er/07-safety-moderation.md）';

create index household_member_care_needs_care_need_id_idx
  on public.household_member_care_needs (care_need_id);

-- ----------------------------------------------------------------------------
-- pets（ペット）
-- ----------------------------------------------------------------------------
create table public.pets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  species public.pet_species not null,
  size public.pet_size not null,
  count smallint not null default 1,
  -- 避難所の受入条件がほぼ「ケージに入れられること」を前提にしている
  is_crate_trained boolean not null default false,
  note text,
  constraint pets_count_positive check (count > 0)
);

comment on table public.pets is
  '世帯のペット。避難所の受入条件（D2）との突き合わせに使う';

create index pets_household_id_idx on public.pets (household_id);

-- ----------------------------------------------------------------------------
-- 権限
-- ----------------------------------------------------------------------------
grant select on public.care_needs to anon, authenticated;
grant select, insert, update, delete on public.household_member_care_needs to authenticated;
grant select, insert, update, delete on public.pets to authenticated;
grant all on public.care_needs, public.household_member_care_needs, public.pets
  to service_role;

-- PostgREST のスキーマキャッシュを更新する
notify pgrst, 'reload schema';
