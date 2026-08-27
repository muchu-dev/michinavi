import type { SupabaseConnection } from "@michinavi/db";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * バックエンドが読む環境変数。
 *
 * backend と frontend は独立した 2 つの app と見なし、env も分離する。
 * NEXT_PUBLIC_* も含めて、backend で実際に使うものだけをここに置く。
 * frontend と被るキーは env.frontend.ts に独立して定義する（重複は許容）。
 *
 * env-nextjs ではなく env-core を使うのは、server に NEXT_PUBLIC_* を置くためである。
 * env-nextjs は clientPrefix を "NEXT_PUBLIC_" に固定するので、
 * 同じ前缀のキーを server に書くと型エラーになる。
 *
 * clientPrefix を渡さないため全キーが server 扱いになり、
 * ブラウザから読むと onInvalidAccess が飛ぶ。
 * package.json の exports による遮断に加えた、実行時の 2 枚目である。
 */
export const env = createEnv({
  server: {
    APP_ENV: z.enum(["production", "preview", "local"]),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  },
  // process.env をそのまま渡さないのは、emptyStringAsUndefined が
  // 渡されたオブジェクトから空文字のキーを delete するためである。
  // Next.js の NEXT_PUBLIC_* 静的解析にも、この分解した形が要る。
  runtimeEnv: {
    APP_ENV: process.env.APP_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
  // Vercel の管理画面は未入力を空文字で渡すことがある
  emptyStringAsUndefined: true,
});

/** DB クライアントへ渡す接続情報 */
export const supabaseConnection: SupabaseConnection = {
  url: env.NEXT_PUBLIC_SUPABASE_URL,
  publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};
