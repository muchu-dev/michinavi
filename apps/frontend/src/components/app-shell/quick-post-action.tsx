"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 片手で届く位置に置く主要ボタン（FE-19）。
 *
 * 災害時に最初にやることは投稿である。画面上部の導線だけにすると、
 * 端末を持ち替えないと押せない。ナビゲーションのすぐ上、画面の右下という
 * 親指の可動域に固定で置く（docs/design/disaster-ui-checklist.md）。
 *
 * 投稿画面そのものでは重複するので出さない。
 */
export function QuickPostAction() {
  const pathname = usePathname();

  if (pathname.startsWith("/posts")) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[5.75rem] z-[900] flex justify-end px-4">
      <Link
        href="/posts"
        className="tap-target pointer-events-auto inline-flex min-h-14 items-center gap-2 rounded-full bg-brand px-6 text-base font-black text-white shadow-app focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span aria-hidden="true" className="text-xl leading-none">
          ＋
        </span>
        いまの状況を投稿
      </Link>
    </div>
  );
}
