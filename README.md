# みちナビ

Tornado 2026 チームA

## Getting Started

- [mise](https://mise.jdx.dev/) — Node.js と pnpm のバージョンを `mise.toml` で固定しています

mise を使わない場合は、以下を手動で用意してください。

| ツール | バージョン |
| --- | --- |
| Node.js | 24.11.1 |
| pnpm | 10.12.2 |

## セットアップ

```bash
git clone git@github.com:muchu-dev/michinavi.git
cd michinavi

mise install   # Node.js / pnpm を導入
cp .env.example .env.local
pnpm install   # 依存パッケージを導入
pnpm dev       # http://localhost:3000
```

### 認証を迂回して画面を確認する

Supabaseを起動せず、認証後の画面だけをローカルで確認する場合は次を実行します。

```bash
pnpm dev:bypass-auth
```

認証の迂回は、Next.jsの開発モードかつ`APP_ENV=local`の場合だけ有効です。preview・productionでは`DEV_AUTH_BYPASS=true`が設定されていても有効になりません。実際のログイン動作や権限は、通常の`pnpm dev`とローカルSupabaseで確認してください。

## 開発タスク

Google Sheets のタスク正本をローカルで確認・差分検出できます。

```bash
pnpm tasks:status # 保存済みの進捗を表示
pnpm tasks:check  # Google Sheetsの更新を確認
pnpm tasks:sync   # 最新の全タスクを同期
```

詳細は [docs/tasks/README.md](./docs/tasks/README.md) を参照してください。

## ローカルの Supabase

DB のマイグレーションと RLS はローカルの Supabase で確認します。
Docker が動いている状態で次を実行してください。

```bash
pnpm supabase start   # 初回はイメージの取得に数分かかります
pnpm supabase db reset  # マイグレーションと seed を流し直す
```

| 用途 | URL |
| --- | --- |
| API | http://127.0.0.1:54321 |
| Studio | http://127.0.0.1:54323 |
| Postgres | postgresql://postgres:postgres@127.0.0.1:54322/postgres |

`supabase/migrations/` に SQL を足したら、`pnpm supabase db reset` で初期状態から流し直して確認します。
テーブルを追加したときは、RLS の有効化とポリシーを同じマイグレーションに含めてください（[docs/er/07-safety-moderation.md](docs/er/07-safety-moderation.md)）。

型定義は起動中のローカル DB から生成します。

```bash
pnpm supabase gen types typescript --local --schema public > src/lib/supabase/database.types.ts
```

## テスト

ローカルの Supabase に対して実際に読み書きし、RLS と DB 関数の挙動まで確認します。
起動していないと接続情報を取得できずに失敗するので、先に `pnpm supabase start` を実行してください。

```bash
pnpm test                          # 全テストを一度だけ実行
pnpm test:watch                    # 全テストを監視
VITEST_INTEGRATION=false pnpm test # Supabase不要のフロントエンドテストのみ実行
```

接続情報と鍵は `supabase status` から都度読み取るため、`.env.local` の内容（本番やプレビューの Supabase）には影響されません。
