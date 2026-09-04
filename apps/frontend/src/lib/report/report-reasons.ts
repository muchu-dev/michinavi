/**
 * 通報の理由（S4）。
 *
 * 値は docs/er/00-conventions.md の `flag_reason` ENUM に合わせる。
 * BE-24（通報・削除API）が入ったとき、そのまま送れる形にしておく。
 */
export const reportReasons = [
  {
    value: "false_info",
    label: "内容がちがう",
    description: "通れるかどうかが実際と食い違っている",
  },
  {
    value: "privacy",
    label: "個人情報が写っている",
    description: "表札や車のナンバー、人の顔が分かる",
  },
  {
    value: "spam",
    label: "宣伝や無関係な内容",
    description: "災害の状況と関係のない投稿",
  },
  {
    value: "abuse",
    label: "攻撃的・迷惑な内容",
    description: "特定の人をおとしめる内容が含まれる",
  },
  {
    value: "other",
    label: "その他",
    description: "上のどれにも当てはまらない",
  },
] as const;

export type ReportReason = (typeof reportReasons)[number]["value"];
