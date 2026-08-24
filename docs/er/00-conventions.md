# 共通規約

すべてのドメインの設計が前提にする命名、型、共通カラム、位置情報の扱い、ENUM の一覧、削除規則と保持期間をここにまとめる。
個別のテーブル定義は [ドメイン別のファイル](../ER-Diagram.md#ファイル構成)を参照。

## 前提とする基盤

| 項目 | 内容 |
| --- | --- |
| DBMS | PostgreSQL 17（Supabase） |
| 認証 | Supabase Auth（`auth.users`） |
| 拡張 | `pgcrypto`（UUID 生成、HMAC）、`postgis`（避難所と地区の空間データ） |
| マイグレーション | `supabase/migrations/` に SQL を置き、`supabase db push` で適用 |

## DB クライアントの使い分け

Supabase の service role キーは RLS を迂回する。
Router がすべての問い合わせで service role を使うと、RLS は 1 行も評価されず、S6 は Router の実装だけに依存することになる。
そこでクライアントを二つに分け、既定を JWT 側にする。

| クライアント | 使う場面 | RLS |
| --- | --- | --- |
| ユーザの JWT を引き継ぐクライアント | 画面からの読み書き全般 | 効く |
| service role クライアント | マスタ取り込み、AI 出力の保存、通知の作成、モデレーションの措置、日次バッチ | 迂回する |

service role を使う処理では、クライアントから受け取った `household_id` や `user_id` を条件に使わない。
`auth.uid()` から対象を解決してから書き込む。
入力された ID をそのまま使うと、RLS を迂回している分だけ他世帯への書き込みがそのまま通る。

運用面では次の二つで守る。

- service role クライアントを生成するモジュールを 1 ファイルに閉じ、そこからの import 元を CI で検査する。許可リストに無いファイルが import していたら落とす。
- service role を使う関数には、対象を `auth.uid()` から解決していることを示すテストを必ず添える。

RLS を第一の防壁、Router 側の検査を第二の防壁とする。
どちらか片方だけで守る設計にはしない。

## 命名規則

- テーブル名は複数形のスネークケースにする（`households`、`field_reports`）。
- 中間テーブルは「親_子」の順で並べる（`household_member_care_needs`）。
- 外部キーカラムは「参照先の単数形 + `_id`」にする（`household_id`）。ただし同じテーブルを複数の意味で参照する場合は意味を接頭辞にする（`observed_area_id`、`reporter_area_id`）。
- 真偽値は `is_` または `has_` で始める（`is_primary`）。
- 時刻カラムは過去分詞 + `_at` にする（`created_at`、`resolved_at`）。
- ビューは `v_` を接頭辞にする（`v_shelter_load`）。
- ENUM 型は単数形にする（`travel_mode`）。

**通報**と**投稿**はどちらも英語で report と訳せてしまうため、名前を分ける。
住民が地図に上げる現地の情報は `field_reports`、不適切な内容の申告は `content_flags` と呼ぶ。

## 共通カラム

| カラム | 型 | 内容 |
| --- | --- | --- |
| `id` | `uuid` | 主キー。既定値は `gen_random_uuid()`。全テーブル共通 |
| `created_at` | `timestamptz` | 作成時刻。既定値は `now()` |
| `updated_at` | `timestamptz` | 更新時刻。トリガ関数 `set_updated_at()` で更新する |
| `deleted_at` | `timestamptz` | 論理削除時刻。住民が投稿するテーブルにだけ持たせる |

主キーを `uuid` にするのは、クライアント側で ID を先に採番してから投稿を送れるようにするためと、連番から他人のデータ量や件数を推測されないようにするためである。

論理削除を入れるのは `field_reports`、`community_posts`、`community_comments`、`users` に限る。
通報された投稿は運営が非表示にした後も内容を確認する必要があり（S4）、物理削除すると通報履歴と突き合わせられなくなる。
それ以外のテーブルは物理削除でよい。

## NULL の方針

NOT NULL を既定とし、NULL は「値が無い」ではなく「不明である」を表す場合にだけ許す。
`shelters.capacity` の NULL は「収容人数が公開データに無い」を意味し、0 とは区別する。
文字列の「値なし」を空文字で表さない。NULL と空文字が混在すると条件が二重になる。

## 時刻とタイムゾーン

時刻はすべて `timestamptz` で保存し、DB のセッションタイムゾーンは UTC に固定する。
JST への変換は表示層で行う。
災害時は分単位の前後関係が意味を持つため、「いつの情報か」を表すカラム（現地報告の `observed_at`、警戒情報の `issued_at`）と、「いつ登録されたか」を表す `created_at` を必ず別に持つ。

## 位置情報の扱い

個人が投稿する位置は緯度経度のまま保存せず、日本の**地域メッシュ**の区画コードに丸めてから保存する（S1）。
メッシュは総務省の統計に使われる区画で、コードの桁数が細かさに対応する。

| メッシュ次数 | 桁数 | 一辺の目安 | みちナビでの用途 |
| --- | --- | --- | --- |
| 基準地域メッシュ（3次） | 8 | 約 1km | 広域の集計 |
| 2分の1地域メッシュ | 9 | 約 500m | 予備 |
| 4分の1地域メッシュ | 10 | 約 250m | 投稿位置、自宅位置の既定値 |
| 8分の1地域メッシュ | 11 | 約 125m | 市街地で細かさが要るとき |

自宅位置と投稿位置は 10 桁の 4分の1地域メッシュを既定とする。
どの次数で丸めたかを後から判別できるよう、メッシュコードを持つテーブルには `mesh_level` を併置する。

丸めるのは保存の段階に限る。
正確な座標は、リクエストの処理中にメモリ上で使ってよい。
経路探索は道路網との対応づけに数 m の精度を要求するため、丸めた値だけでは計算できない（[05](05-route.md#座標の扱い)）。
保存の直前に変換し、リクエストが終わったら破棄する。

保存前に丸めるのは、正確な座標がカラムに残ると、ログ出力、管理画面、権限設定の誤り、バックアップの持ち出しといった複数の経路から取り出せる状態になるためである。
表示のたびに丸める方式では、これらの経路に対して何の防御にもならない。

一方、避難所と地区の境界は公開情報なので丸めない。
`shelters.location` は `geography(Point, 4326)`、`areas.boundary` は `geometry(MultiPolygon, 4326)` で保持し、距離計算と地区判定に使う。

メッシュコードから区画中心の緯度経度を求める関数 `mesh_to_center(text)` と、座標からメッシュコードを求める `mesh_from_point(geography, mesh_level)` を SQL 関数として用意する。
中心座標をカラムとして持たせないのは、丸めた値とほどいた値が二重に存在すると、片方だけを更新したときに食い違うためである。

## ENUM

値の追加が本番運用中に頻発しないものは PostgreSQL の ENUM 型にする。
運営が画面から増減させたいもの（要配慮の種類、避難所の受入条件）はマスタテーブルにする。

### 世帯とユーザ

| 型 | 値 | 意味 |
| --- | --- | --- |
| `age_group` | `infant` / `child` / `adult` / `senior` | 未就学（0-5）／ 就学-中学（6-14）／ 成人（15-64）／ 高齢（65-） |
| `pet_species` | `dog` / `cat` / `small_animal` / `bird` / `reptile` / `other` | ペットの種別 |
| `pet_size` | `small` / `medium` / `large` | ペットの大きさ |
| `verification_level` | `anonymous` / `email` / `phone` | 本人確認の段階（S3） |
| `mesh_level` | `mesh_1km` / `mesh_500m` / `mesh_250m` / `mesh_125m` | メッシュの丸め次数 |

### 災害と避難

| 型 | 値 | 意味 |
| --- | --- | --- |
| `hazard_type` | `flood` / `inland_flood` / `landslide` / `storm_surge` / `tsunami` / `earthquake` / `fire` | 洪水 ／ 内水氾濫 ／ 土砂災害 ／ 高潮 ／ 津波 ／ 地震 ／ 大規模火事 |
| `alert_kind` | `elderly_evacuation` / `evacuation_order` / `emergency_safety` / `heavy_rain_warning` / `flood_warning` / `landslide_alert` / `river_danger` | 高齢者等避難 ／ 避難指示 ／ 緊急安全確保 ／ 大雨警報 ／ 洪水警報 ／ 土砂災害警戒情報 ／ 氾濫危険情報 |
| `travel_mode` | `walk` / `car` / `bicycle` / `none` | 徒歩 ／ 車 ／ 自転車 ／ 移動しない（B4） |
| `evacuation_option_type` | `stay_home` / `designated_shelter` / `relative_house` / `vertical` / `early_move` / `other` | 在宅避難 ／ 指定避難所 ／ 親戚知人宅 ／ 垂直避難 ／ 早期の水平避難 ／ その他 |
| `switch_trigger_type` | `alert_level` / `rainfall` / `river_level` / `daylight` / `elapsed_time` / `observation` / `congestion` | 切り替え条件の種類（B1） |
| `evacuation_status` | `planned` / `preparing` / `moving` / `arrived` / `returned` / `canceled` | 避難行動の進行状態 |

### 避難所

| 型 | 値 | 意味 |
| --- | --- | --- |
| `shelter_category` | `emergency_site` / `designated_shelter` / `welfare_shelter` / `temporary` / `other` | 指定緊急避難場所 ／ 指定避難所 ／ 福祉避難所 ／ 一時避難場所 ／ その他 |
| `acceptance_status` | `available` / `limited` / `unavailable` / `unknown` | 受入可 ／ 条件付き ／ 不可 ／ 不明（D2） |

### 投稿と地図

| 型 | 値 | 意味 |
| --- | --- | --- |
| `field_report_type` | `road` / `hazard` / `shop` / `other` | 通行可否 ／ 危険箇所 ／ 店舗の営業（E2 相当） ／ その他 |
| `road_condition` | `passable` / `caution` / `impassable` | 通れる ／ 注意が要る ／ 通れない（C3） |
| `severity` | `low` / `medium` / `high` | 危険度（C4） |
| `report_status` | `active` / `resolved` / `expired` / `hidden` | 有効 ／ 解消済み ／ 期限切れ ／ 運営が非表示 |
| `vote_type` | `confirm` / `deny` | 「同じだった」／「違った」（E3） |
| `congestion_level` | `free` / `slow` / `heavy` / `blocked` | 交通の混み具合（C1） |

### コミュニティと安全

| 型 | 値 | 意味 |
| --- | --- | --- |
| `community_category` | `info` / `help_request` / `help_offer` / `shop` / `other` | 投稿の種類（E1） |
| `user_status` | `unknown` / `safe_home` / `preparing` / `evacuating` / `at_shelter` / `needs_help` / `safe_other` | 安否と避難の状況（E4） |
| `status_share_scope` | `household` / `family` / `none` | 安否を誰に見せるか。`users.status_share_scope` と `household_members.proxy_share_scope` で使う（E5） |
| `flag_target_type` | `field_report` / `community_post` / `community_comment` / `user` | 通報の対象種別（S4） |
| `flag_reason` | `false_info` / `privacy` / `spam` / `abuse` / `other` | 誤情報 ／ 個人情報 ／ 宣伝 ／ 迷惑行為 ／ その他 |
| `flag_status` | `open` / `reviewing` / `actioned` / `dismissed` | 未対応 ／ 確認中 ／ 対処済み ／ 対処不要 |
| `moderation_action` | `hide` / `restore` / `delete` / `warn` / `suspend` | 運営が取った措置 |
| `rate_limit_scope` | `hour` / `day` | レート制限の時間窓（S3） |
| `rate_limit_action` | `field_report` / `confirmation` / `community_post` / `content_flag` | 制限の対象操作 |
| `ai_feature` | `evacuation_advice` / `route_explanation` / `checklist_summary` | AI 呼び出しの用途（S5） |

## 外部キーの削除規則

| 参照 | ON DELETE | 理由 |
| --- | --- | --- |
| `users` → `auth.users` | CASCADE | 認証側の削除に追随する |
| `household_members` / `pets` / `household_invitations` → `households` | CASCADE | 世帯の付属物 |
| `household_member_care_needs` → `household_members` | CASCADE | 同上 |
| `household_members` → `users` | SET NULL | ユーザが消えても構成員の枠は残す |
| `field_reports` → `users` | RESTRICT | 退会は論理削除にするため物理削除は起きない |
| `field_report_photos` / `field_report_confirmations` → `field_reports` | CASCADE | 投稿の付属物 |
| `evacuation_options` / `evacuation_decisions` → `shelters` | RESTRICT | 過去の判断の参照先が消えると再現できない |
| `evacuation_options` → `evacuation_advices` | CASCADE | 提案の付属物 |
| `route_steps` / `route_proposal_reports` → `route_proposals` | CASCADE | 提案の付属物 |
| `route_proposal_reports` → `field_reports` | RESTRICT | 提案の根拠を消さない |
| `notifications` → `users` | CASCADE | |
| `content_flags` / `moderation_actions` → 対象 | 外部キーを張らない | 対象が 4 テーブルにまたがる |

`shelters` は行を削除せず `is_active = false` にする。
出典データの再取り込みで DELETE と INSERT を繰り返すと、`evacuation_decisions` からの参照が RESTRICT で止まるか、CASCADE にした場合は過去の避難記録が消える。

## 保持期間

| データ | 期間 | 方法 |
| --- | --- | --- |
| `ai_invocations.output_raw` | 7 日 | 日次で NULL に更新 |
| `ai_invocations` 本体 | 90 日 | 日次削除 |
| `audit_logs` | 90 日 | 日次削除 |
| `traffic_snapshots` | 7 日 | 日次削除 |
| `rate_limit_counters` | 窓の終了から 2 日 | 日次削除 |
| `notifications` | 既読から 30 日 | 日次削除 |
| `field_reports`（論理削除済み） | 180 日 | 日次で物理削除 |
| `hazard_alerts` / `field_reports`（通常） | 保持する | 災害の記録として残す |

削除は `pg_cron` で日次のジョブとして実行する。

## トランザクションの境界

複数テーブルにまたがる書き込みは DB 関数にまとめ、Router からは 1 回の呼び出しにする。

| 操作 | 同一トランザクションで行うこと |
| --- | --- |
| 現地報告の投稿 | レート制限カウンタの加算 → `field_reports` の INSERT → 写真行の INSERT |
| AI 提案の保存 | `ai_invocations` → `evacuation_advices` → `evacuation_options` → `evacuation_switch_criteria` |
| 避難判断の更新 | `evacuation_decisions` の UPDATE → `member_status_events` の INSERT → `member_statuses` の UPDATE（トリガ） → 同じユーザの他世帯への同期 |
| モデレーションの措置 | `moderation_actions` の INSERT → 対象の `status` 更新（トリガ） → `content_flags` の解決 |

## インデックスの方針

- 外部キーには必ずインデックスを張る。PostgreSQL は外部キー制約だけでは索引を作らず、親の削除時に子テーブルを全走査するため。
- 地図の表示は「特定の地区・期間・有効な投稿」で引く。`field_reports` には `(observed_area_id, status, observed_at DESC)` の複合インデックスを張る。
- メッシュコードは前方一致で広域から絞り込めるため、`text_pattern_ops` の B-tree インデックスを張る。
- `shelters.location` には GiST インデックスを張り、最寄り避難所の検索に使う。
- 一意制約は「同じ人が同じ対象に二度投票できない」といった業務ルールをそのまま表す（`field_report_confirmations` の `(field_report_id, user_id)`）。アプリ側の重複チェックに任せない。

## 行レベルセキュリティ

全テーブルで RLS を有効にする。
方針とポリシーの一覧は [07-safety-moderation.md](07-safety-moderation.md#行レベルセキュリティの方針) にまとめた。
