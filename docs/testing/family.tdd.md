# Family画面 TDD検証記録

実施日: 2026-09-01

## 対象と参照情報

- 正本タスク: `mise exec -- pnpm tasks:check` で更新なしを確認し、
  `docs/tasks/all-tasks.md` の FE-16「ステータスと家族共有画面」を対象とした。
- GitHub: PR #17「feat: Family画面と家族連携導線を実装」のレビュー9件を確認した。
- Notion: [03_要件定義](https://app.notion.com/p/3bffbd36c35e81ac8ad8d2bd0f1789f1) と
  [04_UI画面設計](https://app.notion.com/p/3bffbd36c35e818bae6fe586a3fff599) を確認した。
  安否確認・支援要請の状態と公開範囲は確認できたが、今回のレビュー範囲を超える
  新しい家族連携動作の指定はなかった。
- Figma: StarterプランのMCP呼び出し上限に達しており、該当フレームを取得できなかった。
  そのため新しいデザイン判断はせず、既存の見た目を保つコード整理と、レビューで
  明示された安全性・アクセシビリティ改善に限定した。
- Miro: `/family` → `/family/settings` → `/family/connect` の導線が既存コード、テスト、
  レビューで明確なため参照を省略した。
- Next.js: リポジトリにインストールされた Next.js 16.3.2 の
  `Metadata and OG images` と `Layouts and Pages` を確認した。

## ユーザージャーニー

- 利用者は、表示中の家族状況が実データではなくサンプルだと判断できる。
- キーボードやスクリーンリーダーの利用者は、未実装の設定項目とQR読取項目を
  発見でき、それらが準備中であることを理解できる。
- 利用者はFamily配下の各ページをブラウザのタイトルで識別できる。

## RED

実行コマンド:

```sh
mise exec -- pnpm --filter @michinavi/frontend test -- \
  'src/app/(app)/family/page.test.tsx' \
  'src/app/(app)/family/settings/page.test.tsx' \
  'src/app/(app)/family/connect/page.test.tsx'
```

結果: 8ファイル中3ファイルで、意図した6テストが失敗した。原因は、3ルートの
`metadata`、サンプル表記、設定項目とQR読取項目の準備中状態が未実装だったためで、
既存11テストは成功した。REDチェックポイントは `0d4deda`。

Next.jsの親layoutがタイトルテンプレートを付与することを確認したため、実装前に
metadataテストの期待値を完全なタブ文字列から各ページの短いタイトルへ補正し、
同じ6件が失敗することを再確認した。

## GREEN

同じコマンドを実装後に再実行し、8ファイル・17テストすべてが成功した。
GREENチェックポイントは `50ce34b`。

## テスト仕様

| 保証する内容 | テスト | 種別 | 結果 |
| --- | --- | --- | --- |
| 家族状況に「サンプル表示です」と表示する | `family/page.test.tsx` | コンポーネント | PASS |
| 家族名と避難状況を対応付けて表示する | `family/page.test.tsx` | コンポーネント | PASS |
| 未実装の設定項目はフォーカス可能なまま `aria-disabled=true` と準備中表記を持つ | `family/settings/page.test.tsx` | コンポーネント | PASS |
| 設定から家族連携画面へ移動できる | `family/settings/page.test.tsx` | コンポーネント | PASS |
| QR読取項目は `aria-disabled=true` と準備中表記を持つ | `family/connect/page.test.tsx` | コンポーネント | PASS |
| Family配下の3ルートが個別のmetadataを持つ | Family配下の各 `page.test.tsx` | コンポーネント | PASS |

## レビュー対応

1. 家族状況にサンプル表記を追加した。
2. 設定画面のネイティブ `disabled` を `aria-disabled` と準備中表記へ変更した。
3. QR読取項目を `aria-disabled` と準備中表記へ変更した。
4. 家族データを `evacuated | needs_help` の状態キーだけにし、表示ラベルとクラスを
   `statusDetails` へ分離した。
5. Family配下の色の直書きを `neutral-soft` と `caution-contrast` トークンへ移した。
6. Chevronを `ChevronRight` 共有コンポーネントへ統一した。
7. Family配下の3ルートにmetadataを追加した。
8. この検証記録を日本語へ統一した。
9. 25pxの文字サイズを `text-family-label` トークンへ移した。

`aria-disabled` ボタンに空の `onClick` は追加していない。イベントハンドラーが無ければ
操作しても状態は変わらず、Server Componentのままフォーカスと無効状態を伝えられるため、
不要なクライアントJavaScriptを増やさない方を選んだ。

## 検証結果

- `mise exec -- pnpm lint`: 63ファイルのBiome検査と全4プロジェクトの型検査が成功。
- `mise exec -- pnpm --filter @michinavi/frontend test:coverage`: 17/17テスト成功。
  Statements 90.9%、Branches 100%、Functions 81.81%、Lines 90.9%。
- `mise exec -- pnpm --filter @michinavi/frontend exec next build --webpack`: 成功し、
  `/family`、`/family/settings`、`/family/connect` を生成。
- 標準のTurbopack build: 実行環境が内部ヘルパープロセスのポートbindを拒否するため失敗。
  同じ制約はレビュー前の検証記録にもあり、今回の変更ファイルに起因するエラーではない。
- 実ブラウザQA: ブラウザ自動化ランタイムと基準画像が無いため判定不能。DOMテストでは
  準備中項目に `disabled` 属性がなく、`aria-disabled=true` であることを確認した。

## 既知の未実装範囲

- QRコード生成・読取処理と実データ連携は仕様未確定のため実装していない。
- 家族構成の登録・更新と個人情報の編集は、専用画面の仕様が確定するまで準備中とする。
- Figmaの呼び出し上限が解除された後、該当フレームとの視覚照合が必要。
