"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/state/error-state";

/**
 * 画面の描画中に投げられた例外の受け皿（FE-20）。
 *
 * Next.js 16 の error.tsx は `reset` ではなく `retry` を受け取る。
 * `reset` が再取得なしに描き直すだけなのに対し、`retry` は再取得からやり直す
 * （node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md）。
 * 通信の失敗から戻したいので、ここでは `retry` を使う。
 */
export default function AppSegmentError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // 監視サービスはまだ無いので、当面はブラウザのログに残す
    console.error(error);
  }, [error]);

  return <ErrorState onRetry={retry} />;
}
