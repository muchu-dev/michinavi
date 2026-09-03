import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "@/components/auth/login-form";
import { env } from "@/env.frontend";
import { isDevelopmentAuthBypassEnabled } from "@/lib/auth/development-bypass";
import { resolveRedirectPath } from "@/lib/auth/redirect-target";

export const metadata: Metadata = {
  title: "ログイン",
  description: "みちナビへログインします。",
};

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const previewHref = isDevelopmentAuthBypassEnabled({
    appEnv: env.APP_ENV,
    flag: env.DEV_AUTH_BYPASS,
    nodeEnv: process.env.NODE_ENV,
  })
    ? "/onboarding"
    : undefined;

  // proxy が付けた戻り先。ここで検証し、フォームには安全な値だけを渡す
  const nextPath = resolveRedirectPath((await searchParams).next);

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

      <LoginForm nextPath={nextPath} previewHref={previewHref} />
    </main>
  );
}
