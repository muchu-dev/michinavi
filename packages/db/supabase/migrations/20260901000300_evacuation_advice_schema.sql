-- 避難の選択肢と切り替え基準（BE-19、機能 B1 / B4）。
-- 設計の根拠は docs/er/03-evacuation.md と
-- docs/er/07-safety-moderation.md#プロンプトインジェクションへの対策 に置く。
--
-- AI の出力を 1 つの JSON カラムに投げ込まず、提案（evacuation_advices）、
-- 選択肢（evacuation_options）、切り替え基準（evacuation_switch_criteria）に
-- 正規化する。しきい値を数値カラムとして引けないと、後から観測値と
-- 突き合わせて画面に出せないためである。
--
-- BE-19 の範囲では次を持たない。いずれも参照先のテーブルがまだ無い。
--   - disaster_event_id（災害イベント）
--   - ai_invocation_id（AI 呼び出しの監査ログ）
--   - evacuation_options.shelter_id（避難所。BE-14 で足す）
-- そのため「どの避難所へ」は決めず、「自宅にとどまる / 徒歩で避難 / 車で避難」
-- という移動手段の切り分け（B4）までを扱う。

-- ----------------------------------------------------------------------------
-- ENUM（docs/er/00-conventions.md#enum の一覧をそのまま使う）
-- ----------------------------------------------------------------------------

-- 移動手段（B4）。'none' は移動しないこと自体を選ぶ場合に使う
create type public.travel_mode as enum (
  'walk',
  'car',
  'bicycle',
  'none'
);

-- 選択肢の種類（B1）
create type public.evacuation_option_type as enum (
  'stay_home',
  'designated_shelter',
  'relative_house',
  'vertical',
  'early_move',
  'other'
);

-- 切り替え条件の種類（B1）
create type public.switch_trigger_type as enum (
  'alert_level',
  'rainfall',
  'river_level',
  'daylight',
  'elapsed_time',
  'observation',
  'congestion'
);

-- ----------------------------------------------------------------------------
-- evacuation_advices（提案）
-- ----------------------------------------------------------------------------
create table public.evacuation_advices (
  id uuid primary key default gen_random_uuid(),
  -- 提案を求めたユーザ。世帯が消えれば提案も消えるため cascade で揃える
  user_id uuid not null references public.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  area_id uuid not null references public.areas (id),
  -- 生成時点の自宅位置。世帯の住所が後から変わっても提案の前提は動かさない
  home_mesh_code char(10) not null,
  -- 生成の根拠にした世帯と投稿状況の写し。プロンプトへ渡した値と同じものを入れる。
  -- 要配慮の自由記述（detail）は含めない（docs/er/07-safety-moderation.md）
  input_snapshot jsonb not null,
  -- 全体の見立て（1 行）
  summary text not null,
  -- 選択肢の並びと文面が AI 由来か、決定論的なフォールバックか
  is_ai_generated boolean not null default false,
  generated_at timestamptz not null default now(),
  -- この提案が有効な期限。状況は動くので、古い提案をそのまま出し続けない
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint evacuation_advices_home_mesh_code_format
    check (home_mesh_code ~ '^[0-9]{10}$'),
  constraint evacuation_advices_summary_length
    check (char_length(summary) between 1 and 200),
  constraint evacuation_advices_expires_after_generated
    check (expires_at > generated_at)
);

comment on table public.evacuation_advices is
  '世帯ごとの避難の選択肢の提案（BE-19）。1 回の生成が 1 行';
comment on column public.evacuation_advices.input_snapshot is
  '生成時の世帯構成・移動手段・周辺の投稿状況。後から出力の妥当性を追えるようにする';

create index evacuation_advices_household_id_generated_at_idx
  on public.evacuation_advices (household_id, generated_at desc);
create index evacuation_advices_user_id_idx on public.evacuation_advices (user_id);
create index evacuation_advices_area_id_idx on public.evacuation_advices (area_id);

