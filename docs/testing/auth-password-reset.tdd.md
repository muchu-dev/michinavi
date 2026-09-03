# ログイン処理の見直しとパスワード再設定 TDD検証記録

実施日: 2026-09-03

## 対象と参照情報

- 正本タスク: `mise exec -- pnpm tasks:check` が更新ありを報告したため `tasks:sync` を実行し、
  `docs/tasks/all-tasks.md` の BE-08「認証の実装」を対象とした。
  完了の定義は「登録・ログイン・ログアウトが動く」だが、
  今回の範囲は依頼により **ログイン処理の見直し** と **パスワード再設定** に絞った。
  新規登録とログアウトは未着手のまま残る。
- 既存の記録: `docs/ai-harness/runs/FE-06-login/evaluation-report.md` が
  「パスワード再設定メール送信・更新フローは別タスク」と引き継いでいた。
- Next.js: リポジトリに入っている 16.3.2 の
  `01-app/02-guides/authentication.md`、`01-app/01-getting-started/15-route-handlers.md`、
  `01-app/03-api-reference/04-functions/redirect.md` を確認した。
  Server Action で資格情報を扱うこと、`redirect()` を `try` の外で呼ぶことを踏襲している。
- 認証の置き場所: セッションCookieを書き戻せるのは Next.js 側だけであるため、
  依頼のとおり Server Action と Route Handler に集約した。`apps/backend` は変更していない。

## 実装した振る舞い

| 区分 | 内容 |
| --- | --- |
| ログイン | 開こうとしていた画面を `next` で持ち回り、ログイン後にそこへ戻す |
| ログイン | `next` は `resolveRedirectPath` を通した自サイト内のパスだけを許可する |
| ログイン | 回数制限（429）とメール未確認を、資格情報の誤りとは別の文言で伝える |
| セッション | ログイン済みで `/login` を開いたらアプリ側へ戻す（再設定の2画面は残す） |
| 再設定 | `/forgot-password` から再設定メールを送る（宛先の登録有無は応答に出さない） |
| 再設定 | `/auth/confirm` がリンクを検証してセッションCookieを発行する（`recovery` のみ） |
| 再設定 | `/reset-password` で新しいパスワードを保存する |

## RED → GREEN

| 振る舞い | RED | GREEN |
| --- | --- | --- |
| `next` の検証、メールのオリジン決定 | 対象モジュールが無く読み込みに失敗 | 単体テストが通過 |
| proxy の `next` 引き回しと既ログイン時の追い出し | 匿名リダイレクトが `next` を落とし、既ログインは 200 のまま | 307 と遷移先を確認 |
| ログインのエラー分類と戻り先 | 回数制限・未確認が同じ文言、`next` は未対応 | 文言と `redirect()` の引数を確認 |
| 再設定メールの送信 | `app/forgot-password/actions.ts` が無い | 送信先URLと文言の同一性を確認 |
| リンクの検証 | `app/auth/confirm/route.ts` が無い | `recovery` のみ通し、期限切れは案内へ戻す |
| パスワードの保存 | `app/reset-password/actions.ts` が無い | 8文字以上・一致・失敗時の文言を確認 |

- RED: `VITEST_INTEGRATION=false mise exec -- pnpm test`（apps/frontend）
  → 22ファイル中9ファイルが失敗、8テストが意図した理由で失敗。
- GREEN: 同コマンド → 22ファイル / 107テストが通過。

## 実行した確認

| 種類 | コマンド | 結果 |
| --- | --- | --- |
| test | `VITEST_INTEGRATION=false mise exec -- pnpm test`（apps/frontend） | PASS: 22ファイル / 107テスト |
| coverage | `VITEST_INTEGRATION=false mise exec -- pnpm test:coverage` | PASS: statements 96.64%、branches 93.15%、functions 90.47%、lines 96.84%（閾値80%） |
| lint | `mise exec -- pnpm lint` | PASS: Biome 136ファイル、`tsgo --noEmit` 4パッケージ |
| build | `mise exec -- pnpm build` | PASS: Turbopack。`/auth/confirm` と `/reset-password` を認識、`Proxy (Middleware)` あり |

## ローカルの実機確認（2026-09-03 追記）

`pnpm db:start` と `pnpm demo:seed` を済ませたローカル環境で、ブラウザから通しで確認した。

| 確認 | 結果 |
| --- | --- |
| `demo-sato@michinavi.example` でログイン | 成功。`/` のトップ画面まで到達 |
| `/forgot-password` から送信 | 「再設定用のリンクを送りました」を表示 |
| `/auth/confirm?token_hash=…&type=recovery` | 検証に成功し `/reset-password` へ遷移 |
| `/reset-password` に現在と同じパスワードを送信 | `same_password` を「現在のパスワードと同じです」に変換して表示 |

この過程で、`"use server"` のファイルが async 関数以外を export できない制約に触れる書き方が
見つかったため修正した（`A "use server" file can only export async functions, found object.`）。
`initialLoginState` などのフォーム初期値を `actions.ts` から `state.ts` へ移している。
`initialLoginState` の const export は origin/main の時点から入っていたもので、
ビルドとユニットテストでは検出できず、Server Action を実際に呼んだときだけ落ちていた。

未確認のまま残るのは、パスワード変更の**成功**経路である。
デモ用アカウントの資格情報を壊さないよう、同じパスワードを送る形で確認を止めた。

## 未確認と申し送り

- 実際の Supabase を使った通しの確認（メール受信、`verifyOtp`、Cookie発行）は未実施。
  Docker デーモンが起動していない環境のため `pnpm db:start` ができなかった。
  同じ理由で `apps/backend` のテストは起動時に失敗する（今回の変更とは無関係）。
- 本番・プレビューの Supabase では、ダッシュボードの Recovery テンプレートを
  `packages/db/supabase/templates/recovery.html` と同じ内容にし、
  Redirect URLs に `SITE_URL` のオリジンを登録する必要がある。
  既定テンプレート（PKCEの `code`）でも `/auth/confirm` は動くが、
  メールを別の端末で開くと検証できない。
- `/login` と `/forgot-password` は `searchParams` を読むため、静的生成から
  リクエスト時レンダリングに変わった。
- BE-08 の残り（新規登録、ログアウト）は未着手。
