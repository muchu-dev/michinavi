"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { env } from "@/env.frontend";
import { resolveSiteOrigin } from "@/lib/auth/site-url";
import { createSupabaseServerActionClient } from "@/lib/supabase/server-action";
import type { PasswordResetRequestState } from "./state";

/** 再設定メールのリンクを受ける Route Handler */
const RESET_CALLBACK_PATH = "/auth/confirm";

/** リンクを検証したあとに開く画面 */
const RESET_FORM_PATH = "/reset-password";

const requestSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { error: "メールアドレスを入力してください。" })
    .pipe(z.email({ error: "有効なメールアドレスを入力してください。" })),
});

const SENT_MESSAGE =
  "入力されたメールアドレス宛に再設定用のリンクを送りました。メールをご確認ください。";

type AuthErrorLike = {
  code?: string | null;
  status?: number;
  message?: string;
};

function isRateLimited(error: AuthErrorLike) {
  return (
    error.status === 429 ||
    error.code === "over_email_send_rate_limit" ||
    error.code === "over_request_rate_limit"
  );
}

/**
 * パスワード再設定用のメールを送る。
 *
 * 宛先が登録済みかどうかは応答に出さない。
 * 「送った／そのアドレスは無い」を出し分けると、この画面が
 * 「誰がこのアプリを使っているか」を確かめる道具になる。
 * 送信の可否にかかわらず同じ文言を返す。
 */
export async function requestPasswordReset(
  _previousState: PasswordResetRequestState,
  formData: FormData,
): Promise<PasswordResetRequestState> {
  const email = String(formData.get("email") ?? "");
  const result = requestSchema.safeParse({ email });

  if (!result.success) {
    return {
      fieldErrors: result.error.flatten().fieldErrors,
      values: { email },
    };
  }

  try {
    const redirectTo = new URL(
      RESET_CALLBACK_PATH,
      resolveSiteOrigin(await headers(), env.SITE_URL),
    );
    redirectTo.searchParams.set("next", RESET_FORM_PATH);

    const supabase = await createSupabaseServerActionClient();
    const { error } = await supabase.auth.resetPasswordForEmail(
      result.data.email,
      { redirectTo: redirectTo.toString() },
    );

    // 回数制限だけは伝える。アドレスの有無ではなく送信元の頻度で決まるため、
    // 誰のアカウントがあるかは漏れない
    if (error && isRateLimited(error)) {
      return {
        status: "error",
        message:
          "メールの送信が上限に達しました。しばらく時間をおいてからもう一度お試しください。",
        values: { email: result.data.email },
      };
    }
  } catch {
    return {
      status: "error",
      message:
        "メールを送信できませんでした。時間をおいてもう一度お試しください。",
      values: { email: result.data.email },
    };
  }

  return { status: "sent", message: SENT_MESSAGE };
}
