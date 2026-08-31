"use client";

import { useSyncExternalStore } from "react";

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);

  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

/**
 * 端末がネットワークにつながっているか（FE-20）。
 *
 * サーバ側では常に「つながっている」として描く。切れている前提で描くと、
 * 実際にはつながっている端末で一瞬オフラインの帯が出てちらつく。
 *
 * `navigator.onLine` が true でも、圏内で通信が通らない状態は検出できない。
 * その場合は取得の失敗として ErrorState 側で扱う。
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
