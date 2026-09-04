import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DemoSeedConnection } from "../src/demo/seed-demo-data.ts";

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

/**
 * 解決した接続先を環境変数へ写す。
 *
 * デモ用データの投入は、推定とまとめの再計算に投稿API と同じ関数
 * （src/api/routers/road-status.ts / report-digest.ts）を使う。その経路は
 * 読み込み時に env.backend.ts の検証を通るため、接続先を決めてから
 * import する必要がある。すでに設定されている値は上書きしない。
 */
function exportConnectionToEnv(target: DemoSeedConnection): void {
  process.env.APP_ENV ??= "local";
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= target.url;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= target.publishableKey;
  process.env.SUPABASE_SECRET_KEY ??= target.secretKey;
}

async function main(): Promise<void> {
  const target = connection();
  exportConnectionToEnv(target);

  // env を整えてから読み込む（exportConnectionToEnv のコメントを参照）
  const { demoCredentials, seedDemoData } = await import(
    "../src/demo/seed-demo-data.ts"
  );
  const summary = await seedDemoData(target);

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
