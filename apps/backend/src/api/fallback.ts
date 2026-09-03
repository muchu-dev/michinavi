/**
 * API が使えないときに出す案内（BE-27）。
 *
 * みちナビの情報は住民の投稿と AI の推定でできている。これが取れないときに
 * 画面が黙って空になると、利用者は「情報が無い」のか「アプリが壊れている」のか
 * 区別できない。取れなかったことを伝えたうえで、一次情報を出している行政と
 * 気象庁へ誘導する。
 *
 * 定数として持ち、API を通さずにフロントエンドから直接 import できるようにする。
 * 案内を取りに行く通信が失敗したら案内も出せない、という状態を避けるためである。
 * 同じ内容を errorFormatter がエラー応答にも載せる。
 */

export type EmergencyLink = {
  label: string;
  url: string;
  /** その先で何が分かるか */
  note: string;
};

export type EmergencyPhone = {
  label: string;
  number: string;
};

export type EmergencyGuidance = {
  headline: string;
  body: string;
  links: readonly EmergencyLink[];
  phones: readonly EmergencyPhone[];
};

export const emergencyGuidance: EmergencyGuidance = {
  headline: "みちナビの情報を取得できません",
  body: "アプリの表示が更新できないときも、行政と気象庁が出している情報は各機関のサイトで確認できます。命に関わる判断は、必ずそちらの情報で行ってください。",
  links: [
    {
      label: "倉敷市",
      url: "https://www.city.kurashiki.okayama.jp/",
      note: "避難情報と避難所の開設状況（対象地域の自治体）",
    },
    {
      label: "気象庁",
      url: "https://www.jma.go.jp/",
      note: "警報・注意報、雨雲の動き、河川の水位",
    },
    {
      label: "内閣府 防災情報のページ",
      url: "https://www.bousai.go.jp/",
      note: "全国の災害情報と避難の考え方",
    },
  ],
  phones: [
    { label: "警察（事件・事故）", number: "110" },
    { label: "消防・救急（火事・けが）", number: "119" },
  ],
};

/**
 * この案内を添えるべきエラーかどうか。
 *
 * 入力の誤りや権限不足は「アプリが落ちている」状態ではないので添えない。
 * 案内を常に付けると、通常の操作ミスにまで行政のリンクが並び、
 * 本当に落ちているときの重みが薄れる。
 */
const FALLBACK_ERROR_CODES = new Set([
  "INTERNAL_SERVER_ERROR",
  "BAD_GATEWAY",
  "SERVICE_UNAVAILABLE",
  "GATEWAY_TIMEOUT",
  "TIMEOUT",
]);

export function shouldAttachGuidance(errorCode: string): boolean {
  return FALLBACK_ERROR_CODES.has(errorCode);
}
