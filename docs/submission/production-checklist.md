# 本番環境チェックリスト

提出条件は「審査員が URL からアクセスし、実際に確認・操作できる状態」である。
このファイルは、その状態に持っていくための手順と、現在の状態をまとめる。

最終確認: 2026-09-02

## 提出する URL

**https://michinavi.vercel.app**

Vercel には 2 つのプロジェクトが紐づいているが、**審査員が見られるのは上の 1 つだけ**である。

| デプロイ先 | 状態 |
| --- | --- |
| `michinavi.vercel.app`（本番のエイリアス） | 公開されている。**これを提出する** |
| `michinavi-8iutmii7x-kouta12s-projects.vercel.app` | Vercel のログインを求められる（SSO）。審査員は入れない |
| `michinavi-frontend-5vhpk13t5-sora5325.vercel.app` | 同上。審査員は入れない |

デプロイごとに発行される URL（ハッシュ付き）は保護がかかっている。
**提出には必ずエイリアス側（`michinavi.vercel.app`）を書くこと。**

## 現在の状態

アプリは動いているが、**データベースが未設定のため主要な画面が動かない**。

```
$ curl -s https://michinavi.vercel.app/api/trpc/health.ping
{"result":{"data":{"json":{"ok":true, ...}}}}          # アプリは動いている

$ curl -s 'https://michinavi.vercel.app/api/trpc/fieldReport.list?input=...'
{"error":{"json":{"message":"投稿一覧の取得に失敗しました", ... }}}   # DB が応答しない

$ curl -s 'https://michinavi.vercel.app/api/trpc/area.resolveFromAddress?input=...'
{"error":{"json":{"message":"地区の判定に失敗しました", ... }}}       # 地区マスタも無い
```

DB を使わない口（`health.ping` / `fallback.guidance`）だけが通り、テーブルを読む口は
すべて 500 になる。**本番の Supabase にマイグレーションが 1 本も当たっていない**状態である。

この状態では、審査員がログインしても地図・投稿・避難所が表示されない。

## 直す手順

### 1. 本番の Supabase プロジェクトを用意する

Supabase のダッシュボードでプロジェクトを作る（すでにあるならその Project ref を控える）。

### 2. マイグレーションを当てる

```bash
pnpm --filter @michinavi/db exec supabase link --project-ref <PROJECT_REF>
pnpm --filter @michinavi/db exec supabase db push
```

`packages/db/supabase/migrations/` の 20 本が順に当たる。

### 3. マスタと避難所のデータを入れる

`supabase db push` は `seed.sql` を流さない。本番には手で入れる。

```bash
# Supabase ダッシュボードの SQL Editor に
# packages/db/supabase/seed.sql の中身を貼って実行する
```

入るもの: 地区マスタ（岡山県・倉敷市・真備町ほか、神田）、避難所 5 件（架空のデモデータ）。

### 4. Vercel の環境変数を設定する

`michinavi` プロジェクトの Production に次を設定する（`apps/frontend/.env.example` と同じキー）。

| キー | 値 |
| --- | --- |
| `APP_ENV` | `production` |
| `NEXT_PUBLIC_SUPABASE_URL` | 本番 Supabase の URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 本番の publishable key |
| `SUPABASE_SECRET_KEY` | 本番の secret key（AI推定の保存と管理操作で使う） |
| `GEMINI_API_KEY` | Google AI Studio の API キー。**未設定でもアプリは動く**が、AIによる道路状態の推定だけが働かない |
| `GEMINI_MODEL` | 省略可。モデル名を固定したいときだけ設定する |

設定したら **再デプロイする**。環境変数はビルド時に読むため、設定しただけでは反映されない。

### 5. 審査用のデモデータを入れる

```bash
NEXT_PUBLIC_SUPABASE_URL=<本番URL> \
SUPABASE_SECRET_KEY=<本番secret> \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<本番publishable> \
pnpm demo:seed
```

架空の家族 3 世帯・12 件の投稿と、審査用のログイン情報が作られる
（→ [delivery-email.md](delivery-email.md) の「審査時の注意事項」）。

### 6. 動作を確かめる

```bash
curl -s https://michinavi.vercel.app/api/trpc/health.ping                  # ok: true
curl -s 'https://michinavi.vercel.app/api/trpc/fieldReport.list?input=%7B%22json%22%3A%7B%22limit%22%3A5%7D%7D'
# → 12 件の投稿が返ること（error が返らないこと）
```

そのうえで、ブラウザで次を通す。

- [ ] `https://michinavi.vercel.app` を開くと `/login` に飛ぶ
- [ ] 審査用アカウントでログインできる
- [ ] 地図が表示される
- [ ] **「投稿」タブに投稿が表示される（0件になっていない）**
- [ ] 家族の画面が表示される
- [ ] シークレットウィンドウでも同じことができる（自分のログイン状態に依存していないか）

## 注意

- **納品後にプロダクトへ修正を加えることはできない。** 上の手順は納品メールを送る前に
  済ませること
- **`pnpm test` を流すとデモ用データが消える。** デモ用データ投入のテストが後片付けで
  デモアカウントを削除するため、テストの後は `pnpm demo:seed` をやり直す
- **デモ投稿の位置がずれると投稿画面が0件になる。** 投稿画面は表示中の地点と同じ
  2次メッシュ（メッシュコードの先頭6桁）で絞り込む。デモ投稿は地図の初期表示位置に
  合わせてある
- 本番の secret key を手元のシェル履歴に残さないこと。手順 5 は一度きりでよい
