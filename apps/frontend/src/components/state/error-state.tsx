"use client";

import { StateMessage } from "./state-message";

type ErrorStateProps = {
  title?: string;
  description?: string;
  /** 押すともう一度読み込む。渡さなければボタンを出さない */
  onRetry?: () => void;
  retryLabel?: string;
};

/**
 * 読み込みに失敗したときの表示（FE-20）。
 *
 * 原因を断定しない。通信が切れているのか、サーバが落ちているのかは
 * 画面側からは区別できないため、「取れなかった」事実と、次にできることだけを書く。
 */
export function ErrorState({
  title = "情報を取得できませんでした",
  description = "通信が不安定か、サーバが混み合っている可能性があります。電波の届く場所でもう一度お試しください。",
  onRetry,
  retryLabel = "もう一度読み込む",
}: ErrorStateProps) {
  return (
    <StateMessage
      role="alert"
      symbol="⚠"
      title={title}
      description={description}
      action={
        onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-12 w-full rounded-2xl bg-brand px-5 text-sm font-black text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {retryLabel}
          </button>
        ) : null
      }
    />
  );
}