-- ----------------------------------------------------------------------------
-- evacuation_options（選択肢）
-- ----------------------------------------------------------------------------
create table public.evacuation_options (
  id uuid primary key default gen_random_uuid(),
  evacuation_advice_id uuid not null
    references public.evacuation_advices (id) on delete cascade,
  -- 推奨順。1 が最も勧める選択肢
  rank smallint not null,
  option_type public.evacuation_option_type not null,
  travel_mode public.travel_mode not null,
  title text not null,
  -- なぜこの選択肢か。世帯の条件と周辺の報告から書く
  reason text not null,
  -- この選択肢の弱点。「これを選べば安全」と読ませないために必ず持たせる
  risk_note text,
  estimated_minutes smallint,
  created_at timestamptz not null default now(),
  constraint evacuation_options_rank_range check (rank between 1 and 5),
  constraint evacuation_options_title_length check (char_length(title) between 1 and 40),
  constraint evacuation_options_reason_length check (char_length(reason) between 1 and 200),
  constraint evacuation_options_risk_note_length
    check (risk_note is null or char_length(risk_note) between 1 and 200),
  constraint evacuation_options_estimated_minutes_range
    check (estimated_minutes is null or estimated_minutes between 0 and 600),
  -- 同じ提案の中で推奨順は重複しない
  constraint evacuation_options_rank_uniq unique (evacuation_advice_id, rank),
  -- 切り替え基準の参照先を提案内に閉じるための複合キー
  constraint evacuation_options_advice_uniq unique (id, evacuation_advice_id)
);

comment on table public.evacuation_options is
  '1 つの提案に含まれる選択肢（B1）。避難所の指定（shelter_id）は BE-14 で足す';
comment on column public.evacuation_options.risk_note is
  'この選択肢の弱点。選択肢を「正解」として読ませないために置く';

create index evacuation_options_advice_id_rank_idx
  on public.evacuation_options (evacuation_advice_id, rank);

-- ----------------------------------------------------------------------------
-- evacuation_switch_criteria（切り替え基準）
-- ----------------------------------------------------------------------------
create table public.evacuation_switch_criteria (
  id uuid primary key default gen_random_uuid(),
  evacuation_option_id uuid not null
    references public.evacuation_options (id) on delete cascade,
  -- 参照の整合のため、親の選択肢と同じ提案に属することを複合外部キーで保証する
  evacuation_advice_id uuid not null,
  trigger_type public.switch_trigger_type not null,
  -- 「1時間雨量が30mmを超えたら」のような、画面にそのまま出す文
  description text not null,
  -- しきい値。数値で持たないと後から観測値と突き合わせられない
  threshold_value numeric(8, 2),
  threshold_unit text,
  comparator text,
  -- 切り替え先の選択肢。同じ提案の中の選択肢だけを指せる
  switch_to_option_id uuid,
  display_order smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint evacuation_switch_criteria_description_length
    check (char_length(description) between 1 and 200),
  constraint evacuation_switch_criteria_comparator_values
    check (comparator is null or comparator in ('gte', 'lte')),
  -- しきい値は「値・単位・比較」が揃っているか、3 つとも無いかのどちらかにする。
  -- 単位の無い数値は画面に出せず、比較の向きが無い数値は判断に使えない
  constraint evacuation_switch_criteria_threshold_complete
    check (
      (threshold_value is null and threshold_unit is null and comparator is null)
      or (threshold_value is not null and threshold_unit is not null and comparator is not null)
    ),
  constraint evacuation_switch_criteria_option_fk
    foreign key (evacuation_option_id, evacuation_advice_id)
    references public.evacuation_options (id, evacuation_advice_id) on delete cascade,
  -- 切り替え先の選択肢だけが消えた場合は参照を外す。
  -- 列を指定しない SET NULL は evacuation_advice_id まで NULL にしようとして
  -- NOT NULL 違反になるため、対象の列を明示する（PostgreSQL 15 以降）
  constraint evacuation_switch_criteria_switch_to_fk
    foreign key (switch_to_option_id, evacuation_advice_id)
    references public.evacuation_options (id, evacuation_advice_id)
    on delete set null (switch_to_option_id)
);

comment on table public.evacuation_switch_criteria is
  '選択肢を切り替える基準（B1）。しきい値は表示のための値であり、'
  'これを条件に何かを自動実行しない（docs/er/07-safety-moderation.md）';

create index evacuation_switch_criteria_option_id_idx
  on public.evacuation_switch_criteria (evacuation_option_id, display_order);
create index evacuation_switch_criteria_switch_to_option_id_idx
  on public.evacuation_switch_criteria (switch_to_option_id);

-- ----------------------------------------------------------------------------
-- 権限
-- ----------------------------------------------------------------------------
-- 読むのは世帯の構成員だけ（RLS で絞る）。
-- 書き込みのポリシーは作らず、save_evacuation_advice（security definer）だけが書く
grant select on
  public.evacuation_advices,
  public.evacuation_options,
  public.evacuation_switch_criteria
  to authenticated;
grant all on
  public.evacuation_advices,
  public.evacuation_options,
  public.evacuation_switch_criteria
  to service_role;
