-- 同一地点（mesh_code）の現地報告を 1 枚のカードにまとめた要約（BE-18）。
-- 設計の根拠は docs/tasks/all-tasks.md の BE-18 と、
-- docs/er/04-field-report.md、docs/er/07-safety-moderation.md に置く。
--
-- road_status_estimates（BE-16）が「その地点は結局どの状態か」を 1 つ決めるのに対し、
-- こちらは「その 1 件の裏に何件・何人の報告があり、うち何件が重複だったか」を持つ。
-- 画面はこのテーブルだけを読めばカードを描けるようにし、
-- 一覧の描画のたびに field_reports を集計し直さない。
--
-- 更新の契機は BE-16 と同じく投稿（field_reports の INSERT）のときだけで、
-- 対象の mesh_code の行だけを上書きする。

create table public.field_report_digests (
  -- 1 mesh_code につき 1 行。これが画面の 1 カードに対応する
  mesh_code char(10) primary key,
  -- カードの見出しになる代表的な状態。
  -- BE-16 の推定があればそれを、無ければ重複統合後の多数決の結果を入れる
  road_condition public.road_condition not null,
  -- 重複統合後の有効な報告数（カードに「◯件の報告」として出す）
  report_count smallint not null,
  -- 重複として畳んだ報告数。統合が効いていることを画面で示すために持つ
  merged_count smallint not null default 0,
  -- 重複統合後に残った報告の投稿者の実人数。
  -- 同じ 1 人が何度も投稿した地点と、別々の人が報告した地点を画面で区別する
  reporter_count smallint not null,
  -- 状態ごとの内訳。合計は report_count と一致する
  passable_count smallint not null default 0,
  caution_count smallint not null default 0,
  impassable_count smallint not null default 0,
  -- 統合後の最新の報告時刻。カードの「◯分前」の元になる
  latest_reported_at timestamptz not null,
  -- カードに出す一言の要約。AI の出力、または統合結果から組み立てた固定文
  summary text not null,
  -- 要約が AI 由来か、フォールバックの定型文か。画面で出し分けられるようにする
  is_ai_summary boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint field_report_digests_mesh_code_format
    check (mesh_code ~ '^[0-9]{10}$'),
  constraint field_report_digests_report_count_positive
    check (report_count > 0),
  constraint field_report_digests_merged_count_non_negative
    check (merged_count >= 0),
  -- 実人数が報告数を超えることはない（1 人が 0 件の報告をすることは無いため）
  constraint field_report_digests_reporter_count_range
    check (reporter_count > 0 and reporter_count <= report_count),
  constraint field_report_digests_breakdown_matches
    check (passable_count + caution_count + impassable_count = report_count),
  constraint field_report_digests_summary_length
    check (char_length(summary) between 1 and 200)
);

comment on table public.field_report_digests is
  '同一 mesh_code の現地報告を 1 件にまとめた要約（BE-18）。投稿時にだけ再計算する';
comment on column public.field_report_digests.merged_count is
  '同じ投稿者の短時間の連投など、重複として畳んだ報告数';
comment on column public.field_report_digests.road_condition is
  'BE-16 の推定を優先し、無ければ重複統合後の多数決で決めた代表的な状態';

-- カードは新しい報告のあった地点から並べる
create index field_report_digests_latest_reported_at_idx
  on public.field_report_digests (latest_reported_at desc);

-- 広域から絞り込むときの前方一致（docs/er/00-conventions.md#インデックスの方針）
create index field_report_digests_mesh_code_idx
  on public.field_report_digests (mesh_code bpchar_pattern_ops);

-- ----------------------------------------------------------------------------
-- 権限
-- ----------------------------------------------------------------------------
-- 書き込みは service role だけ（ポリシーを作らない。road_status_estimates と同じ扱い）
grant select on public.field_report_digests to anon, authenticated;
grant all on public.field_report_digests to service_role;
