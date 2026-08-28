import { createEnv } from "@t3-oss/env-nextjs";
import z from "zod";

/**
 * ブラウザに載る環境変数。
 *
 * ここに書いた値はクライアントバンドルへ焼き込まれる。
 * 秘密は置けない（publishable key は公開前提の鍵なので問題ない）。
 * サーバー側から読んでも構わない。
 */
export const env = createEnv({
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string(),
  },
  // Server Component / Route Handler
  server: {
    APP_ENV: z.enum(["production", "preview", "local"]),
    DEV_AUTH_BYPASS: z.enum(["true", "false"]).default("false"),
  },
  runtimeEnv: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    APP_ENV: process.env.APP_ENV,
    DEV_AUTH_BYPASS: process.env.DEV_AUTH_BYPASS,
  },
});
