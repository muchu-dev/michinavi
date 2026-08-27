---
name: catch-up-with-rebase
description: このリポジトリの作業ブランチを origin/main の最新状態へ rebase し、コンフリクトを両側の変更意図に基づいて解消する。「main の最新に追従して」「rebase して」「コンフリクトを解消して」など、みちナビの作業ブランチを main に追従させる場面で使用する。merge の実行や単なる Git 操作の説明には使用しない。
allowed-tools: Bash(git *) Bash(pnpm *) Read Grep Edit
---

# Catch Up With Rebase

現在の作業ブランチを、指定された target ref（省略時は `origin/main`）へ rebase する。

履歴を書き換える操作なので、開始前に現在地と作業ツリーを確認する。解消では一方を機械的に採用せず、main 側と作業 commit 側の意図を両立させる。

## このリポジトリの前提

- 既定の target は `origin/main`。
- パッケージマネージャーは pnpm。
- CI と同等の検証は `pnpm lint:ci`（Biome と型チェック）。
- lockfile は `pnpm-lock.yaml`。コンフリクト時に手編集や単純削除をせず、`package.json` の意図を統合して pnpm で再生成する。
- Next.js のコードを直す場合は、ルートの `AGENTS.md` に従い、該当 API のガイドを `node_modules/next/dist/docs/` から先に読む。

## 1. 開始前の確認

次を確認し、結果を短くユーザーへ共有する。

```bash
git branch --show-current
git status --short
git remote -v
git log --oneline --decorate -10
```

以下では rebase を開始せず停止する。

- detached HEAD
- rebase / merge / cherry-pick が既に進行中
- 未コミット変更または未追跡ファイルがあり、rebase の安全な実行を妨げる場合
- target ref が存在しない、または現在のブランチ自身を指す場合

未コミット変更を勝手に stash、commit、破棄しない。今回のスキル自身の追加など、ユーザーが認識している変更がある場合も扱いを確認する。

target の最新状態が必要なら `git fetch origin` を実行する。ユーザーがオフラインの ref や特定 commit を明示した場合は fetch しない。

## 2. Rebase 前の把握

```bash
git merge-base HEAD <target-ref>
git log --reverse --oneline <target-ref>..HEAD
git diff --stat <target-ref>...HEAD
```

適用される commit と差分の全体像を把握してから開始する。

## 3. Rebase とコンフリクト解消

```bash
git rebase <target-ref>
```

コンフリクトが起きるたび、[Rebase conflict workflow](./references/REBASE_WORKFLOW.md) を読み、その手順で解消する。判断できない変更意図が残る場合は、推測で進めずユーザーへ確認する。

## 4. 検証

rebase 完了後に最低限、次を実行する。

```bash
git status --short
git diff --check <target-ref>...HEAD
pnpm lint
```

変更内容に応じた追加テストが存在すれば実行する。依存関係を変更した場合は `pnpm install --lockfile-only` で lockfile を再生成し、続けて `pnpm install --frozen-lockfile` で整合性を確認する。

検証失敗は rebase の成功と区別して報告する。検証のためだけに無関係な既存不具合を修正しない。

## 5. 完了報告

次を簡潔にまとめる。

- rebase 元ブランチと target ref
- rebase された commit 数
- コンフリクトした commit / ファイルと、解消方針・根拠
- 実行した検証と結果
- 残課題

rebase 後の push はこのスキルの範囲外。ユーザーが明示的に依頼した場合のみ、リモートとの差分を確認して `git push --force-with-lease` を使う。単なる `--force` は使わない。
