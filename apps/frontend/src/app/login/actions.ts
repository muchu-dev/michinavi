"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerActionClient } from "@/lib/supabase/server-action";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { error: "メールアドレスを入力してください。" })
    .pipe(z.email({ error: "有効なメールアドレスを入力してください。" })),
  password: z.string().min(1, { error: "パスワードを入力してください。" }),
});

export type LoginActionState = {
  fieldErrors?: {
    email?: string[];
    password?: string[];
  };
  message?: string;
  values?: { email: string };
};

export const initialLoginState: LoginActionState = {};

export async function login(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const result = loginSchema.safeParse({ email, password });

  if (!result.success) {
    return {
      fieldErrors: result.error.flatten().fieldErrors,
      values: { email },
    };
  }

  try {
    const supabase = await createSupabaseServerActionClient();
    const { error } = await supabase.auth.signInWithPassword(result.data);

    if (error) {
      return {
        message: "メールアドレスまたはパスワードが正しくありません。",
        values: { email: result.data.email },
      };
    }
  } catch {
    return {
      message: "ログインできませんでした。時間をおいてもう一度お試しください。",
      values: { email: result.data.email },
    };
  }

  redirect("/onboarding");
}
