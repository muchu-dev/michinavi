# 評価レポート: FE-06 ログイン画面

## 判定

- 結果: `PASS WITH NOTES`
- 総合点: `79/100`
- 再試行回数: `1/2`
- 評価日時: 2026-08-28
- 対象コミットまたは作業ツリー: 未コミットの作業ツリー

## カテゴリ別採点

| カテゴリ | 点数（0〜5） | 重み | 証拠 |
| --- | ---: | ---: | --- |
| 機能・受け入れ条件 | 4 | 30 | 22件のフロントエンドテスト、`/login` 200、未認証 `/` 307→`/login`、Proxyビルド認識 |
| UI・インタラクション | 4 | 25 | Figma node `7:945` の階層・ロゴ・配色・フォーム・リンクを実装。ブラウザ画像比較は未実施 |
| アクセシビリティ | 4 | 20 | 可視ラベル、入力目的、エラー関連付け、live region、pending/disabled、44px主要操作、明示的フォーカス、コントラスト調整。実ブラウザ読み上げは未実施 |
| レスポンシブ | 3 | 15 | `min-h-dvh`、安全領域、流動幅、320px向け余白、最大幅、横overflow抑止を静的確認。指定4 viewportの実ブラウザ確認は未実施 |
| 性能・実装品質 | 5 | 10 | Server/Client境界を最小化、静的ページ生成、lint/typecheck/build成功、カバレッジ閾値超過 |

### ハード失敗

該当なし。未実施項目は実行環境不足によるもので、変更に起因する失敗ではない。

## 実行した確認

| 種類 | コマンドまたは操作 | 結果 | 証拠 |
| --- | --- | --- | --- |
| lint | `mise exec -- pnpm lint` | PASS | Biome 49 files、型生成・`tsgo --noEmit`成功 |
| typecheck | `mise exec -- pnpm typecheck` | PASS | Next route types生成、型エラーなし |
| test/coverage | `VITEST_INTEGRATION=false mise exec -- pnpm test:coverage` | PASS | 8 files / 22 tests、statements/lines 96.77%、branches 97.14%、functions 88.88% |
| integration | `mise exec -- pnpm test` | 未実施 | ローカルSupabaseが停止。起動を試したがDocker/Podmanが存在しない |
| build | `mise exec -- pnpm exec next build --webpack`（既存envを値非表示で注入） | PASS | 10/10静的ページ生成、`ƒ Proxy (Middleware)`認識 |
| default build | `mise exec -- pnpm build` | 未確定 | この環境でTurbopackが出力なく停止したため中断。webpackビルドは成功 |
| HTTP | 本番サーバーで `/login`、`/`、`/forgot-password`、ロゴを取得 | PASS | `/login` 200、`/` 307→`/login`、回復案内200、SVG 200 |
| ブラウザ | Chromium/Playwright探索 | 未実施 | browser engine/packageがワークスペースにない |
| アクセシビリティ | RTLのrole/label/aria検証＋コード監査 | PASS WITH NOTES | 実ブラウザのTab順・スクリーンリーダー確認は未実施 |

## 受け入れ条件ごとの評価

- [x] 条件1: Figmaの視覚階層、正確なSVGロゴ、青背景、白いフォーム面、2入力、主要ボタン、回復リンクを実装。
- [x] 条件2: CSS上は320〜1440pxで流動的に収まる構成。実ブラウザ4 viewportは環境不足により未確認。
- [x] 条件3: 可視ラベル、`type`、`autocomplete`、論理DOM順をRTLで確認。
- [x] 条件4: 空・不正メールをSupabase呼び出し前に拒否するテストが成功。
- [x] 条件5: 認証拒否・例外の双方で内部詳細を隠すテストが成功。
- [x] 条件6: pending時にボタンが無効化され「ログイン中…」となるテストが成功。
- [x] 条件7: `signInWithPassword`成功後に`/onboarding`へredirectするテストが成功。初期世帯を設定済みの利用者は`/onboarding`のServer Componentから`/`へredirectする。実Supabase cookie統合は未確認。
- [x] 条件8: Proxy単体テストと本番HTTPで匿名リダイレクト、公開画面、cookie更新を確認。
- [x] 条件9: frontend tests/coverage/lint/typecheck/webpack buildは成功。Supabase integrationとTurbopack既定buildは環境制約を注記。

## 発見事項

- 重要度: Note
- ファイルと行: `src/proxy.ts`
- 再現手順: 初回の本番HTTP確認で匿名`/`が200になった。
- 対応または引き継ぎ: Proxyを`src/app`と同じ階層の`src/proxy.ts`へ移動し、307リダイレクトとビルド認識を再確認済み。

- 重要度: Note
- ファイルと行: 実行環境
- 再現手順: Supabase起動はDocker/Podman不在、ブラウザQAはbrowser engine不在。
- 対応または引き継ぎ: Docker付き環境でintegration tests、ブラウザ付き環境で4 viewport・Tab順・実アカウントログインを確認する。

## 次の判断

- 修正が必要か: コード上の必須修正なし。
- 再試行する失敗項目: なし。
- バックエンド引き継ぎが必要か: なし。検証環境のみ必要。
- 次のスプリント: パスワード再設定メール送信・更新フローは別タスク。
