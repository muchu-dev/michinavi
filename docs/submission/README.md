# 提出物

Tornado 2026 最終発表会に向けた提出物と、その準備状況をまとめる。

| 提出物 | ファイル | 状態 |
| --- | --- | --- |
| プロダクト（URL） | [production-checklist.md](production-checklist.md) | **要対応**（本番の DB が未設定） |
| プレゼン動画（5分以内） | [video-script.md](video-script.md) | 台本あり。収録はこれから |
| 納品メール | [delivery-email.md](delivery-email.md) | 下書きあり。`★` の記入が必要 |
| 当日のリアルタイム発表（5分） | 発表デッキ（下記） | 資料あり |

当日の発表デッキは Artifact として公開してある。発表者メモ（N キー）と
5 分のカウントダウン（T キー）が付いている。URL はチームの共有先を参照。

## いま塞がっている一番の問題

**https://michinavi.vercel.app は開けるが、データベースが未設定のため
地図・投稿・避難所がすべてエラーになる。**

提出条件は「審査員が URL からアクセスし、実際に確認・操作できる状態」なので、
このままでは条件を満たさない。手順は
[production-checklist.md](production-checklist.md) にまとめた。

所要はおおよそ 30 分（Supabase のプロジェクト作成、マイグレーション適用、
シード投入、Vercel の環境変数設定と再デプロイ、デモデータ投入、動作確認）。

## 順番

1. [production-checklist.md](production-checklist.md) を上から実行して、本番を操作できる状態にする
2. その本番で [video-script.md](video-script.md) の手順どおりに操作し、動画を収録する
3. [delivery-email.md](delivery-email.md) の `★` を埋め、送る前の確認を通してから送信する

**納品後にプロダクトへ修正は加えられない。** 1 を飛ばして 3 に進まないこと。

## 書いてあることの根拠

このディレクトリの記述は、次の実装に基づく。

| 書いた内容 | 実装 |
| --- | --- |
| 3タップ投稿 / 写真 | `fieldReport.create`、`fieldReportPhoto.attach` |
| Exif の除去 | `apps/backend/src/media/strip-exif.ts` |
| 位置の 250m メッシュ丸め | `docs/er/00-conventions.md#位置情報の扱い`、`field_reports.mesh_code` |
| 避難所と受入条件 | `shelter.nearby`、`shelter_acceptances` |
| 避難先の分散 | `shelterAssignment.assign` |
| 家族の安否共有 | `memberStatus.set` / `listForHousehold` |
| 通報と非表示 | `contentFlag.create`、`moderation.hide` |
| レート制限 | `create_field_report`、`rate_limits` |
| 障害時の案内 | `apps/backend/src/api/fallback.ts` |
| 他人のIDでは取れない | `apps/backend/src/api/__tests__/authorization.test.ts` |
| デモ用データ | `pnpm demo:seed` |

## 発表内容を本番で動かすために要るマージ

発表デッキと動画の台本は、レビュー待ちの PR を含めた「プロダクト全体」で書いてある。
下の PR がマージされていないと、審査員が触っても該当機能が出てこない。

| PR | 内容 | 無いとどうなるか |
| --- | --- | --- |
| #18 | AI による道路状態の推定 | 地図の状態が投稿の多数決だけになる |
| #20 | 同一地点の投稿を1枚のカードに | 集約のカードが出ない |
| #21 | 避難の選択肢と切り替え基準 | **デモの手順4が丸ごと見せられない** |
| #34 | 写真の撮影・添付の画面 | **投稿画面が「準備中」のまま。デモの手順2が見せられない** |
| #22 | 通報の導線 | 通報が画面から行えない |
| #23 / #24 / #25 | 災害時UI・エラー表示・デモ通し確認 | 見た目と例外時の表示が整わない |

**#21 と #34 は、デモの中身に直結する。** この 2 本が入らない場合は、
デッキのデモ手順と納品メールの機能紹介を書き換えること
（→ [delivery-email.md](delivery-email.md) の「機能紹介に書いた各機能の現状」）。

サーバ側は main に入っているが画面がまだ無い機能（避難所、避難先の分散、
安否共有の一部）は、API としては動くが審査員には見えない。
