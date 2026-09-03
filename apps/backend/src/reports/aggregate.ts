import type { Database } from "@michinavi/db";

/**
 * 同一地点（mesh_code）に届いた現地報告の重複統合と集計（BE-18）。
 *
 * 集計の規則を router から切り離して置くのは、道路状態の推定（BE-16）と
 * カードの要約（BE-18）の両方が同じ「有効な報告の集合」を見る必要があるためである。
 * 二か所で別々に数えると、カードの「3件」と推定の根拠が食い違う。
 */

export type RoadCondition = Database["public"]["Enums"]["road_condition"];

/**
 * 同じ投稿者からの報告を重複と見なす時間の窓。
 *
 * 30 分にしているのは、災害時の状況が変わる速さと、
 * 送信の失敗を疑って連打する操作の間隔の折り合いを取ったためである。
 * これより長くすると「30 分前は通れたが今は通れない」という更新まで畳んでしまう。
 */
export const DEDUPE_WINDOW_MS = 30 * 60 * 1000;

/** 集計に必要な最小限の列。field_reports の行をそのまま渡せる形にする */
export type AggregatableReport = {
  user_id: string;
  road_condition: RoadCondition;
  created_at: string;
};

export type DedupeResult<T> = {
  /** 有効な報告。新しい順に並ぶ */
  active: T[];
  /** 重複として畳んだ件数 */
  mergedCount: number;
};

export type ConditionCounts = Record<RoadCondition, number>;

/**
 * 同じ投稿者が短時間に何度も上げた報告を、最新の 1 件へ畳む。
 *
 * 投稿そのものは消さない。多数決と表示の母数から外すだけである。
 * 1 人が「通れない」を 3 回送っても 3 票にならないようにするのが目的で、
 * これが無いと連打だけで地図上の状態を動かせてしまう。
 */
export function dedupeReports<T extends AggregatableReport>(
  reports: readonly T[],
): DedupeResult<T> {
  // 新しい順に見て、同じ投稿者の窓に入る古い報告を捨てていく。
  // 残した報告を基準に窓を取り直すため、連投が続いても最後は 1 件に落ちる
  const newestFirst = [...reports].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );

  const active: T[] = [];
  const lastKeptAtByUser = new Map<string, number>();

  for (const report of newestFirst) {
    const reportedAt = Date.parse(report.created_at);
    const lastKeptAt = lastKeptAtByUser.get(report.user_id);

    if (
      lastKeptAt !== undefined &&
      lastKeptAt - reportedAt < DEDUPE_WINDOW_MS
    ) {
      continue;
    }

    active.push(report);
    lastKeptAtByUser.set(report.user_id, reportedAt);
  }

  return { active, mergedCount: reports.length - active.length };
}

/** 状態ごとの件数を数える */
export function countByCondition(
  reports: readonly AggregatableReport[],
): ConditionCounts {
  const counts: ConditionCounts = { passable: 0, caution: 0, impassable: 0 };

  for (const report of reports) {
    counts[report.road_condition] += 1;
  }

  return counts;
}

/**
 * 件数から代表的な状態を 1 つ決める。
 * 同数のときは深刻な方（通れない > 注意 > 通れる）を採る。
 * 迷ったときに軽い方へ倒すと、通れない道を通れると表示してしまう
 */
export function majorityCondition(counts: ConditionCounts): RoadCondition {
  const severity: Record<RoadCondition, number> = {
    impassable: 2,
    caution: 1,
    passable: 0,
  };

  let winner: RoadCondition = "passable";

  for (const condition of Object.keys(counts) as RoadCondition[]) {
    if (
      counts[condition] > counts[winner] ||
      (counts[condition] === counts[winner] &&
        severity[condition] > severity[winner])
    ) {
      winner = condition;
    }
  }

  return winner;
}

/** 投稿者の実人数 */
export function countReporters(reports: readonly AggregatableReport[]): number {
  return new Set(reports.map((report) => report.user_id)).size;
}
