# Google Sheets タスク同期

Google Sheets の [michinavi_tasks](https://docs.google.com/spreadsheets/d/1FW508w8fH26xQPqVVBr8nZcPqa91Myz6f0Jq2WECwb0/edit) を正本として、全8タブをローカルに同期します。

最終同期: 2026-08-27T01:04:56.534Z

## 現在の進捗

| 区分 | タスク数 | 未着手 | 進行中 | 完了 | 見送り | 想定工数 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| BE | 29 | 24 | 0 | 3 | 0 | 95h |
| FE | 22 | 20 | 0 | 2 | 0 | 81h |
| デザイナー | 17 | 6 | 5 | 6 | 0 | 50h |
| 共通 | 10 | 8 | 0 | 2 | 0 | 21h |
| 合計 | 78 | 58 | 5 | 13 | 0 | 247h |

注意: Google Sheetsの進捗集計対象はID付き75件です。これとは別に、IDや各列の値が未設定の作業行が 2 件あります（BE 12行目、BE 13行目）。見落とし防止のため上のタスク数には含めています。

## 使い方

```bash
pnpm tasks:status # 保存済みスナップショットの進捗を表示（通信なし）
pnpm tasks:check  # Google Sheetsに更新があるか確認（ファイル変更なし）
pnpm tasks:sync   # 最新内容を取得してスナップショットを更新
```

タスクの詳細は [all-tasks.md](./all-tasks.md)、全タブの生データとハッシュは [google-sheet-snapshot.json](./google-sheet-snapshot.json) にあります。

`tasks:check` はタブ単位の変更に加え、タスクの追加・削除・ステータスなどの変更内容を表示し、更新があれば終了コード1を返します。Google Sheetsへの書き込みは行いません。
