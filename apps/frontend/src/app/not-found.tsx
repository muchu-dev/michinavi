import Link from "next/link";
import { StateMessage } from "@/components/state/state-message";

/**
 * 存在しない画面を開いたときの表示（FE-20）。
 *
 * デモ中に URL を打ち間違えても、地図へ戻る導線があれば止まらない。
 */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-app-surface">
      <StateMessage
        symbol="🧭"
        title="この画面は見つかりませんでした"
        description="住所が変わったか、まだ用意できていない画面です。地図に戻ると、いまの状況を確認できます。"
        action={
          <Link
            href="/"
            className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-brand px-5 text-sm font-black text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            地図に戻る
          </Link>
        }
      />
    </main>
  );
}
