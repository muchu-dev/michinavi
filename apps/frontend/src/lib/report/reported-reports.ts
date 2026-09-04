import type { ReportReason } from "./report-reasons";

/**
 * 通報の送信と「通報済み」の判定を、画面から切り出したもの（FE-18、S4）。
 *
 * 通報済みかどうかの正は、必ずサーバの `contentFlag.mine`（BE-24）である。
 * 端末に記録を持たせると、送れていない通報まで「通報済み」に見えてしまい、
 * 利用者が「運営に届いた」と誤解したまま次の手を打たなくなる。
 * そのため、ここには mine の応答を読むための素の関数だけを置く。
 */

/** contentFlag.mine が返す行のうち、通報済みの判定に使う分だけ */
export type MyContentFlag = {
  targetType: string;
  targetId: string;
};

export type ReportSubmission = {
  fieldReportId: string;
  reason: ReportReason;
  /** 補足。空文字は送らない */
  note?: string;
};

/** 自分の通報一覧に、この投稿への通報が含まれるか */
export function isReported(
  flags: readonly MyContentFlag[] | undefined,
  fieldReportId: string,
): boolean {
  return (flags ?? []).some(
    (flag) =>
      flag.targetType === "field_report" && flag.targetId === fieldReportId,
  );
}

/**
 * 画面の入力を `contentFlag.create` の入力へ直す。
 *
 * 補足はサーバ側が空文字を受け付けない（`z.string().trim().min(1)`）ため、
 * 何も書かれていなければ項目ごと送らない。
 */
export function toContentFlagInput(submission: ReportSubmission): {
  targetType: "field_report";
  targetId: string;
  reason: ReportReason;
  detail?: string;
} {
  const detail = submission.note?.trim() ?? "";

  return {
    targetType: "field_report",
    targetId: submission.fieldReportId,
    reason: submission.reason,
    detail: detail === "" ? undefined : detail,
  };
}

/**
 * tRPC のエラーコードを取り出す。
 *
 * `TRPCClientError` を instanceof で見ないのは、リンクの構成やバンドルの都合で
 * 別インスタンスになったときに黙って既定の文言へ落ちるのを避けるためである。
 */
function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const { data } = error as { data?: unknown };
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const { code } = data as { code?: unknown };

  return typeof code === "string" ? code : undefined;
}

/**
 * すでに自分が通報している対象かどうか。
 *
 * 同じ人が同じ対象を二度通報することは UNIQUE 制約で防がれており、
 * サーバは CONFLICT を返す（apps/backend の moderation.test.ts）。
 * これは失敗ではなく「もう届いている」なので、通報済みとして扱ってよい。
 */
export function isAlreadyReportedError(error: unknown): boolean {
  return getErrorCode(error) === "CONFLICT";
}

/** 送信できなかったときに出す文言。原因ごとに、次に何をすればよいかが変わる */
export function describeReportFailure(error: unknown): string {
  switch (getErrorCode(error)) {
    case "UNAUTHORIZED":
      return "通報するにはログインが必要です。ログインしてから、もう一度お試しください。";
    case "NOT_FOUND":
      return "この投稿は見つかりませんでした。すでに取り下げられたのかもしれません。";
    case "TOO_MANY_REQUESTS":
      return "通報の回数が上限に達しました。しばらく時間をおいてから、もう一度お試しください。";
    default:
      return "通報を送れませんでした。通信の状態を確かめて、もう一度お試しください。";
  }
}
