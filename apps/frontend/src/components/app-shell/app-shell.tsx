import type { ReactNode } from "react";
import { OfflineBanner } from "@/components/state/offline-banner";
import { AppNavigation } from "./app-navigation";
import { QuickPostAction } from "./quick-post-action";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-app-canvas md:px-6 md:py-5">
      <a className="skip-link" href="#main-content">
        本文へ移動
      </a>
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[30rem] flex-col overflow-hidden bg-surface shadow-app [&:has([data-app-header-tone=brand])>header]:bg-brand [&:has([data-app-header-tone=caution])>header]:bg-caution [&:has([data-app-header-tone=caution])>header]:text-ink md:min-h-[calc(100dvh-2.5rem)] md:rounded-[2rem] md:border md:border-outline">
        <header className="sticky top-0 z-[1000] flex min-h-16 items-center justify-between gap-4 bg-brand px-5 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] text-white">
          <div>
            <p className="text-lg font-black tracking-[0.08em]">みちナビ</p>
            <p className="text-sm font-semibold text-current">
              地域防災ナビゲーション
            </p>
          </div>
          <span className="rounded-full border border-current px-3 py-1 text-sm font-bold">
            デモ
          </span>
        </header>
        <OfflineBanner />
        <main
          id="main-content"
          className="flex min-h-0 flex-1 flex-col bg-app-surface"
        >
          {children}
        </main>
        <QuickPostAction />
        <AppNavigation />
      </div>
    </div>
  );
}
