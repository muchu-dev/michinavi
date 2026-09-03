import { describe, expect, test } from "vitest";
import {
  buildCandidates,
  buildSummary,
  type HouseholdFacts,
  type RoadFacts,
} from "../options";

function household(overrides: Partial<HouseholdFacts> = {}): HouseholdFacts {
  return {
    memberCount: 2,
    infantCount: 0,
    seniorCount: 0,
    needsAssistanceCount: 0,
    careNeedKeys: [],
    petCount: 0,
    carCount: 0,
    hasCar: false,
    ...overrides,
  };
}

function road(overrides: Partial<RoadFacts> = {}): RoadFacts {
  return {
    meshCount: 0,
    passable: 0,
    caution: 0,
    impassable: 0,
    reportCount: 0,
    ...overrides,
  };
}

describe("buildCandidates", () => {
  test("車のある世帯には『自宅待機／徒歩／車』が根拠つきで返る", () => {
    const candidates = buildCandidates(
      household({ carCount: 1, hasCar: true }),
      road({ meshCount: 2, passable: 2, reportCount: 3 }),
    );

    expect(candidates.map((option) => option.key)).toEqual([
      "walk_shelter",
      "car_shelter",
      "stay_home",
    ]);
    expect(candidates.map((option) => option.travelMode)).toEqual([
      "walk",
      "car",
      "none",
    ]);
    // 根拠と弱点はすべての選択肢に付く
    for (const option of candidates) {
      expect(option.reason.length).toBeGreaterThan(0);
      expect(option.riskNote?.length ?? 0).toBeGreaterThan(0);
    }
  });

  test("車の無い世帯に車の選択肢は出ない", () => {
    const candidates = buildCandidates(household(), road());

    expect(candidates.map((option) => option.key)).not.toContain("car_shelter");
    expect(candidates.map((option) => option.travelMode)).not.toContain("car");
  });

  test("周辺に「通れない」報告があると、動かない選択肢が上に来る", () => {
    const candidates = buildCandidates(
      household({ carCount: 1, hasCar: true }),
      road({
        meshCount: 3,
        passable: 1,
        caution: 1,
        impassable: 1,
        reportCount: 5,
      }),
    );

    expect(candidates.map((option) => option.key)).toEqual([
      "stay_home",
      "vertical",
      "walk_shelter",
      "car_shelter",
    ]);
    expect(candidates[0]?.rank).toBe(1);
  });

  test("上階へ移る選択肢は、通れない報告があるときだけ出る", () => {
    const withoutImpassable = buildCandidates(
      household(),
      road({ meshCount: 2, passable: 2, reportCount: 2 }),
    );

    expect(withoutImpassable.map((option) => option.key)).not.toContain(
      "vertical",
    );
  });

  test("移動に配慮が必要で車がある世帯は、車が徒歩より上に来る", () => {
    const candidates = buildCandidates(
      household({ carCount: 1, hasCar: true, seniorCount: 1 }),
      road({ meshCount: 1, passable: 1, reportCount: 1 }),
    );

    expect(candidates.map((option) => option.key)).toEqual([
      "car_shelter",
      "walk_shelter",
      "stay_home",
    ]);
  });

  test("推奨順は 1 から連番になる", () => {
    const candidates = buildCandidates(
      household({ carCount: 2, hasCar: true }),
      road({ meshCount: 2, impassable: 2, reportCount: 4 }),
    );

    expect(candidates.map((option) => option.rank)).toEqual([1, 2, 3, 4]);
  });

  test("切り替え先は必ず同じ提案の選択肢を指す", () => {
    for (const facts of [
      household(),
      household({ carCount: 1, hasCar: true }),
      household({ carCount: 1, hasCar: true, needsAssistanceCount: 1 }),
    ]) {
      for (const surroundings of [
        road(),
        road({ meshCount: 1, impassable: 1, reportCount: 1 }),
      ]) {
        const candidates = buildCandidates(facts, surroundings);
        const keys = candidates.map((option) => option.key);

        for (const option of candidates) {
          for (const criterion of option.switchCriteria) {
            if (criterion.switchToKey !== null) {
              expect(keys).toContain(criterion.switchToKey);
            }
          }
        }
      }
    }
  });

  test("しきい値は値・単位・比較がそろっているか、3 つとも無い", () => {
    const candidates = buildCandidates(
      household({ carCount: 1, hasCar: true }),
      road({ meshCount: 1, impassable: 1, reportCount: 1 }),
    );

    for (const option of candidates) {
      for (const criterion of option.switchCriteria) {
        const filled = [
          criterion.thresholdValue,
          criterion.thresholdUnit,
          criterion.comparator,
        ].filter((value) => value !== null).length;

        expect([0, 3]).toContain(filled);
      }
    }
  });

  test("ペットがいる世帯では、受入条件の注意が弱点に入る", () => {
    const candidates = buildCandidates(
      household({ carCount: 1, hasCar: true, petCount: 2 }),
      road(),
    );
    const walk = candidates.find((option) => option.key === "walk_shelter");

    expect(walk?.riskNote).toContain("ペット2匹");
  });
});

describe("buildSummary", () => {
  test("周辺の状況と世帯の条件を、選択肢の並びとともに書く", () => {
    const facts = household({ carCount: 1, hasCar: true });
    const surroundings = road({
      meshCount: 2,
      passable: 1,
      impassable: 1,
      reportCount: 4,
    });
    const summary = buildSummary(
      facts,
      surroundings,
      buildCandidates(facts, surroundings),
    );

    expect(summary).toContain("1区画");
    expect(summary).toContain("世帯2人");
    // DB 側の CHECK 制約（200 文字）に収まる
    expect(summary.length).toBeLessThanOrEqual(200);
  });
});
