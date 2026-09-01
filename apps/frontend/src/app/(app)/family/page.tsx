import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "@/components/ui/chevron-right";

export const metadata: Metadata = {
  title: "家族",
  description: "連携している家族の避難状況を確認します。",
};

const statusDetails = {
  evacuated: {
    label: "避難済み",
    className: "bg-neutral-soft text-ink",
  },
  needs_help: {
    label: "支援が必要",
    className: "bg-caution text-caution-contrast",
  },
} as const;

type FamilyStatus = keyof typeof statusDetails;

const familyMembers = [
  {
    name: "母",
    status: "evacuated",
  },
  {
    name: "父",
    status: "needs_help",
  },
] as const satisfies ReadonlyArray<{ name: string; status: FamilyStatus }>;

export default function FamilyPage() {
  return (
    <section className="flex flex-1 flex-col bg-surface px-7 py-14 sm:px-9">
      <h1 className="sr-only">家族の状況</h1>

      <p className="mb-8 text-sm font-bold text-caution-ink">
        サンプル表示です
      </p>

      <ul aria-label="家族の避難状況" className="space-y-10">
        {familyMembers.map((member) => {
          const status = statusDetails[member.status];

          return (
            <li
              key={member.name}
              className="flex min-h-[3.25rem] items-center justify-between gap-5"
            >
              <span className="text-family-label leading-tight font-normal text-muted">
                {member.name}
              </span>
              <span
                className={`text-family-label flex min-h-[3.25rem] w-[min(15rem,64vw)] items-center justify-center rounded-full px-5 text-center leading-tight font-bold ${status.className}`}
              >
                {status.label}
              </span>
            </li>
          );
        })}
      </ul>

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
