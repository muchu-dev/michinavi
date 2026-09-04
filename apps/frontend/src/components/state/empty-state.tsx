import Link from "next/link";
import type { ReactNode } from "react";
import { StateMessage } from "./state-message";

type EmptyStateProps = {
  title?: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  /**
   * 既定のリンクの代わりに置く「次にできること」。
   * すでに画面上に導線がある場合は `null` を渡して二重に出さない。
   */
  action?: ReactNode;
};

/**
 * 投稿が 0 件のときの表示（FE-20）。
 *
 * 既定の文言は投稿一覧を想定している。0 件は異常ではないので、
 * 警告の見た目にせず、次の行動へ誘う文にする。
 */
export function EmptyState({
  title = "まだこの地域の投稿がありません",
  description = "あなたの1件目が、近所の人の判断材料になります。通れた道の報告でも役に立ちます。",
  actionHref = "/posts",
  actionLabel = "いまの状況を投稿する",
  action,
}: EmptyStateProps) {
  return (
    <StateMessage
      symbol="🗒"
      title={title}
      description={description}
      action={
        action === undefined ? (
          <Link
            href={actionHref}
            className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-brand px-5 text-sm font-black text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {actionLabel}
          </Link>
        ) : (
          action
        )
      }
    />
  );
}
