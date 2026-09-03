import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "パスワードの再設定",
  description: "みちナビのパスワードを再設定します。",
};

type ForgotPasswordPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  // /auth/confirm がリンクの検証に失敗したときに付ける印
  const linkExpired = (await searchParams).error === "link_expired";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center overflow-x-hidden bg-brand px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] sm:py-12">
      <ForgotPasswordForm linkExpired={linkExpired} />
    </main>
  );
}
