import { type NextRequest, NextResponse } from "next/server";
import { resolveRedirectPath } from "@/lib/auth/redirect-target";
import { createSupabaseServerActionClient } from "@/lib/supabase/server-action";

/** リンクの検証に成功したときに開く既定の画面 */
const RESET_FORM_PATH = "/reset-password";

/** 期限切れや改ざんで検証できなかったときの戻り先 */
const LINK_EXPIRED_PATH = "/forgot-password?error=link_expired";

/**
 * 再設定メールのリンクを受け取り、セッションCookieを発行する。
 *
 * Server Action ではなく Route Handler に置くのは、メールのリンクが
 * GET で戻ってくるためである。Cookie を書き戻す必要があるので、
 * 読み取り専用のリクエスト用クライアントではなく Server Action 用を使う。
 *
 * 扱うのは `recovery` だけに絞る。ほかの種別（メールアドレスの変更など）まで
 * ここで通すと、想定していない操作が同じ入口から完了してしまう。
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  // 遷移先はメールのリンクに載って戻ってくるため、必ず検証してから使う
  const next = resolveRedirectPath(searchParams.get("next"), RESET_FORM_PATH);

  if (tokenHash && type === "recovery") {
    const supabase = await createSupabaseServerActionClient();
    const { error } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: tokenHash,
    });

    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  } else if (!tokenHash && code) {
    // 既定のメールテンプレート（ConfirmationURL）から戻ると PKCE の code が付く
    const supabase = await createSupabaseServerActionClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL(LINK_EXPIRED_PATH, origin));
}
