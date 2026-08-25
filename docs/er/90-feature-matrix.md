# 機能とテーブルの対応

機能一覧の各行が、どのテーブルで実現されるかを示す。
設計の抜けを確認するときと、実装の着手順を決めるときに使う。

スコープの区分は [ER-Diagram.md の P1 の範囲](../ER-Diagram.md#p1-の範囲)に合わせた。

| 区分 | 意味 |
| --- | --- |
| P1最小 | 2 週間で確実に作る 24 テーブル |
| P1後半 | 機能一覧では P1 だが、最小構成の後に回す |
| P2 | 余力があれば |

## 今回作る（P1）

| 機能ID | 機能名 | 主なテーブル | 定義 |
| --- | --- | --- | --- |
| A1 | 家族構成の登録・更新 | `households` / `household_members` / `pets` / `care_needs` / `household_member_care_needs` / `areas` | [01](01-account-household.md) |
| B1 | 条件分岐した選択肢と切り替え基準の提示 | `evacuation_advices` / `evacuation_options` / `evacuation_switch_criteria` | [03](03-evacuation.md) |
| B4 | 徒歩／車の切り分け | `evacuation_options.travel_mode` / `households.has_car` | [03](03-evacuation.md) |
| C3 | 通行可否の共有と経路の提示 | `field_reports` / `road_segments` / `v_blocked_segments`（P1）、`route_requests` 以下（P2） | [04](04-field-report.md) [05](05-route.md) |
| C4 | 危険箇所の登録・注意喚起 | `field_reports`（`report_type = hazard`） | [04](04-field-report.md) |
| D1 | 避難所の場所・規模 | `shelters` / `shelter_hazard_supports` | [02](02-shelter.md) |
| D2 | 受入条件の表示 | `acceptance_conditions` / `shelter_acceptances` / `v_shelter_match` | [02](02-shelter.md) |
| E3 | 地区ラベルと信頼度表示 | `areas` / `field_reports.observed_area_id` / `field_report_confirmations` / `v_field_report_reliability` | [04](04-field-report.md) |
| S1 | 位置情報のメッシュ丸め | `observed_mesh_code` ほかの `mesh_code` カラム | [00](00-conventions.md#位置情報の扱い) |
| S2 | 写真の Exif 除去 | `field_report_photos.exif_stripped` | [04](04-field-report.md) |
| S3 | 投稿レート制限・本人確認 | `user_verifications` / `rate_limits` / `rate_limit_counters` | [07](07-safety-moderation.md) |
| S4 | 通報と削除の導線 | `content_flags` / `moderation_actions` | [07](07-safety-moderation.md) |
| S5 | プロンプトインジェクション対策 | `ai_invocations` / `ai_output_violations` / `v_shelter_match` | [07](07-safety-moderation.md) |
| S6 | 認可 | 全テーブルの RLS ポリシー / `is_household_member()` / `can_view_member_status()` / `user_public_profiles` | [07](07-safety-moderation.md) |

C3 は工程が二つに分かれる。
現地報告を集めて地図に重ね、危険区間を色分けするところまでが P1 で、探索エンジンによる経路計算と AI の説明文が P2 になる（[05](05-route.md#p1-で作る範囲)）。

## 余力があれば（P2）

| 機能ID | 機能名 | 主なテーブル | 定義 |
| --- | --- | --- | --- |
| A5 | 避難ルートの事前設定 | `evacuation_plans` / `evacuation_plan_waypoints` | [03](03-evacuation.md) |
| B2 | 在宅避難か避難所かの判断補助 | `checklist_templates` / `checklist_items` / `checklist_responses` / `checklist_answers` | [03](03-evacuation.md) |
| B3 | 避難先の分散 | `evacuation_decisions` / `v_shelter_load` / `v_shelter_match` | [03](03-evacuation.md) |
| C1 | リアルタイム道路混雑状況 | `traffic_snapshots` / `road_segments` | [05](05-route.md) |
| E1 | 地域のコミュニティ | `community_posts` / `community_comments` | [06](06-community-status.md) |
| E4 | ステータス表示 | `member_statuses` / `member_status_events` | [06](06-community-status.md) |
| E5 | 家族への状況共有 | `household_members.proxy_share_scope` / `family_connections` / `status_share_blocks` / `notifications` | [06](06-community-status.md) |

`evacuation_decisions` は B3 の入力だが、B1 で選んだ案を記録する画面は P1 に入る。
テーブルは P1 後半で作り、集計ビューを P2 で足す。

## 今回見送り（P3）

作らないが、後から足すときに既存の設計をどう使うかを記す。

| 機能ID | 機能名 | 足すときの拡張 |
| --- | --- | --- |
| A2 | 防災グッズの提案 | `household_members.age_group` と `pets` から算出する。新しいテーブルは要らない |
| A3 | 備蓄の賞味期限管理 | `household_supplies` を追加し、`notifications` で通知する |
| A4 | 防災Tips | 静的コンテンツ。DB に入れない |
| C2 | このルートを使う人数の表示 | `route_proposals` と `evacuation_decisions` の集計。B3 に統合する |
| C5 | 公共交通機関の運行状況 | `traffic_snapshots` に `transit` 種別を足す |
| D3 | 避難所の人数・けが人の登録 | `shelter_status_reports` を追加する。避難所運営側のアカウントが要る |
| D4 | 支援物資の到着予定・内容 | `shelter_supply_deliveries` を追加する |
| E2 | 周辺店舗の営業状況 | `field_reports.report_type = 'shop'` ですでに表せる |
| F1 | 防災シミュレーション | `disaster_events.is_drill = true` で既存の仕組みをそのまま使える |
| F2 | 災害時の事例収集 | `ai_invocations` の枠組みに `feature` を足す |
| F3 | 収集情報から必要な行動を表示 | B1 に吸収済み |

E2 と F1 と F3 は、既存の設計にすでに場所がある。
`field_report_type` に `shop` を、`disaster_events` に `is_drill` を最初から入れてあるのは、この 2 機能を後から足すときにテーブルを変えずに済ませるためである。

## テーブル一覧

| # | テーブル | 内容 | スコープ | 定義 |
| --- | --- | --- | --- | --- |
| 1 | `areas` | 地区マスタ | P1最小 | [01](01-account-household.md) |
| 2 | `users` | ユーザ | P1最小 | [01](01-account-household.md) |
| 3 | `user_public_profiles` | 公開する表示名 | P1最小 | [07](07-safety-moderation.md) |
| 4 | `households` | 世帯 | P1最小 | [01](01-account-household.md) |
| 5 | `household_members` | 世帯構成員 | P1最小 | [01](01-account-household.md) |
| 6 | `care_needs` | 要配慮の種類マスタ | P1最小 | [01](01-account-household.md) |
| 7 | `household_member_care_needs` | 構成員と要配慮の対応 | P1最小 | [01](01-account-household.md) |
| 8 | `pets` | ペット | P1最小 | [01](01-account-household.md) |
| 9 | `household_invitations` | 世帯への招待 | P1後半 | [01](01-account-household.md) |
| 10 | `shelters` | 避難所 | P1最小 | [02](02-shelter.md) |
| 11 | `shelter_hazard_supports` | 避難所の対応災害 | P1最小 | [02](02-shelter.md) |
| 12 | `acceptance_conditions` | 受入条件マスタ | P1最小 | [02](02-shelter.md) |
| 13 | `shelter_acceptances` | 避難所ごとの受入条件 | P1最小 | [02](02-shelter.md) |
| 14 | `disaster_events` | 災害イベント | P1後半 | [03](03-evacuation.md) |
| 15 | `hazard_alerts` | 警報・避難情報 | P1後半 | [03](03-evacuation.md) |
| 16 | `evacuation_advices` | AI の提案セッション | P1最小 | [03](03-evacuation.md) |
| 17 | `evacuation_options` | 避難の選択肢 | P1最小 | [03](03-evacuation.md) |
| 18 | `evacuation_switch_criteria` | 切り替え基準 | P1最小 | [03](03-evacuation.md) |
| 19 | `evacuation_decisions` | ユーザが選んだ案 | P1後半 | [03](03-evacuation.md) |
| 20 | `field_reports` | 現地報告 | P1最小 | [04](04-field-report.md) |
| 21 | `field_report_photos` | 現地報告の写真 | P1最小 | [04](04-field-report.md) |
| 22 | `field_report_confirmations` | 現地報告への確認投票 | P1最小 | [04](04-field-report.md) |
| 23 | `road_segments` | 道路区間 | P1後半 | [04](04-field-report.md) |
| 24 | `user_verifications` | 本人確認の履歴 | P1最小 | [07](07-safety-moderation.md) |
| 25 | `rate_limits` | 操作ごとの上限マスタ | P1最小 | [07](07-safety-moderation.md) |
| 26 | `rate_limit_counters` | 投稿回数のカウンタ | P1最小 | [07](07-safety-moderation.md) |
| 27 | `content_flags` | 通報 | P1最小 | [07](07-safety-moderation.md) |
| 28 | `moderation_actions` | 運営の措置 | P1最小 | [07](07-safety-moderation.md) |
| 29 | `ai_invocations` | AI 呼び出しの記録 | P1最小 | [07](07-safety-moderation.md) |
| 30 | `ai_output_violations` | AI 出力の検証違反 | P1後半 | [07](07-safety-moderation.md) |
| 31 | `audit_logs` | 監査ログ | P1後半 | [07](07-safety-moderation.md) |
| 32 | `evacuation_plans` | 事前設定の避難計画 | P2 | [03](03-evacuation.md) |
| 33 | `evacuation_plan_waypoints` | 避難計画の経由地 | P2 | [03](03-evacuation.md) |
| 34 | `checklist_templates` | チェックリストの雛形 | P2 | [03](03-evacuation.md) |
| 35 | `checklist_items` | チェックリストの設問 | P2 | [03](03-evacuation.md) |
| 36 | `checklist_responses` | チェックリストの回答 | P2 | [03](03-evacuation.md) |
| 37 | `checklist_answers` | 設問ごとの回答 | P2 | [03](03-evacuation.md) |
| 38 | `route_requests` | ルート依頼 | P2 | [05](05-route.md) |
| 39 | `route_proposals` | 経路候補 | P2 | [05](05-route.md) |
| 40 | `route_steps` | 経路の手順 | P2 | [05](05-route.md) |
| 41 | `route_proposal_reports` | 経路が根拠にした報告 | P2 | [05](05-route.md) |
| 42 | `traffic_snapshots` | 交通状況 | P2 | [05](05-route.md) |
| 43 | `community_posts` | コミュニティ投稿 | P2 | [06](06-community-status.md) |
| 44 | `community_comments` | コミュニティのコメント | P2 | [06](06-community-status.md) |
| 45 | `member_statuses` | 安否の現在値。主体は世帯構成員 | P2 | [06](06-community-status.md) |
| 46 | `member_status_events` | 安否の履歴 | P2 | [06](06-community-status.md) |
| 47 | `status_share_blocks` | 相手ごとの共有の遮断 | P2 | [06](06-community-status.md) |
| 48 | `family_connections` | 別世帯の家族との関係 | P2 | [06](06-community-status.md) |
| 49 | `notifications` | 通知 | P2 | [06](06-community-status.md) |

## ビュー一覧

| ビュー | 内容 | 用途 | スコープ |
| --- | --- | --- | --- |
| `v_household_member_count` | 世帯の人数 | `v_shelter_load` の入力 | P1最小 |
| `v_household_required_conditions` | 世帯が必要とする受入条件 | `v_shelter_match` の入力 | P1最小 |
| `v_shelter_match` | 世帯と避難所の適合 | B1 の候補絞り込み、D2 の表示 | P1最小 |
| `v_field_report_reliability` | 現地報告の確認人数の内訳 | E3 の表示 | P1最小 |
| `v_blocked_segments` | 通行不可・注意の道路区間 | C3 の地図表示、P2 の再探索 | P1後半 |
| `v_shelter_load` | 避難所の混雑度 | B3 の分散 | P2 |
