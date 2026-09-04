"use client";

import { useOnlineStatus } from "@/lib/network/use-online-status";

/**
 * 通信が切れている間だけ出す帯（FE-20）。
 *
 * 画面を覆わず、ヘッダーの直下に差し込む。災害時に見ている情報を
 * 隠してしまうと、古い情報でも読めたはずのものが読めなくなる。
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  // <output> の暗黙のロールが status なので、role を書かずに読み上げられる
  return (
    <output className="flex min-h-11 items-center justify-center gap-2 bg-caution-soft px-4 py-2 text-sm font-black text-caution-ink">
      {/* 色だけに頼らず記号でも示す */}
      <span aria-hidden="true">⚠</span>
      通信が切れています。表示中の内容は最後に取得したものです。
    </output>
  );
}
