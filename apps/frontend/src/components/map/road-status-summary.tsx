"use client";

import { api } from "@/lib/trpc/client";

/**
 * 地図の吹き出しに、サーバー側で計算済みの道路状況を出す。
 *
 * 地図はこれまで生の投稿を250mメッシュで色分けするだけで、
 * 推定（BE-16 の road_status_estimates）と同一地点のまとめ
 * （BE-18 の field_report_digests）を一切見ていなかった。
 * 「住民の投稿から通行可否を推定する」という主張が画面に出ていない
 * 状態だったので、その2つをここで読んで表示する。
 *
 * 推定そのものは投稿時に一度だけ計算されてテーブルに入っている。
 * ここは保存済みの結果を読むだけで、閲覧のたびに AI を呼ばない
 * （費用と待ち時間が読めなくなるため。router 側と同じ方針）。
 *
 * AI が落ちていても表示が壊れないことが要件そのものなので、
 * 「AI ではなく多数決で決まった推定」「推定がまだ無い」「取得に失敗した」を
 * すべて表示可能な状態として扱う。ここが出せなくても、
 * 吹き出しに並ぶ投稿一覧（素のデータ）は残る。
 */

type RoadCondition = "passable" | "caution" | "impassable";
type Confidence = "high" | "medium" | "low";

/**
 * 推定は地点で絞り込めないので、router が返せる上限まで取ってから選ぶ。
 * 更新の新しい順に返るため、地図に出ている（＝直近に投稿のあった）地点は
 * この範囲に入る。
 */
const ESTIMATE_LIMIT = 500;

const CONDITION_LABELS: Record<RoadCondition, string> = {
  passable: "通行可",
  caution: "注意",
  impassable: "通行不可",
};

// 色は globals.css のトークンに紐づく utility だけを使い、直書きしない。
const CONDITION_BADGE_CLASSES: Record<RoadCondition, string> = {
  passable: "bg-passable text-white",
  caution: "bg-caution text-white",
  impassable: "bg-impassable text-white",
};

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: "高い",
  medium: "ふつう",
  low: "低い",
};

export function RoadStatusSummary({ meshCode }: { meshCode: string }) {
  // 推定は一覧で取り、まとめは地点を指定して1件だけ取る。
  // まとめの一覧は報告の新しい順に切られるので、地点で絞らないと
  // 投稿の多い環境で古い地点のカードが欠ける。
  // 吹き出しは開いたときにだけ描かれるため、タップした地点の分しか呼ばない。
  const estimates = api.roadStatus.list.useQuery({ limit: ESTIMATE_LIMIT });
  const digests = api.reportDigest.list.useQuery({
    limit: 1,
    meshCodePrefix: meshCode,
  });

  const estimate = estimates.data?.find((row) => row.meshCode === meshCode);
  const digest = digests.data?.find((row) => row.meshCode === meshCode);
  // 推定があればそれを見出しにし、無ければまとめの代表値で代用する。
  const headline = estimate ?? digest;

  if (!headline) {
    if (estimates.isPending || digests.isPending) {
      return (
        <output className="block text-xs font-bold text-muted">
          道路状況の推定を読み込んでいます
        </output>
      );
    }

    if (estimates.isError || digests.isError) {
      return (
        <p className="text-xs font-bold text-impassable" role="alert">
          道路状況の推定を取得できませんでした
        </p>
      );
    }

    return (
      <p className="text-xs font-bold text-muted">
        この地点の推定はまだありません
      </p>
    );
  }

  return (
    <section
      aria-label="この地点の道路状況の推定"
      className="grid gap-1 rounded-lg bg-app-surface p-2"
    >
      <p className="flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-black ${CONDITION_BADGE_CLASSES[headline.roadCondition]}`}
        >
          {CONDITION_LABELS[headline.roadCondition]}
        </span>
        <span className="text-[0.6875rem] font-bold text-muted">
          {estimate
            ? `確度 ${CONFIDENCE_LABELS[estimate.confidence]}`
            : "集計のみ"}
        </span>
      </p>

      {estimate ? (
        <p className="text-xs font-bold text-ink">根拠: {estimate.reasoning}</p>
      ) : null}

      {digest ? (
        <>
          <p className="text-xs font-bold text-ink">まとめ: {digest.summary}</p>
          <p className="text-[0.6875rem] font-bold text-muted">
            通れる{digest.counts.passable}・注意{digest.counts.caution}
            ・通れない
            {digest.counts.impassable}（{digest.reporterCount}人）
          </p>
        </>
      ) : null}

      {/* AI の要約か、AI が使えないときの定型文かを隠さない。
          どちらでも表示は成立するが、読む側が根拠の強さを判断できるようにする */}
      <p className="text-[0.6875rem] font-bold text-muted">
        {digest?.isAiSummary ? "AIの要約" : "自動集計"}
        {" ・ "}
        <time dateTime={headline.updatedAt}>
          {formatUpdatedAt(headline.updatedAt)}
        </time>
        更新
      </p>
    </section>
  );
}

/** CIや端末のタイムゾーンに左右されず、日本時間で表示する（吹き出しの投稿一覧と同じ） */
function formatUpdatedAt(updatedAt: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(updatedAt));
}
