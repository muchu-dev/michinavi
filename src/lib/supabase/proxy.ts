import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { isDevelopmentAuthBypassEnabled } from "@/lib/auth/development-bypass";
import type { Database } from "@/lib/supabase/database.types";

const PUBLIC_PATHS = ["/login", "/forgot-password"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
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
          }
        },
      },
    },
  );

  // Cookie内のユーザー情報は信用せず、署名済みJWTを検証する。
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims && !isPublicPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
