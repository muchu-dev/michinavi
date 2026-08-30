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
cp apps/frontend/.env.example apps/frontend/.env.local
pnpm install   # 依存パッケージを導入
pnpm db:start  # ローカルの Supabase を起動（→「ローカルの Supabase」）
pnpm dev       # http://localhost:3000
```

## ディレクトリ構成

pnpm workspace のモノレポです。

```
michinavi/
├── apps/
│   ├── frontend/   @michinavi/frontend  画面と、バックエンドのマウント
│   └── backend/    @michinavi/backend   tRPC の router
├── packages/
│   ├── db/         @michinavi/db
│   └── ...
└── docs/          ドキュメント
```

### 認証を迂回して画面を確認する

Supabaseを起動せず、認証後の画面だけをローカルで確認する場合は、`apps/frontend/.env.local`に次を設定して`pnpm dev`を実行します。

```dotenv
DEV_AUTH_BYPASS="true"
```

認証の迂回は、Next.jsの開発モードかつ`APP_ENV=local`の場合だけ有効です。preview・productionでは`DEV_AUTH_BYPASS=true`が設定されていても有効になりません。実際のログイン動作や権限は、`DEV_AUTH_BYPASS="false"`に戻した`pnpm dev`とローカルSupabaseで確認してください。

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
pnpm db:start   # 初回はイメージの取得に数分かかります
pnpm db:reset   # マイグレーションと seed を流し直す
```

| 用途 | URL |
| --- | --- |
| API | http://127.0.0.1:54321 |
| Studio | http://127.0.0.1:54323 |
| Postgres | postgresql://postgres:postgres@127.0.0.1:54322/postgres |

`packages/db/supabase/migrations/` に SQL を足したら、`pnpm db:reset` で初期状態から流し直して確認してください。
テーブルを追加したときは、RLS の有効化とポリシーを同じマイグレーションに含めてください（[docs/er/07-safety-moderation.md](docs/er/07-safety-moderation.md)）。

**ブランチを移ったら `pnpm db:reset` を実行してください。** DB は前のブランチのマイグレーションを適用したまま残るため、リセットしないと手元だけが他の誰とも違うスキーマになります。

型定義は起動中のローカル DB から生成します。

```bash
pnpm db:types   # packages/db/src/database.types.ts を書き換える
```

その他のコマンドは `packages/db` の scripts に揃えてあります。

```bash
pnpm db:stop
pnpm db --help                                  # supabase CLI へそのまま渡す
pnpm --filter @michinavi/db migration:new <名前>  # 空のマイグレーションを作る
pnpm --filter @michinavi/db diff -f <名前>        # DB との差分をマイグレーションに書き出す
```

## テスト

ローカルの Supabase に対して実際に読み書きし、RLS と DB 関数の挙動まで確認します。
起動していないと接続情報を取得できずに失敗するので、先に `pnpm db:start` を実行してください。

```bash
pnpm test        # 全パッケージのテストを一度だけ実行
pnpm test:watch  # バックエンドのテストを監視
pnpm --filter @michinavi/frontend test  # Supabase 不要のフロントエンドテストだけ実行
```

接続情報と鍵は `supabase status` から都度読み取るため、`.env.local` の内容（本番やプレビューの Supabase）には影響されません。

同じ DB を共有するので、テストはファイル間・パッケージ間ともに直列で実行されます。
