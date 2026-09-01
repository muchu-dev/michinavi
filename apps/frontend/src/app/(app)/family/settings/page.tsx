import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "@/components/ui/chevron-right";

export const metadata: Metadata = {
  title: "家族の設定",
  description: "家族情報の設定と家族連携を行います。",
};

const unavailableSettings = ["家族構成の登録・更新", "個人情報の編集"];

export default function FamilySettingsPage() {
  return (
    <section className="flex flex-1 flex-col bg-surface px-7 py-8 sm:px-9">
      <h1 className="sr-only">家族の設定</h1>

      <nav aria-label="家族の設定メニュー">
        <ul className="space-y-2">
          {unavailableSettings.map((label) => (
            <li key={label}>
              <button
                type="button"
                aria-disabled="true"
                className="text-family-label flex min-h-16 w-full cursor-not-allowed items-center justify-between gap-5 rounded-lg bg-outline/30 px-3 text-left leading-tight font-normal text-muted outline-none focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-brand"
              >
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span>{label}</span>
                  <span className="text-sm font-bold">（準備中）</span>
                </span>
                <ChevronRight />
              </button>
            </li>
          ))}
          <li>
            <Link
              href="/family/connect"
              className="text-family-label flex min-h-16 items-center justify-between gap-5 rounded-lg leading-tight font-normal text-muted outline-none transition-colors hover:text-brand focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-brand"
            >
              <span>連携</span>
              <ChevronRight />
            </Link>
          </li>
        </ul>
      </nav>
    </section>
  );
}
