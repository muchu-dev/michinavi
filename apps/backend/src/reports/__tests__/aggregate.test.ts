import { describe, expect, test } from "vitest";
import {
  type AggregatableReport,
  countByCondition,
  countReporters,
  DEDUPE_WINDOW_MS,
  dedupeReports,
  majorityCondition,
  type RoadCondition,
} from "../aggregate";

const BASE_MS = Date.parse("2026-08-31T09:00:00.000Z");

function report(
  userId: string,
  condition: RoadCondition,
  minutesAgo: number,
): AggregatableReport {
  return {
    user_id: userId,
    road_condition: condition,
    created_at: new Date(BASE_MS - minutesAgo * 60_000).toISOString(),
  };
}

describe("dedupeReports", () => {
  test("同じ投稿者が窓の中で連投したら、最新の1件だけが残る", () => {
    const { active, mergedCount } = dedupeReports([
      report("u1", "impassable", 0),
      report("u1", "impassable", 5),
      report("u1", "passable", 10),
    ]);

    expect(active).toHaveLength(1);
    expect(active[0]?.road_condition).toBe("impassable");
    expect(mergedCount).toBe(2);
  });

  test("別々の投稿者の報告はまとめない", () => {
    const { active, mergedCount } = dedupeReports([
      report("u1", "impassable", 0),
      report("u2", "impassable", 1),
      report("u3", "passable", 2),
    ]);

    expect(active).toHaveLength(3);
    expect(mergedCount).toBe(0);
  });

  test("窓を越えた再報告は、状況の更新として別々に数える", () => {
    const windowMinutes = DEDUPE_WINDOW_MS / 60_000;

    const { active, mergedCount } = dedupeReports([
      report("u1", "impassable", 0),
      report("u1", "passable", windowMinutes + 1),
    ]);

    expect(active).toHaveLength(2);
    expect(mergedCount).toBe(0);
  });

  test("窓は残した報告から測るので、間隔を空けた報告は畳まれない", () => {
    const windowMinutes = DEDUPE_WINDOW_MS / 60_000;

    // 隣り合う報告の間隔はどれも窓の中（20分 < 30分）だが、
    // 窓は「直前の報告」ではなく「残した報告」から測る。
    // 直前の報告から測る規則にすると、20分おきに報告し続けた人の
    // 数時間ぶんの更新がすべて 1 件に潰れてしまう
    const { active, mergedCount } = dedupeReports([
      report("u1", "impassable", 0),
      report("u1", "impassable", windowMinutes - 10),
      report("u1", "impassable", 2 * (windowMinutes - 10)),
    ]);

    expect(active).toHaveLength(2);
    expect(mergedCount).toBe(1);
  });

  test("返る報告は新しい順に並ぶ", () => {
    const { active } = dedupeReports([
      report("u1", "passable", 60),
      report("u2", "caution", 10),
      report("u3", "impassable", 30),
    ]);

    expect(active.map((r) => r.user_id)).toEqual(["u2", "u3", "u1"]);
  });

  test("空の入力でも壊れない", () => {
    expect(dedupeReports([])).toEqual({ active: [], mergedCount: 0 });
  });
});

describe("countByCondition / countReporters", () => {
  test("状態ごとの件数と投稿者の実人数を数える", () => {
    const reports = [
      report("u1", "impassable", 0),
      report("u2", "impassable", 1),
      report("u1", "caution", 40),
    ];

    expect(countByCondition(reports)).toEqual({
      passable: 0,
      caution: 1,
      impassable: 2,
    });
    expect(countReporters(reports)).toBe(2);
  });
});

describe("majorityCondition", () => {
  test("件数が最も多い状態を選ぶ", () => {
    expect(majorityCondition({ passable: 3, caution: 1, impassable: 0 })).toBe(
      "passable",
    );
  });

  test("同数のときは深刻な方を選ぶ", () => {
    expect(majorityCondition({ passable: 1, caution: 1, impassable: 1 })).toBe(
      "impassable",
    );
    expect(majorityCondition({ passable: 2, caution: 2, impassable: 0 })).toBe(
      "caution",
    );
  });
});
