"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { resolveRedirectPath } from "@/lib/auth/redirect-target";
import { createSupabaseServerActionClient } from "@/lib/supabase/server-action";
import type { LoginActionState } from "./state";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { error: "メールアドレスを入力してください。" })
    .pipe(z.email({ error: "有効なメールアドレスを入力してください。" })),
  password: z.string().min(1, { error: "パスワードを入力してください。" }),
});

/** Supabase が返す認証エラー。SDK の型に依存せず、見る値だけを書き出す */
type AuthErrorLike = {
  code?: string | null;
  status?: number;
  message?: string;
};

/**
 * 認証の失敗を利用者向けの文言へ移す。
 *
 * 資格情報の誤りは、メールアドレスの存在有無を推測させないため一律の文言にする。
 * 一方で回数制限とメール未確認まで同じ文言にすると、
 * 「パスワードは合っているのに何度やっても入れない」状態で手が止まる。
 * この 2 つだけは、次に何をすればよいかが分かる文言に分ける。
 */
function describeSignInFailure(error: AuthErrorLike): string {
  if (error.status === 429 || error.code === "over_request_rate_limit") {
    return "試行の回数が上限に達しました。しばらく時間をおいてからもう一度お試しください。";
  }

  if (error.code === "email_not_confirmed") {
    return "メールアドレスの確認が済んでいません。届いている確認メールをご確認ください。";
  }

  return "メールアドレスまたはパスワードが正しくありません。";
}

export async function login(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  // ログイン前に開こうとしていた画面。値は必ず検証してから遷移先に使う
  const next = resolveRedirectPath(formData.get("next"));
  const result = loginSchema.safeParse({ email, password });

  if (!result.success) {
    return {
      fieldErrors: result.error.flatten().fieldErrors,
      values: { email, next },
    };
  }

  try {
    const supabase = await createSupabaseServerActionClient();
    const { error } = await supabase.auth.signInWithPassword(result.data);

    if (error) {
      return {
        message: describeSignInFailure(error),
        values: { email: result.data.email, next },
      };
    }
  } catch {
    return {
      message: "ログインできませんでした。時間をおいてもう一度お試しください。",
      values: { email: result.data.email, next },
    };
  }

  redirect(next);
}
