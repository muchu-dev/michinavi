"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/app/login/actions";
import { initialLoginState, type LoginActionState } from "@/app/login/state";

type LoginAction = (
  state: LoginActionState,
  formData: FormData,
) => Promise<LoginActionState>;

type LoginFormProps = {
  action?: LoginAction;
  /** ログイン後に戻る画面。proxy が付けた `next` を検証済みの形で受け取る */
  nextPath?: string;
  previewHref?: string;
};

export function LoginForm({
  action = login,
  nextPath,
  previewHref,
}: LoginFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    initialLoginState,
  );
  const emailError = state.fieldErrors?.email?.[0];
  const passwordError = state.fieldErrors?.password?.[0];

  return (
    <form
      action={formAction}
      aria-labelledby="login-title"
      className="w-full max-w-[18.25rem] rounded-lg bg-surface px-5 py-6 text-foreground shadow-card sm:max-w-[20rem] sm:px-6"
      noValidate
    >
      <h1 id="login-title" className="sr-only">
        ログイン
      </h1>

      {nextPath ? (
        <input defaultValue={nextPath} name="next" type="hidden" />
      ) : null}

      <div className="space-y-1.5">
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

      <div className="mt-4 space-y-1.5">
        <label className="block text-sm font-medium" htmlFor="password">
          パスワード
        </label>
        <input
          aria-describedby={passwordError ? "password-error" : undefined}
          aria-invalid={passwordError ? "true" : undefined}
          autoComplete="current-password"
          className="min-h-10 w-full rounded-lg border border-muted bg-surface px-3 py-2 text-base outline-none transition-[border-color,box-shadow] focus:border-brand focus:ring-3 focus:ring-brand/25 disabled:cursor-not-allowed disabled:bg-app-surface"
          id="password"
          name="password"
          type="password"
        />
        {passwordError ? (
          <p
            className="text-xs font-medium text-impassable"
            id="password-error"
          >
            {passwordError}
          </p>
        ) : null}
      </div>

      {state.message ? (
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
        {pending ? "ログイン中…" : "ログイン"}
      </button>

      <Link
        className="mt-5 inline-block rounded-sm text-sm font-medium text-foreground underline decoration-1 underline-offset-3 hover:decoration-brand focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand"
        href="/forgot-password"
      >
        パスワードをお忘れですか？
      </Link>

      {previewHref ? (
        <div className="mt-5 border-t border-outline pt-5">
          <p className="mb-2 text-xs leading-relaxed text-muted">
            開発環境では、認証せずに初回設定画面を確認できます。
          </p>
          <Link
            className="flex min-h-11 items-center justify-center rounded-lg border-2 border-brand px-4 py-2 text-sm font-bold text-brand transition-colors hover:bg-brand-soft/40 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
            href={previewHref}
          >
            初回設定をプレビュー
          </Link>
        </div>
      ) : null}
    </form>
  );
}
