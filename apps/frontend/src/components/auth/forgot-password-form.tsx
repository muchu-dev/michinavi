"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  initialPasswordResetRequestState,
  type PasswordResetRequestState,
  requestPasswordReset,
} from "@/app/forgot-password/actions";

type PasswordResetRequestAction = (
  state: PasswordResetRequestState,
  formData: FormData,
) => Promise<PasswordResetRequestState>;

type ForgotPasswordFormProps = {
  action?: PasswordResetRequestAction;
  /** 再設定リンクの検証に失敗して戻ってきた場合に立てる */
  linkExpired?: boolean;
};

const BACK_TO_LOGIN_CLASS =
  "mt-5 inline-block rounded-sm text-sm font-medium text-foreground underline decoration-1 underline-offset-3 hover:decoration-brand focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand";

export function ForgotPasswordForm({
  action = requestPasswordReset,
  linkExpired,
}: ForgotPasswordFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    initialPasswordResetRequestState,
  );
  const emailError = state.fieldErrors?.email?.[0];

  if (state.status === "sent") {
    return (
      <section
        aria-labelledby="forgot-password-title"
        className="w-full max-w-[18.25rem] rounded-lg bg-surface px-5 py-6 text-foreground shadow-card sm:max-w-[20rem] sm:px-6"
      >
        <h1 className="text-base font-bold" id="forgot-password-title">
          パスワードの再設定
        </h1>
        <output className="mt-4 block rounded-lg bg-brand-soft/40 px-3 py-2 text-sm leading-6">
          {state.message}
        </output>
        <p className="mt-4 text-xs leading-relaxed text-muted">
          メールが届かない場合は、迷惑メールに振り分けられていないかご確認ください。
        </p>
        <Link className={BACK_TO_LOGIN_CLASS} href="/login">
          ログイン画面へ戻る
        </Link>
      </section>
    );
  }

  return (
    <form
      action={formAction}
      aria-labelledby="forgot-password-title"
      className="w-full max-w-[18.25rem] rounded-lg bg-surface px-5 py-6 text-foreground shadow-card sm:max-w-[20rem] sm:px-6"
      noValidate
    >
      <h1 className="text-base font-bold" id="forgot-password-title">
        パスワードの再設定
      </h1>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        登録したメールアドレスへ、パスワードを再設定するためのリンクをお送りします。
      </p>

      {linkExpired ? (
        <p
          className="mt-4 rounded-lg bg-impassable-soft px-3 py-2 text-sm font-semibold text-impassable"
          role="alert"
        >
          再設定用のリンクの有効期限が切れています。もう一度メールを送信してください。
        </p>
      ) : null}

      <div className="mt-4 space-y-1.5">
        <label className="block text-sm font-medium" htmlFor="email">
          メールアドレス
        </label>
        <input
          aria-describedby={emailError ? "email-error" : undefined}
          aria-invalid={emailError ? "true" : undefined}
          autoComplete="email"
          className="min-h-10 w-full rounded-lg border border-muted bg-surface px-3 py-2 text-base outline-none transition-[border-color,box-shadow] placeholder:text-muted focus:border-brand focus:ring-3 focus:ring-brand/25 disabled:cursor-not-allowed disabled:bg-app-surface"
          defaultValue={state.values?.email}
          id="email"
          name="email"
          placeholder="name@example.com"
          type="email"
        />
        {emailError ? (
          <p className="text-xs font-medium text-impassable" id="email-error">
            {emailError}
          </p>
        ) : null}
      </div>

      {state.status === "error" && state.message ? (
        <p
          aria-live="polite"
          className="mt-4 rounded-lg bg-impassable-soft px-3 py-2 text-sm font-semibold text-impassable"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <button
        className="mt-5 flex min-h-11 w-full items-center justify-center rounded-lg bg-foreground px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-foreground/90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-wait disabled:bg-muted"
        disabled={pending}
        type="submit"
      >
        {pending ? "送信中…" : "再設定メールを送る"}
      </button>

      <Link className={BACK_TO_LOGIN_CLASS} href="/login">
        ログイン画面へ戻る
      </Link>
    </form>
  );
}
