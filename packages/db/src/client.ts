import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * ログインユーザーの JWT を引き継ぐ Supabase クライアント。
 * RLS が効くため、画面からの読み書きは原則こちらを使う
 * （docs/er/00-conventions.md#db-クライアントの使い分け）。
 */
export type RequestSupabaseClient = SupabaseClient<Database>;

/**
 * Supabase への接続情報。
 *
 * このパッケージから `@/env` を読まないのは、依存の向きを
 * アプリ → パッケージの一方向に保つためである。
 * 呼び出し側（Next.js なら検証済みの `env`）が渡す。
 */
export type SupabaseConnection = {
  url: string;
  publishableKey: string;
};

const BEARER_PATTERN = /^Bearer\s+(.+)$/i;

/**
 * リクエストのヘッダーから Supabase クライアントとログインユーザーを組み立てる。
 *
 * `next/headers` に依存させないのは、tRPC の呼び出し元（Route Handler、テスト）を
 * 問わず同じ経路で認証を解決するためである。
 */
export async function createSupabaseRequestContext(
  headers: Headers,
  connection: SupabaseConnection,
): Promise<{
  supabase: RequestSupabaseClient;
  user: User | null;
}> {
  const accessToken = headers.get("authorization")?.match(BEARER_PATTERN)?.[1];

  if (accessToken) {
    const supabase = createBearerClient(accessToken, connection);
    // ヘッダーで受け取ったトークンは信用できないため、認証サーバーに検証させる
    const { data } = await supabase.auth.getUser(accessToken);
    return { supabase, user: data.user };
  }

  const supabase = createCookieClient(headers.get("cookie") ?? "", connection);
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

/**
 * `Authorization: Bearer <JWT>` で受け取ったトークンを使うクライアント。
 * global.headers の Authorization は supabase-js のセッションより優先されるため、
 * PostgREST への問い合わせもこのトークンで実行される。
 */
function createBearerClient(
  accessToken: string,
  connection: SupabaseConnection,
): RequestSupabaseClient {
  return createClient<Database>(connection.url, connection.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/**
 * Cookie に載ったセッションを使うクライアント。ブラウザからの呼び出しはこちらになる。
 *
 * 書き戻しを行わないのは、Route Handler の応答ヘッダーへ触れないためである。
 * トークンの更新は middleware 側で行う前提に立つ。
 */
function createCookieClient(
  cookieHeader: string,
  connection: SupabaseConnection,
): RequestSupabaseClient {
  return createServerClient<Database>(
    connection.url,
    connection.publishableKey,
    {
      cookies: {
        getAll: () => parseCookieHeader(cookieHeader),
        setAll: () => {
          // 読み取り専用
        },
      },
    },
  );
}
