import {
  createServiceRoleClient,
  createTestUser,
  deleteTestUser,
  SEED_AREA_IDS,
  type TestUser,
} from "@michinavi/testing";
import { afterEach, describe, expect, test, vi } from "vitest";
import { generateStructuredJson } from "../../../ai/gemini-client";
import {
  createAnonymousCaller,
  createCallerFor,
} from "../../__tests__/helpers";

vi.mock("../../../ai/gemini-client", () => ({
  generateStructuredJson: vi.fn(),
}));

const mockedGenerateStructuredJson = vi.mocked(generateStructuredJson);

/** Gemini を使わない状態。選択肢は決定論的な候補のままになる */
function withoutGemini() {
  mockedGenerateStructuredJson.mockResolvedValue({
    ok: false,
    error: "unavailable in test",
  });
}

const serviceRole = createServiceRoleClient();
const createdUserIds: string[] = [];

/**
 * 自宅の周辺（同じ 1km メッシュ）の道路状態は他のテストの投稿にも左右される。
 * 世帯ごとに違う自宅メッシュを使い、周辺の状況をテストの中だけで決められるようにする
 */
let meshCodeSequence = 0;
function uniqueHomeMeshCode(): string {
  meshCodeSequence += 1;
  return `53${String(Date.now()).slice(-6)}${String(meshCodeSequence).padStart(2, "0")}`;
}

async function newHousehold(options: {
  carCount?: number;
  homeMeshCode?: string;
}): Promise<{ user: TestUser; homeMeshCode: string }> {
  const user = await createTestUser();
  createdUserIds.push(user.id);

  const homeMeshCode = options.homeMeshCode ?? uniqueHomeMeshCode();
  const { caller } = await createCallerFor(user);
  await caller.user.setup({
    displayName: "テスト太郎",
    areaId: SEED_AREA_IDS.mabiYata,
    homeMeshCode,
    carCount: options.carCount ?? 0,
  });

  return { user, homeMeshCode };
}

/** 自宅と同じ 1km メッシュに、BE-16 の推定が入っている状態を作る */
async function seedRoadStatus(
  homeMeshCode: string,
  roadCondition: "passable" | "caution" | "impassable",
) {
  const { error } = await serviceRole.from("road_status_estimates").upsert(
    {
      mesh_code: `${homeMeshCode.slice(0, 8)}99`,
      road_condition: roadCondition,
      confidence: "low",
      report_count: 2,
      reasoning: "テスト用に投入した推定",
    },
    { onConflict: "mesh_code" },
  );

  expect(error).toBeNull();
}

afterEach(async () => {
  await Promise.all(createdUserIds.splice(0).map(deleteTestUser));
  vi.clearAllMocks();
});

