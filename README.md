# みちナビ

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
test

test 2.
