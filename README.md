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
pnpm test        # 一度だけ実行
pnpm test:watch  # 変更を監視
```

接続情報と鍵は `supabase status` から都度読み取るため、`.env.local` の内容（本番やプレビューの Supabase）には影響されません。
