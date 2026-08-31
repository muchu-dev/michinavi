"use client";

import { useEffect, useState } from "react";
import type { ReportReason } from "@/lib/report/report-reasons";
import { isReported, submitReport } from "@/lib/report/reported-reports";
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
 * 通報済みかどうかは端末の記録から読む（BE-24 が入るまでの扱いは
 * lib/report/reported-reports.ts を参照）。初期表示はサーバとクライアントで
 * 揃える必要があるため、記録の読み出しはマウント後に行う。
 */
export function ReportButton({
  fieldReportId,
  targetSummary,
}: ReportButtonProps) {
  const [reported, setReported] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  useEffect(() => {
    setReported(isReported(fieldReportId));
  }, [fieldReportId]);

  async function handleSubmit(input: { reason: ReportReason; note: string }) {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await submitReport({
        fieldReportId,
        reason: input.reason,
        note: input.note === "" ? undefined : input.note,
      });

      setReported(true);
      setJustSubmitted(true);
      setIsOpen(false);
    } catch {
      setErrorMessage(
        "通報を送れませんでした。通信の状態を確かめて、もう一度お試しください。",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (reported) {
    return (
      <p
        // 送信直後だけ読み上げる。再訪時の「通報済み」は割り込ませない
        aria-live={justSubmitted ? "polite" : "off"}
        className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-outline bg-app-surface px-4 text-sm font-black text-muted"
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
        type="button"
        onClick={() => setIsOpen(true)}
        className="min-h-11 w-full rounded-2xl border border-outline bg-surface px-4 text-sm font-black text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        この投稿を通報する
      </button>
      {isOpen ? (
        <ReportDialog
          targetSummary={targetSummary}
          isSubmitting={isSubmitting}
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
