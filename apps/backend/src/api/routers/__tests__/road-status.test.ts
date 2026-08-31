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

const serviceRole = createServiceRoleClient();
const createdUserIds: string[] = [];

/**
 * field_reports は user_id が ON DELETE RESTRICT のため、テスト後も残り続ける
 * （投稿は証拠として保持する設計。docs/er/00-conventions.md#外部キーの削除規則）。
 * 固定の mesh_code を使うと、再実行のたびに前回の投稿が積み上がって
 * 件数の検証が壊れるため、実行のたびに異なる mesh_code を使う
 */
let meshCodeSequence = 0;
function uniqueMeshCode(): string {
  meshCodeSequence += 1;
  return `51${String(Date.now()).slice(-6)}${String(meshCodeSequence).padStart(2, "0")}`;
}

async function newRegisteredUser(): Promise<TestUser> {
  const user = await createTestUser();
  createdUserIds.push(user.id);

  const { caller } = await createCallerFor(user);
  await caller.user.setup({
    displayName: "テスト太郎",
    areaId: SEED_AREA_IDS.mabiYata,
    homeMeshCode: "5133451124",
  });

  return user;
}

afterEach(async () => {
  await Promise.all(createdUserIds.splice(0).map(deleteTestUser));
  vi.clearAllMocks();
});

describe("投稿による road_status_estimates の再計算(BE-16)", () => {
  test("Gemini が使えないときは、多数決の結果が保存される", async () => {
    mockedGenerateStructuredJson.mockResolvedValue({
      ok: false,
      error: "unavailable in test",
    });

    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);
    const meshCode = uniqueMeshCode();

    await caller.fieldReport.create({ meshCode, roadCondition: "impassable" });
    await caller.fieldReport.create({ meshCode, roadCondition: "impassable" });
    await caller.fieldReport.create({ meshCode, roadCondition: "passable" });

    const { data } = await serviceRole
      .from("road_status_estimates")
      .select("road_condition, confidence, report_count")
      .eq("mesh_code", meshCode)
      .single();

    // 2件の impassable が passable の1件を上回るので、多数決で impassable になる
    expect(data?.road_condition).toBe("impassable");
    expect(data?.confidence).toBe("low");
    expect(data?.report_count).toBe(3);
  });

  test("Gemini が有効な出力を返せば、その内容が保存される", async () => {
    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);
    const meshCode = uniqueMeshCode();

    mockedGenerateStructuredJson.mockResolvedValue({
      ok: true,
      raw: JSON.stringify({
        meshCode,
        roadCondition: "caution",
        confidence: "high",
        reportCount: 1,
        reasoning: "直近の報告に基づく推定",
      }),
    });

    await caller.fieldReport.create({ meshCode, roadCondition: "passable" });

    const { data } = await serviceRole
      .from("road_status_estimates")
      .select("road_condition, confidence, reasoning")
      .eq("mesh_code", meshCode)
      .single();

    // AI の判定(caution)が、実際の投稿(passable)と異なっていてもそのまま採用される
    expect(data?.road_condition).toBe("caution");
    expect(data?.confidence).toBe("high");
    expect(data?.reasoning).toBe("直近の報告に基づく推定");
  });

  test("Gemini が別の地点について答えたら、多数決にフォールバックする", async () => {
    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);
    const meshCode = uniqueMeshCode();

    mockedGenerateStructuredJson.mockResolvedValue({
      ok: true,
      raw: JSON.stringify({
        meshCode: "9999999999",
        roadCondition: "impassable",
        confidence: "high",
        reportCount: 1,
        reasoning: "別の地点についての誤った回答",
      }),
    });

    await caller.fieldReport.create({ meshCode, roadCondition: "passable" });

    const { data } = await serviceRole
      .from("road_status_estimates")
      .select("road_condition, confidence")
      .eq("mesh_code", meshCode)
      .single();

    expect(data?.road_condition).toBe("passable");
    expect(data?.confidence).toBe("low");
  });

  test("Gemini が壊れたJSONを返したら、多数決にフォールバックする", async () => {
    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);
    const meshCode = uniqueMeshCode();

    mockedGenerateStructuredJson.mockResolvedValue({
      ok: true,
      raw: "not valid json",
    });

    await caller.fieldReport.create({ meshCode, roadCondition: "caution" });

    const { data } = await serviceRole
      .from("road_status_estimates")
      .select("road_condition, confidence")
      .eq("mesh_code", meshCode)
      .single();

    expect(data?.road_condition).toBe("caution");
    expect(data?.confidence).toBe("low");
  });
});

describe("roadStatus.list", () => {
  test("未認証でも取得できる", async () => {
    mockedGenerateStructuredJson.mockResolvedValue({
      ok: false,
      error: "unavailable in test",
    });

    const user = await newRegisteredUser();
    const { caller: posterCaller } = await createCallerFor(user);
    const meshCode = uniqueMeshCode();
    await posterCaller.fieldReport.create({
      meshCode,
      roadCondition: "caution",
    });

    const { caller } = await createAnonymousCaller();
    const list = await caller.roadStatus.list();

    expect(list.some((row) => row.meshCode === meshCode)).toBe(true);
  });

  test("投稿の無い mesh_code は含まれない", async () => {
    const { caller } = await createAnonymousCaller();
    const list = await caller.roadStatus.list();

    expect(list.some((row) => row.meshCode === "0000000000")).toBe(false);
  });
});
