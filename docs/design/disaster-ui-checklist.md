# 災害時UIチェックリスト

対象タスク: FE-19（災害時UIの適用）／ DS-13（災害時に使えるかを確認する）

DS-13 のチェックリストがまだ Figma 側に無いため、DS-13 の「やること」に書かれた
4 点（文字の大きさ、指で押せる大きさ、暗い場所での見え方、片手で届くか）を
このファイルで項目に分解し、実装と確認方法を紐づける。
Figma 側のチェックリストが出てきたら、項目をこちらに寄せて差分を埋める。

## 前提

災害時の利用者は、屋外の明るい場所、雨、手袋、片手（もう片方は荷物か子ども）、
電池節約で輝度を落とした画面、という条件が重なる。
「見た目で十分そう」ではなく数値で決め、可能なものは自動で検査する。

数値は `apps/frontend/src/config/disaster-ui.ts` に置き、
配色は `apps/frontend/src/app/globals.css` の `:root` だけを正とする。

## チェックリスト

| # | 項目 | 基準 | 満たし方 | 確認 |
| --- | --- | --- | --- | --- |
| 1 | タップ領域が指で押せる | 44px 以上 | `--tap-min: 2.75rem` と `.tap-target`。ナビゲーションの各項目は `min-h-14`（56px）、主要ボタンも `min-h-14`。地図の「現在地を追跡」は `.tap-target` | ✓ `contrast.test.tsx` がトークンの値を検査。各部品のクラスは `quick-post-action.test.tsx` / `map-canvas.test.tsx` |
| 2 | 本文が小さすぎない | 本文 16px 以上、補助 14px 以上 | 画面外枠と地図の 10px / 11px / 12px の文字をすべて 14px 以上へ引き上げた。地図のピンの件数は 52px 表示のままだと実寸 8px になるので、原寸（64px）で 14px にした | ✓ `disaster-ui.test.tsx` が対象ファイルのクラスと SVG の `font-size` を走査 |
| 3 | 文字と背景のコントラストが足りる | 4.5:1 以上（WCAG 2.1 AA） | `--brand` を `#597ebf` → `#3f63a5`、`--muted` を `#6b7076` → `#5c636b` に濃くした | ✓ `contrast.test.tsx` が実際に重ねている 13 組すべてを計算 |
| 4 | 端末のコントラスト設定に追従する | `prefers-contrast: more` で更に濃く | `--muted` と `--outline` を差し替える | 手動（端末の設定を切り替えて確認） |
| 5 | 色だけで意味を伝えない | 記号か文字を併記 | 地図の凡例は色の帯と文字、通報済みは「✓」と「通報済みです」 | 手動。DS-14 で別途確認する |
| 6 | 主要ボタンが片手で届く | 画面下部（ナビゲーションの直上・右寄り） | `QuickPostAction` を画面下 5.75rem に固定。投稿画面では出さない | ✓ `quick-post-action.test.tsx` / `app-shell.test.tsx` |
| 7 | フォーカスが見える | 3px の輪郭 | `focus-visible:outline-3` を主要な操作部品に付ける | 手動（キーボード操作で確認） |
| 8 | ブラウザの拡大が効く | 文字サイズを固定しない | `text-size-adjust: 100%`。文字サイズは rem で指定する | 手動 |
| 9 | 動きが苦手な人に配慮する | `prefers-reduced-motion` | 既存の指定を維持 | 手動 |
| 10 | 地図が持ち込む既定値も基準に合わせる | 補助 14px 以上 / タップ領域 44px 以上 | `leaflet.css` の既定（本文 12px、出典 11px、ズーム 26〜30px、吹き出しの閉じる 24px）を `globals.css` で上書きする | ✓ `disaster-ui.test.tsx` が `leafletOverrides` のセレクタごとに値を検査 |

## 自動で検査していること

- `apps/frontend/src/lib/a11y/contrast.test.tsx`
  - `globals.css` の `:root` から色を読み、`config/disaster-ui.ts` の
    `contrastPairs`（実際に画面で重ねている組）すべてが 4.5:1 以上であること
  - 色の値をテストへ書き写していないので、CSS を薄い色に戻すと落ちる
- `apps/frontend/src/config/disaster-ui.test.tsx`
  - `disasterUiCheckedFiles` に挙げたファイルに、14px 未満の文字サイズが無いこと。
    Tailwind のクラスだけでなく、SVG の `font-size` 属性も見る
  - 地図は組み立てる側（`map-view.tsx`）だけでなく、実際に描く側
    （`map-canvas.tsx`）も対象に入れる。片方だけだと「テストは通るが
    画面は基準を満たさない」状態になる
  - `globals.css` の `font-size` がすべて 14px 以上であること
  - `leafletOverrides` に挙げた Leaflet の既定値が `globals.css` で
    上書きされ、上書き後の値が基準を満たしていること。上書きを消すと落ちる

画面が増えたら `contrastPairs` と `disasterUiCheckedFiles` に足す。
全ファイルを自動で対象にしないのは、どこまで見ているかを一覧で分かるようにするためである。

## まだ満たしていないこと

- 実機での確認（屋外の明るさ、手袋）。数値の検査と手触りは別物なので、
  デモ前に 1 度は屋外で触る
- 避難タブ（`evacuation/_components/*`）と投稿画面（`posts/page.tsx`）には
  まだ 10px / 11px / 12px の文字が残っている。これらは別 PR で main に入った
  画面なので、同じ手順（`disasterUiCheckedFiles` に足して落ちた箇所を直す）で
  順に取り込む
- DS-15（デザイナーからの数値の受け渡し）が入っていないため、余白と文字の
  段階はこのリポジトリ側の判断で決めている。Figma の値が出たら合わせる
