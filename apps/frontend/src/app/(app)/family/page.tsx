import type { Metadata } from "next";
import Link from "next/link";
import { FamilyStatusBoard } from "@/components/family/family-status-board";
import { ChevronRight } from "@/components/ui/chevron-right";

export const metadata: Metadata = {
  title: "家族",
  description: "連携している家族の避難状況を確認します。",
};

export default function FamilyPage() {
  return (
    <section className="flex flex-1 flex-col bg-surface px-7 py-14 sm:px-9">
      <h1 className="sr-only">家族の状況</h1>

      {/* 安否は取得のたびに変わるので、この部分だけクライアント側で読み込む。 */}
      <FamilyStatusBoard />

      <Link
        href="/family/settings"
        className="mt-14 flex min-h-12 items-center justify-between gap-5 rounded-lg text-muted outline-none transition-colors hover:text-brand focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-brand"
      >
        <span className="text-family-label leading-tight font-normal text-muted">
          設定
        </span>
        <ChevronRight />
      </Link>
    </section>
  );
}
