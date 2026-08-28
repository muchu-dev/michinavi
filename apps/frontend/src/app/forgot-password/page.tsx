import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "パスワードの再設定",
};

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-brand px-4 py-10">
      <section
        aria-labelledby="forgot-password-title"
        className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-card"
      >
        <p className="text-sm font-bold text-foreground">みちナビ</p>
        <h1
          className="mt-1 text-xl font-black text-foreground"
          id="forgot-password-title"
        >
          パスワードの再設定
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted">
          パスワード再設定機能は現在準備中です。ログイン画面へ戻り、登録した情報をもう一度お確かめください。
        </p>
        <Link
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-foreground px-4 py-2.5 text-sm font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
          href="/login"
        >
          ログイン画面へ戻る
        </Link>
      </section>
    </main>
  );
}
