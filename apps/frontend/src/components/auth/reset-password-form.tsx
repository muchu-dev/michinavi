"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updatePassword } from "@/app/reset-password/actions";
import {
  initialPasswordUpdateState,
  type PasswordUpdateState,
} from "@/app/reset-password/state";

type PasswordUpdateAction = (
  state: PasswordUpdateState,
  formData: FormData,
) => Promise<PasswordUpdateState>;

type ResetPasswordFormProps = {
  action?: PasswordUpdateAction;
};

const INPUT_CLASS =
  "min-h-10 w-full rounded-lg border border-muted bg-surface px-3 py-2 text-base outline-none transition-[border-color,box-shadow] focus:border-brand focus:ring-3 focus:ring-brand/25 disabled:cursor-not-allowed disabled:bg-app-surface";

export function ResetPasswordForm({
  action = updatePassword,
}: ResetPasswordFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    initialPasswordUpdateState,
  );
  const passwordError = state.fieldErrors?.password?.[0];
  const confirmationError = state.fieldErrors?.passwordConfirmation?.[0];

  return (
    <form
      action={formAction}
      aria-labelledby="reset-password-title"
      className="w-full max-w-[18.25rem] rounded-lg bg-surface px-5 py-6 text-foreground shadow-card sm:max-w-[20rem] sm:px-6"
      noValidate
    >
      <h1 className="text-base font-bold" id="reset-password-title">
        パスワードの再設定
      </h1>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        新しいパスワードを8文字以上で入力してください。
      </p>

      <div className="mt-4 space-y-1.5">
        <label className="block text-sm font-medium" htmlFor="password">
          新しいパスワード
        </label>
        <input
          aria-describedby={passwordError ? "password-error" : undefined}
          aria-invalid={passwordError ? "true" : undefined}
          autoComplete="new-password"
          className={INPUT_CLASS}
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

      <div className="mt-4 space-y-1.5">
        <label
          className="block text-sm font-medium"
          htmlFor="password-confirmation"
        >
          新しいパスワード（確認）
        </label>
        <input
          aria-describedby={
            confirmationError ? "password-confirmation-error" : undefined
          }
          aria-invalid={confirmationError ? "true" : undefined}
          autoComplete="new-password"
          className={INPUT_CLASS}
          id="password-confirmation"
          name="passwordConfirmation"
          type="password"
        />
        {confirmationError ? (
          <p
            className="text-xs font-medium text-impassable"
            id="password-confirmation-error"
          >
            {confirmationError}
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
        {pending ? "変更中…" : "パスワードを変更する"}
      </button>

      <Link
        className="mt-5 inline-block rounded-sm text-sm font-medium text-foreground underline decoration-1 underline-offset-3 hover:decoration-brand focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand"
        href="/forgot-password"
      >
        メールを送り直す
      </Link>
    </form>
  );
}
