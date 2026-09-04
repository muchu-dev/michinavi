"use client";

import { useEffect, useRef, useState } from "react";
import type { ReportReason } from "@/lib/report/report-reasons";
import {
  describeReportFailure,
  isAlreadyReportedError,
  isReported,
  toContentFlagInput,
} from "@/lib/report/reported-reports";
import { api } from "@/lib/trpc/client";
import { ReportDialog } from "./report-dialog";

type ReportButtonProps = {
  /** 通報する投稿の ID */
  fieldReportId: string;
  /** ダイアログに出す、対象が何かを示す一言 */
  targetSummary: string;
};

/**
 * 投稿からの通報の導線（FE-18、S4）。
 *
 * 通報は `contentFlag.create` で運営へ送り（BE-24）、通報済みかどうかは
 * `contentFlag.mine` の応答から決める。送信できなかったときに「通報済みです」を
 * 出してしまうと、届いていない通報を届いたと誤解させるため、
 * 表示を切り替えるのは mutation が成功したときだけにしている。
 */
export function ReportButton({
  fieldReportId,
  targetSummary,
}: ReportButtonProps) {
  const myFlags = api.contentFlag.mine.useQuery(undefined, {
    // 未ログインなら UNAUTHORIZED が返る。何度も叩き直しても結果は変わらない
    retry: false,
  });
  const apiUtils = api.useUtils();
  const createFlag = api.contentFlag.create.useMutation();

  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const wasOpenRef = useRef(false);

  /**
   * 送信できた直後は、mine の取り直しを待たずに「通報済み」を出す。
   * 取り直しに失敗しても、届いた通報が未通報に見えることはない。
   */
  const reported = justSubmitted || isReported(myFlags.data, fieldReportId);

  /** ダイアログを閉じたら、開いた起点へフォーカスを戻す（通報済みなら、その知らせへ） */
  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      return;
    }

    if (!wasOpenRef.current) {
      return;
    }

    wasOpenRef.current = false;
    (triggerRef.current ?? statusRef.current)?.focus();
  }, [isOpen]);

  async function handleSubmit(input: { reason: ReportReason; note: string }) {
    setErrorMessage(null);

    try {
      await createFlag.mutateAsync(
        toContentFlagInput({
          fieldReportId,
          reason: input.reason,
          note: input.note,
        }),
      );
    } catch (error) {
      // すでに自分が通報している対象は、送り直せないだけで運営には届いている
      if (!isAlreadyReportedError(error)) {
        setErrorMessage(describeReportFailure(error));
        return;
      }
    }

    setJustSubmitted(true);
    setIsOpen(false);
    // 画面を離れて戻ってきても通報済みのままにするため、サーバの記録を取り直す
    await apiUtils.contentFlag.mine.invalidate();
  }

  if (reported) {
    return (
      <p
        ref={statusRef}
        // 送信直後だけ読み上げる。再訪時の「通報済み」は割り込ませない
        aria-live={justSubmitted ? "polite" : "off"}
        tabIndex={-1}
        className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-outline bg-app-surface px-4 text-sm font-black text-muted focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {/* 色だけに頼らず、記号と文字の両方で通報済みを示す */}
        <span aria-hidden="true">✓</span>
        通報済みです
      </p>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className="min-h-11 w-full rounded-2xl border border-outline bg-surface px-4 text-sm font-black text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        この投稿を通報する
      </button>
      {isOpen ? (
        <ReportDialog
          targetSummary={targetSummary}
          isSubmitting={createFlag.isPending}
          errorMessage={errorMessage}
          onSubmit={handleSubmit}
          onClose={() => {
            setIsOpen(false);
            setErrorMessage(null);
          }}
        />
      ) : null}
    </>
  );
}
