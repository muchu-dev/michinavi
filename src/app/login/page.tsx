import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "@/components/auth/login-form";
import { env } from "@/env";
import { isDevelopmentAuthBypassEnabled } from "@/lib/auth/development-bypass";

export const metadata: Metadata = {
  title: "ログイン",
  description: "みちナビへログインします。",
};

export default function LoginPage() {
  const previewHref = isDevelopmentAuthBypassEnabled({
    appEnv: env.APP_ENV,
    flag: env.DEV_AUTH_BYPASS,
    nodeEnv: process.env.NODE_ENV,
  })
    ? "/onboarding"
    : undefined;

  return (
    <main className="flex min-h-dvh flex-col items-center overflow-x-hidden bg-brand px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] sm:justify-center sm:py-12">
      <div className="mb-5 flex shrink-0 flex-col items-center sm:mb-7">
        <Image
          alt=""
          aria-hidden="true"
          className="size-36 sm:size-40"
          height="444"
          src="/michinavi-logo.svg"
          width="444"
        />
        <p className="-mt-2 text-2xl font-black tracking-[0.12em] text-white">
          みちナビ
        </p>
      </div>

      <LoginForm previewHref={previewHref} />
    </main>
  );
}
