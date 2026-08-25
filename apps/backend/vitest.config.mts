import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * supabase CLI はルートに、その設定（config.toml とマイグレーション）は
 * packages/db にある。vitest は packages/api で動くため、両方を明示して呼ぶ。
 */
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

/**
 * ローカルの Supabase から接続情報を取り出す。
 * 鍵をリポジトリに置くと、本番の値をうっかり混ぜたときに気づけないため、
 * 起動中のスタックへ都度問い合わせる。
 */
function localSupabaseEnv(): Record<string, string> {
  let output: string;

  try {
    output = execFileSync(
      "./node_modules/.bin/supabase",
      ["--workdir", "packages/db", "status", "-o", "env"],
      {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
  } catch {
    throw new Error(
      "ローカルの Supabase に接続できません。`pnpm db:start` を実行してからテストしてください。",
    );
  }

  const values: Record<string, string> = {};

  for (const line of output.split("\n")) {
    const matched = line.match(/^([A-Z0-9_]+)="(.*)"$/);
    if (matched?.[1] && matched[2]) {
      values[matched[1]] = matched[2];
    }
  }

  const apiUrl = values.API_URL;
  const publishableKey = values.PUBLISHABLE_KEY;
  const secretKey = values.SECRET_KEY;

  if (!apiUrl || !publishableKey || !secretKey) {
    throw new Error("`supabase status` から接続情報を読み取れませんでした。");
  }

  return {
    APP_ENV: "local",
    NEXT_PUBLIC_SUPABASE_URL: apiUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    // RLS を迂回する鍵。テストの検証と後片付けだけに使う
    SUPABASE_SECRET_KEY: secretKey,
  };
}

export default defineConfig({
  test: {
    environment: "node",
    // テストは実装の隣の __tests__/ に置く
    include: ["src/**/__tests__/**/*.test.ts"],
    env: localSupabaseEnv(),
    // 同じ DB を触るのでファイル間は直列に実行する
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
