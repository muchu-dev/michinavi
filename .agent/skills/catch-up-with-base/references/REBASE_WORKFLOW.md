# Rebase Conflict Workflow

rebase は作業ブランチの commit を target の先頭へ古い順に再適用する。解消結果が後続 commit に影響するため、コンフリクトごとに以下を繰り返す。

## 1. 適用中の commit と対象ファイルを確認する

```bash
git status
git log -1 --format='%H%n%s%n%b' REBASE_HEAD
git diff --name-only --diff-filter=U
```

rebase 中の 3-way merge は次の対応になる。

- Base: `REBASE_HEAD^`
- Ours / `HEAD`: target と、既に再適用済みの commit
- Theirs / `REBASE_HEAD`: 今から再適用する作業 commit

そのため、通常の merge と違い、コンフリクトマーカーの `HEAD` 側は作業ブランチの元の先端ではない。`--ours` / `--theirs` を名前だけで選ばない。

## 2. 両側の変更意図を調べる

まず作業 commit の message と diff を読む。

```bash
git show --stat --oneline REBASE_HEAD
git show REBASE_HEAD -- <file>
```

次に target / 再適用済み側の履歴と該当箇所を読む。

```bash
git log --oneline --follow HEAD -- <file>
git diff REBASE_HEAD^..HEAD -- <file>
```

diff と commit message で足りない場合だけ、関連 PR や issue を確認する。GitHub へのアクセスが使えなければ、手元の履歴から断定せず、その制約を示す。

解消方針はファイルごとに決める。

- 追加同士: 両方を残し、重複を除く。
- 同じ目的の変更: 現在の構造に合う実装へ統合する。
- リファクタと機能追加: target 側の新しい構造へ機能の意図を移植する。
- 削除と編集: 削除理由と編集の目的を比較し、どちらも満たせなければ確認する。
- 仕様が矛盾: commit / PR から優先関係が確定しない限りユーザーへ確認する。

## 3. 解消して継続する

ファイルを編集した後に確認する。

```bash
git diff --check
git diff --name-only --diff-filter=U
git diff
```

コンフリクトマーカーと未解消ファイルがなく、解消内容が適用中 commit の意図を保っていることを確認してから進める。

```bash
git add <resolved-files>
GIT_EDITOR=true git rebase --continue
```

空 commit になった場合は、target 側で同じ変更が既に実現されていることを確認してから `git rebase --skip` を使う。安易に skip しない。

判断を誤った、または安全に続行できない場合は `git rebase --abort` で開始前へ戻す。ユーザーの明示なしに commit を編集・結合する interactive rebase へ切り替えない。

## Lockfile のコンフリクト

`package.json` の双方の依存関係・scripts の意図を先に統合する。その後、`pnpm-lock.yaml` のコンフリクト版を stage せず、作業ツリー上のマーカーを除去して次で再生成する。

```bash
pnpm install --lockfile-only
git add package.json pnpm-lock.yaml
```

ネットワークや install script の実行が必要になり許可・環境が足りなければ、その時点で停止して状況を報告する。
