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
    // Google AI Studio で発行した Gemini API キー（BE-16）。
    // NEXT_PUBLIC_ を付けないため、ブラウザには一切渡らない。
    // 未設定でもビルド・起動は止めない。road_status_estimates の再計算だけが
    // 動かなくなる（投稿の保存自体は影響を受けない）。デプロイ環境に
    // 鍵を設定し忘れていてもアプリ全体が落ちないようにするための割り切り
    GEMINI_API_KEY: z.string().min(1).optional(),
    // 使用する Gemini モデル名。未設定なら既定値を使う。
    // バージョン名を固定すると Google 側の廃止でいきなり 404 になりうるため、
    // 切り戻しができるよう env で上書きできるようにしている
    GEMINI_MODEL: z.string().min(1).optional(),
    // RLS を迂回する service role キー（BE-16）。
    // road_status_estimates への書き込みなど、限られた用途にだけ使う。
    // 呼び出し元は src/db/service-role.ts の 1 ファイルに絞る。
    // GEMINI_API_KEY 同様、未設定でも起動は止めない
    SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  },
  // process.env をそのまま渡さないのは、emptyStringAsUndefined が
  // 渡されたオブジェクトから空文字のキーを delete するためである。
  // Next.js の NEXT_PUBLIC_* 静的解析にも、この分解した形が要る。
  runtimeEnv: {
    APP_ENV: process.env.APP_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  },
  // Vercel の管理画面は未入力を空文字で渡すことがある
  emptyStringAsUndefined: true,
});

/** DB クライアントへ渡す接続情報 */
export const supabaseConnection: SupabaseConnection = {
  url: env.NEXT_PUBLIC_SUPABASE_URL,
  publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};
