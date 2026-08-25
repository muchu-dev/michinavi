import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

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
      ["status", "-o", "env"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
  } catch {
    throw new Error(
      "ローカルの Supabase に接続できません。`pnpm supabase start` を実行してからテストしてください。",
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
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: localSupabaseEnv(),
    // 同じ DB を触るのでファイル間は直列に実行する
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
