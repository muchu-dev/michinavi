"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { DEFAULT_SIGNED_IN_PATH } from "@/lib/auth/redirect-target";
import { createSupabaseServerActionClient } from "@/lib/supabase/server-action";
import type { PasswordUpdateState } from "./state";

const updateSchema = z
  .object({
    password: z
      .string()
      .min(8, { error: "パスワードは8文字以上で入力してください。" }),
    passwordConfirmation: z.string(),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    error: "確認用のパスワードが一致しません。",
    path: ["passwordConfirmation"],
  });

type AuthErrorLike = {
  code?: string | null;
  status?: number;
  message?: string;
};

/**
 * パスワードの変更に失敗した理由を利用者向けの文言へ移す。
 *
 * 回復用のセッションが切れている場合だけは、入力し直しても直らない。
 * メールを送り直す動線に戻す必要があるため、ほかの失敗と分けて伝える。
 */
function describeUpdateFailure(error: AuthErrorLike): PasswordUpdateState {
  if (error.code === "weak_password") {
    return {
      fieldErrors: {
        password: [
          "推測されやすいパスワードです。別のパスワードを入力してください。",
        ],
      },
    };
  }

  if (error.code === "same_password") {
    return {
      fieldErrors: {
        password: [
          "現在のパスワードと同じです。別のパスワードを入力してください。",
        ],
      },
    };
  }

  if (
    error.status === 401 ||
    error.status === 403 ||
    error.code === "session_not_found" ||
    error.code === "session_expired"
  ) {
    return {
      message:
        "再設定用のリンクの有効期限が切れています。もう一度メールを送信してください。",
    };
  }

  return {
    message:
      "パスワードを変更できませんでした。時間をおいてもう一度お試しください。",
  };
}

/**
 * 回復用のセッションを持った状態で、新しいパスワードを保存する。
 *
 * 対象の利用者はセッションから決まる。入力にメールアドレスを持たないのは、
 * 他人のアドレスを送っても書き換えられないようにするためである。
 */
export async function updatePassword(
  _previousState: PasswordUpdateState,
  formData: FormData,
): Promise<PasswordUpdateState> {
  const result = updateSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    passwordConfirmation: String(formData.get("passwordConfirmation") ?? ""),
  });

  if (!result.success) {
    return { fieldErrors: result.error.flatten().fieldErrors };
  }

  try {
    const supabase = await createSupabaseServerActionClient();
    const { error } = await supabase.auth.updateUser({
      password: result.data.password,
    });

    if (error) {
      return describeUpdateFailure(error);
    }
  } catch {
    return {
      message:
        "パスワードを変更できませんでした。時間をおいてもう一度お試しください。",
    };
  }

  redirect(DEFAULT_SIGNED_IN_PATH);
}