describe("evacuation.generate", () => {
  test("車のある世帯には『自宅待機／徒歩／車』が根拠つきで返る", async () => {
    withoutGemini();

    const { user } = await newHousehold({ carCount: 1 });
    const { caller } = await createCallerFor(user);

    const advice = await caller.evacuation.generate();

    expect(advice.options).toHaveLength(3);
    expect(advice.options.map((option) => option.travelMode).sort()).toEqual([
      "car",
      "none",
      "walk",
    ]);
    expect(advice.isAiGenerated).toBe(false);

    for (const option of advice.options) {
      expect(option.reason.length).toBeGreaterThan(0);
      expect(option.riskNote?.length ?? 0).toBeGreaterThan(0);
    }
    expect(advice.summary.length).toBeGreaterThan(0);
  });

  test("車の無い世帯に車の選択肢は返らない", async () => {
    withoutGemini();

    const { user } = await newHousehold({ carCount: 0 });
    const { caller } = await createCallerFor(user);

    const advice = await caller.evacuation.generate();

    expect(advice.options.map((option) => option.travelMode)).not.toContain(
      "car",
    );
  });

  test("周辺に「通れない」推定があると、上階へ移る選択肢が加わる", async () => {
    withoutGemini();

    const { user, homeMeshCode } = await newHousehold({ carCount: 1 });
    await seedRoadStatus(homeMeshCode, "impassable");
    const { caller } = await createCallerFor(user);

    const advice = await caller.evacuation.generate();

    expect(advice.options.map((option) => option.optionType)).toContain(
      "vertical",
    );
    // 動かない選択肢が先頭に来る
    expect(advice.options[0]?.optionType).toBe("stay_home");
  });

  test("切り替え基準が、同じ提案の中の選択肢を指して保存される", async () => {
    withoutGemini();

    const { user } = await newHousehold({ carCount: 1 });
    const { caller } = await createCallerFor(user);

    const advice = await caller.evacuation.generate();
    const optionIds = new Set(advice.options.map((option) => option.id));
    const criteria = advice.options.flatMap((option) => option.switchCriteria);

    expect(criteria.length).toBeGreaterThan(0);
    for (const criterion of criteria) {
      expect(criterion.description.length).toBeGreaterThan(0);
      if (criterion.switchToOptionId !== null) {
        expect(optionIds.has(criterion.switchToOptionId)).toBe(true);
      }
      // しきい値は値・単位・比較がそろっているか、3 つとも無い
      const filled = [
        criterion.thresholdValue,
        criterion.thresholdUnit,
        criterion.comparator,
      ].filter((value) => value !== null).length;
      expect([0, 3]).toContain(filled);
    }
  });

  test("Gemini の出力が検証を通れば、並び順と文面が採用される", async () => {
    const { user } = await newHousehold({ carCount: 1 });
    const { caller } = await createCallerFor(user);

    mockedGenerateStructuredJson.mockResolvedValue({
      ok: true,
      raw: JSON.stringify({
        summary: "AIがまとめた見立てです",
        options: [
          {
            key: "stay_home",
            rank: 1,
            title: "まず自宅で様子を見る",
            reason: "AIが書いた根拠",
            riskNote: "AIが書いた弱点",
            switchCriteria: [
              {
                triggerType: "alert_level",
                description: "警戒レベル4で徒歩に切り替えます",
                thresholdValue: 4,
                thresholdUnit: "レベル",
                comparator: "gte",
                switchToKey: "walk_shelter",
              },
            ],
          },
          {
            key: "walk_shelter",
            rank: 2,
            title: "徒歩で移る",
            reason: "AIが書いた根拠",
            riskNote: "AIが書いた弱点",
            switchCriteria: [],
          },
          {
            key: "car_shelter",
            rank: 3,
            title: "車で移る",
            reason: "AIが書いた根拠",
            riskNote: "AIが書いた弱点",
            switchCriteria: [],
          },
        ],
      }),
    });

    const advice = await caller.evacuation.generate();

    expect(advice.isAiGenerated).toBe(true);
    expect(advice.summary).toBe("AIがまとめた見立てです");
    expect(advice.options[0]?.title).toBe("まず自宅で様子を見る");
    // 種別と移動手段はサーバが決めた候補のまま
    expect(advice.options[0]?.optionType).toBe("stay_home");
    expect(advice.options[0]?.travelMode).toBe("none");
  });

  test("Gemini が候補に無い選択肢を混ぜたら、決定論的な候補に戻す", async () => {
    const { user } = await newHousehold({ carCount: 0 });
    const { caller } = await createCallerFor(user);

    mockedGenerateStructuredJson.mockResolvedValue({
      ok: true,
      raw: JSON.stringify({
        summary: "車で避難してください",
        options: [
          {
            key: "car_shelter",
            rank: 1,
            title: "車で避難する",
            reason: "候補に無い選択肢",
            switchCriteria: [],
          },
          {
            key: "walk_shelter",
            rank: 2,
            title: "徒歩で避難する",
            reason: "AIが書いた根拠",
            switchCriteria: [],
          },
        ],
      }),
    });

    const advice = await caller.evacuation.generate();

    expect(advice.isAiGenerated).toBe(false);
    expect(advice.summary).not.toBe("車で避難してください");
    // 車を持たない世帯なので、車の選択肢は最後まで現れない
    expect(advice.options.map((option) => option.travelMode)).not.toContain(
      "car",
    );
  });

  test("Gemini が壊れたJSONを返しても、提案は返る", async () => {
    const { user } = await newHousehold({ carCount: 1 });
    const { caller } = await createCallerFor(user);

    mockedGenerateStructuredJson.mockResolvedValue({
      ok: true,
      raw: "not valid json",
    });

    const advice = await caller.evacuation.generate();

    expect(advice.isAiGenerated).toBe(false);
    expect(advice.options.length).toBeGreaterThanOrEqual(3);
  });

  test("未認証のリクエストは実行できない", async () => {
    const { caller } = await createAnonymousCaller();

    await expect(caller.evacuation.generate()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  test("世帯がまだ無いユーザーは提案を作れない", async () => {
    const user = await createTestUser();
    createdUserIds.push(user.id);
    const { caller } = await createCallerFor(user);

    await expect(caller.evacuation.generate()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("evacuation.latest", () => {
  test("最後に作った提案が返る", async () => {
    withoutGemini();

    const { user } = await newHousehold({ carCount: 1 });
    const { caller } = await createCallerFor(user);

    await caller.evacuation.generate();
    const second = await caller.evacuation.generate();

    const latest = await caller.evacuation.latest();

    expect(latest.adviceId).toBe(second.adviceId);
    expect(latest.options).toHaveLength(second.options.length);
  });

  test("提案がまだ無ければ NOT_FOUND を返す", async () => {
    const { user } = await newHousehold({ carCount: 0 });
    const { caller } = await createCallerFor(user);

    await expect(caller.evacuation.latest()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("他人の世帯の提案は読めない", async () => {
    withoutGemini();

    const { user: owner } = await newHousehold({ carCount: 1 });
    const { caller: ownerCaller } = await createCallerFor(owner);
    const advice = await ownerCaller.evacuation.generate();

    const { user: other } = await newHousehold({ carCount: 1 });
    const { caller: otherCaller, ctx } = await createCallerFor(other);

    // 他人の提案しか無い状態では、自分の最新は見つからない
    await expect(otherCaller.evacuation.latest()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    // id を直接指定しても RLS が行を返さない
    const { data } = await ctx.supabase
      .from("evacuation_advices")
      .select("id")
      .eq("id", advice.adviceId);
    expect(data).toEqual([]);

    const { data: options } = await ctx.supabase
      .from("evacuation_options")
      .select("id")
      .eq("evacuation_advice_id", advice.adviceId);
    expect(options).toEqual([]);
  });

  test("提案には期限が入る", async () => {
    withoutGemini();

    const { user } = await newHousehold({ carCount: 0 });
    const { caller } = await createCallerFor(user);

    const advice = await caller.evacuation.generate();

    expect(Date.parse(advice.expiresAt)).toBeGreaterThan(
      Date.parse(advice.generatedAt),
    );
  });
});
