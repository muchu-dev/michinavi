import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type DemoSeedConnection,
  demoCredentials,
  seedDemoData,
} from "../src/demo/seed-demo-data.ts";

/**
 * デモ用データを投入する CLI（BE-26）。
 *
 *   pnpm demo:seed
 *
 * 接続情報は環境変数から読む。無ければ起動中のローカル Supabase に
 * 問い合わせる（vitest.config.mts と同じやり方）。鍵をリポジトリに
 * 置くと、本番の値をうっかり混ぜたときに気づけないためである。
 */

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

function supabaseBin(): string {
  return path.resolve(
    repoRoot,
    process.platform === "win32"
      ? "node_modules/.bin/supabase.CMD"
      : "node_modules/.bin/supabase",
  );
}

function localSupabaseEnv(): DemoSeedConnection {
  let output: string;

  try {
    output = execFileSync(
      supabaseBin(),
      ["--workdir", "packages/db", "status", "-o", "env"],
      {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        shell: process.platform === "win32",
      },
    );
  } catch {
    throw new Error(
      "接続情報が見つかりません。`pnpm db:start` でローカルの Supabase を起動するか、NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY を渡してください。",
    );
  }

  const values: Record<string, string> = {};

  for (const line of output.split("\n")) {
    const matched = line.match(/^([A-Z0-9_]+)="(.*)"$/);
    if (matched?.[1] && matched[2]) {
      values[matched[1]] = matched[2];
    }
  }

  const url = values.API_URL;
  const secretKey = values.SECRET_KEY;
  const publishableKey = values.PUBLISHABLE_KEY;

  if (!url || !secretKey || !publishableKey) {
    throw new Error("`supabase status` から接続情報を読み取れませんでした。");
  }

  return { url, secretKey, publishableKey };
}

function connection(): DemoSeedConnection {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  return url && secretKey && publishableKey
    ? { url, secretKey, publishableKey }
    : localSupabaseEnv();
}

async function main(): Promise<void> {
  const summary = await seedDemoData(connection());

  console.log(
    `デモ用データを投入しました: ${summary.households} 世帯 / ${summary.members} 人 / ${summary.reports} 件の投稿 / ${summary.estimatedMeshes} 地点の推定`,
  );
  console.log("");
  console.log("デモ用のログイン情報（すべて架空のアカウント）:");

  for (const credential of demoCredentials) {
    console.log(
      `  ${credential.householdName}: ${credential.email} / ${credential.password}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
