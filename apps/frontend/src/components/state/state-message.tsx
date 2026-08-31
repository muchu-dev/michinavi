import type { ReactNode } from "react";

export type StateMessageProps = {
  /** 状態を示す記号。色だけに頼らず、記号と文言の両方で伝える */
  symbol: string;
  title: string;
  /** 何が起きているかの説明。原因が分からないときは分からないと書く */
  description: string;
  /**
   * 次にできること（DS-12）。
   * 「まだ投稿がありません」だけで終わらせると、利用者は次に何をすればよいか分からない
   */
  action?: ReactNode;
  /** 失敗は alert、それ以外は status として読み上げる */
  role?: "status" | "alert";
};

/**
 * 空・失敗・読み込み中に共通で使う表示の土台（FE-20）。
 *
 * 画面の中央に置き、横幅を制限して折り返す。長い地名やエラー文が来ても
 * 横スクロールが生えないようにするのが目的である（完了の定義「画面が崩れない」）。
 */
export function StateMessage({
  symbol,
  title,
  description,
  action,
  role = "status",
}: StateMessageProps) {
  return (
    <div
      role={role}
      className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center"
    >
      <span
        aria-hidden="true"
        className="grid size-14 shrink-0 place-items-center rounded-full bg-app-surface text-2xl"
      >
        {symbol}
      </span>
      <h2 className="max-w-[22rem] text-lg font-black break-words text-ink">
        {title}
      </h2>
      <p className="max-w-[22rem] text-sm leading-6 break-words text-muted">
        {description}
      </p>
      {action ? (
        <div className="mt-2 w-full max-w-[18rem]">{action}</div>
      ) : null}
    </div>
  );
}
