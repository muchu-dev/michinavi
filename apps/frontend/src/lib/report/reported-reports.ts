import type { ReportReason } from "./report-reasons";

/**
 * 通報済みの投稿を覚えておく置き場（FE-18）。
 *
 * 「通報済みが分かる」を成立させるには、送信の結果をどこかに残す必要がある。
 * 通報の一覧を返す API はまだ無い（BE-24）ため、当面はこの端末の
 * localStorage に投稿 ID だけを残し、同じ投稿に何度も通報しないようにする。
 *
 * サーバ側が入ったら、この置き場は「送信中に押せなくする」ためだけの
 * 楽観的な記録になり、通報済みかどうかの正は API の応答になる。
 */
const STORAGE_KEY = "michinavi.reported-field-reports.v1";

export type ReportSubmission = {
  fieldReportId: string;
  reason: ReportReason;
  /** 補足。空文字は送らない */
  note?: string;
};

/** localStorage が使えない環境（SSR、プライベートモード）では空として扱う */
function readIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

export function isReported(fieldReportId: string): boolean {
  return readIds().includes(fieldReportId);
}

export function markReported(fieldReportId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const ids = readIds();
  if (ids.includes(fieldReportId)) {
    return;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([...ids, fieldReportId]),
    );
  } catch {
    // 保存できなくても通報自体は成立させる。次に開いたとき未通報に見えるだけ
  }
}

/**
 * 通報を送る。
 *
 * TODO(BE-24): 通報・削除APIが入ったら、この中身を
 * `api.contentFlag.create.mutate({ targetType: "field_report", targetId, reason, note })`
 * に差し替える。呼び出し側（ReportButton）はこの関数しか知らないため、
 * 差し替えは 1 ファイルで済む。
 *
 * 現状はサーバへ送る先が無いので、この端末に通報済みとして記録するだけである。
 * 「送ったつもりで消えている」ことがないよう、画面側の文言でもその旨を出す。
 */
export async function submitReport(
  submission: ReportSubmission,
): Promise<{ deliveredToServer: boolean }> {
  markReported(submission.fieldReportId);

  return { deliveredToServer: false };
}
