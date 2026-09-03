import type { Database } from "@michinavi/db";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/env.frontend";
import { isDevelopmentAuthBypassEnabled } from "@/lib/auth/development-bypass";
import { resolveRedirectPath } from "@/lib/auth/redirect-target";

/** ログインしていなくても開ける画面。`/auth` は再設定メールの受け口 */
const PUBLIC_PATHS = ["/login", "/forgot-password", "/auth"];

/**
 * ログイン済みで開いてもすることが無く、アプリ側へ戻す画面。
 *
 * `/forgot-password` と `/reset-password` は含めない。
 * 再設定の途中は回復用のセッションを持った状態で開くし、
 * リンクが期限切れだったときの案内もこの 2 画面に出るためである。
 */
const SIGNED_IN_REDIRECT_PATHS = ["/login"];

function matchesPath(pathname: string, paths: string[]) {
  return paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function updateSession(request: NextRequest) {
  if (
    isDevelopmentAuthBypassEnabled({
      appEnv: env.APP_ENV,
      flag: env.DEV_AUTH_BYPASS,
      nodeEnv: process.env.NODE_ENV,
    })
  ) {
    const bypassResponse = NextResponse.next({ request });
    bypassResponse.headers.set("x-michinavi-auth-bypass", "development-only");
    bypassResponse.headers.set("cache-control", "private, no-store");
    return bypassResponse;
  }

  let response = NextResponse.next({ request });
  const authResponseHeaders = new Headers();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          response = NextResponse.next({ request });

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }

          for (const [name, value] of Object.entries(headers)) {
            response.headers.set(name, value);
            authResponseHeaders.set(name, value);
          }
        },
      },
    },
  );

  // Cookie内のユーザー情報は信用せず、署名済みJWTを検証する。
  const { data } = await supabase.auth.getClaims();
  const { pathname, search } = request.nextUrl;

  /**
   * 更新されたセッションCookieと認証ヘッダーを引き継いだリダイレクトを作る。
   * 引き継がないと、リダイレクト先でトークンの更新が失われる。
   */
  const redirectTo = (url: URL) => {
    const redirectResponse = NextResponse.redirect(url);

    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    for (const [name, value] of authResponseHeaders) {
      redirectResponse.headers.set(name, value);
    }

    return redirectResponse;
  };

  if (!data?.claims) {
    if (matchesPath(pathname, PUBLIC_PATHS)) {
      return response;
    }

    const loginUrl = new URL("/login", request.nextUrl.origin);
    const requestedPath = `${pathname}${search}`;

    // 開こうとした画面へログイン後に戻れるようにする。
    // 遷移先そのものではなくパスだけを渡し、受け取る側で必ず検証する
    if (requestedPath !== "/") {
      loginUrl.searchParams.set("next", requestedPath);
    }

    return redirectTo(loginUrl);
  }

  if (matchesPath(pathname, SIGNED_IN_REDIRECT_PATHS)) {
    const target = resolveRedirectPath(
      request.nextUrl.searchParams.get("next"),
    );
    return redirectTo(new URL(target, request.nextUrl.origin));
  }

  return response;
}
