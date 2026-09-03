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

/** Gemini を使わない状態。要約は定型文になる */
function withoutGemini() {
  mockedGenerateStructuredJson.mockResolvedValue({
    ok: false,
    error: "unavailable in test",
  });
}

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
  return `52${String(Date.now()).slice(-6)}${String(meshCodeSequence).padStart(2, "0")}`;
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

/** その地点に保存されたカードを service role で読む */
async function fetchDigest(meshCode: string) {
  const { data } = await serviceRole
    .from("field_report_digests")
    .select("*")
    .eq("mesh_code", meshCode)
    .single();

  return data;
}

afterEach(async () => {
  await Promise.all(createdUserIds.splice(0).map(deleteTestUser));
  vi.clearAllMocks();
});

describe("投稿による field_report_digests の再計算(BE-18)", () => {
  test("同一地点への複数の投稿が、1 件のカードにまとまる", async () => {
    withoutGemini();

    const first = await newRegisteredUser();
    const second = await newRegisteredUser();
    const meshCode = uniqueMeshCode();

    const { caller: firstCaller } = await createCallerFor(first);
    const { caller: secondCaller } = await createCallerFor(second);
    await firstCaller.fieldReport.create({
      meshCode,
      roadCondition: "impassable",
    });
    await secondCaller.fieldReport.create({
      meshCode,
      roadCondition: "caution",
    });

    const { caller } = await createAnonymousCaller();
    const cards = (await caller.reportDigest.list({ limit: 100 })).filter(
      (card) => card.meshCode === meshCode,
    );

    expect(cards).toHaveLength(1);
    expect(cards[0]?.reportCount).toBe(2);
    expect(cards[0]?.reporterCount).toBe(2);
    expect(cards[0]?.counts).toEqual({
      passable: 0,
      caution: 1,
      impassable: 1,
    });
    // 同数なので深刻な方が代表になる
    expect(cards[0]?.roadCondition).toBe("impassable");
  });

  test("同じ投稿者の連投は重複として統合され、件数に二重に数えられない", async () => {
    withoutGemini();

    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);
    const meshCode = uniqueMeshCode();

    await caller.fieldReport.create({ meshCode, roadCondition: "impassable" });
    await caller.fieldReport.create({ meshCode, roadCondition: "impassable" });
    await caller.fieldReport.create({ meshCode, roadCondition: "impassable" });

    const digest = await fetchDigest(meshCode);

    expect(digest?.report_count).toBe(1);
    expect(digest?.merged_count).toBe(2);
    expect(digest?.reporter_count).toBe(1);
    expect(digest?.summary).toContain("重複2件は統合しました");
  });

  test("投稿は消さないので、統合しても一覧には全件残る", async () => {
    withoutGemini();

    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);
    const meshCode = uniqueMeshCode();

    await caller.fieldReport.create({ meshCode, roadCondition: "caution" });
    await caller.fieldReport.create({ meshCode, roadCondition: "caution" });

    const list = await caller.fieldReport.list({ limit: 100 });

    expect(list.filter((row) => row.meshCode === meshCode)).toHaveLength(2);
    expect((await fetchDigest(meshCode))?.report_count).toBe(1);
  });

  test("代表的な状態は BE-16 の推定に合わせる", async () => {
    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);
    const meshCode = uniqueMeshCode();

    // 道路状態の推定（1 回目）とカードの要約（2 回目）で 2 回呼ばれる
    mockedGenerateStructuredJson
      .mockResolvedValueOnce({
        ok: true,
        raw: JSON.stringify({
          meshCode,
          roadCondition: "impassable",
          confidence: "high",
          reportCount: 1,
          reasoning: "直近の報告に基づく推定",
        }),
      })
      .mockResolvedValue({ ok: false, error: "unavailable in test" });

    // 投稿は「通れる」だが、推定は「通れない」になる
    await caller.fieldReport.create({ meshCode, roadCondition: "passable" });

    const digest = await fetchDigest(meshCode);

    expect(digest?.road_condition).toBe("impassable");
    // 内訳は投稿そのままで、推定に引きずられない
    expect(digest?.passable_count).toBe(1);
    expect(digest?.impassable_count).toBe(0);
  });

  test("Gemini が有効な要約を返せば、その文がカードに載る", async () => {
    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);
    const meshCode = uniqueMeshCode();

    mockedGenerateStructuredJson
      .mockResolvedValueOnce({ ok: false, error: "推定はフォールバックさせる" })
      .mockResolvedValueOnce({
        ok: true,
        raw: JSON.stringify({
          meshCode,
          summary: "冠水で通れないという報告が届いています",
        }),
      });

    await caller.fieldReport.create({ meshCode, roadCondition: "impassable" });

    const digest = await fetchDigest(meshCode);

    expect(digest?.summary).toBe("冠水で通れないという報告が届いています");
    expect(digest?.is_ai_summary).toBe(true);
  });

  test("Gemini が使えないときは、集計から組み立てた定型文になる", async () => {
    withoutGemini();

    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);
    const meshCode = uniqueMeshCode();

    await caller.fieldReport.create({ meshCode, roadCondition: "caution" });

    const digest = await fetchDigest(meshCode);

    expect(digest?.is_ai_summary).toBe(false);
    expect(digest?.summary).toContain("注意");
    expect(digest?.summary).toContain("1人からの報告");
  });

  test("Gemini が別の地点について答えたら、その要約は使わない", async () => {
    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);
    const meshCode = uniqueMeshCode();

    mockedGenerateStructuredJson
      .mockResolvedValueOnce({ ok: false, error: "推定はフォールバックさせる" })
      .mockResolvedValueOnce({
        ok: true,
        raw: JSON.stringify({
          meshCode: "9999999999",
          summary: "別の地点についての誤った要約",
        }),
      });

    await caller.fieldReport.create({ meshCode, roadCondition: "passable" });

    const digest = await fetchDigest(meshCode);

    expect(digest?.summary).not.toBe("別の地点についての誤った要約");
    expect(digest?.is_ai_summary).toBe(false);
  });

  test("Gemini が壊れたJSONを返しても、カードは作られる", async () => {
    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);
    const meshCode = uniqueMeshCode();

    mockedGenerateStructuredJson.mockResolvedValue({
      ok: true,
      raw: "not valid json",
    });

    await caller.fieldReport.create({ meshCode, roadCondition: "impassable" });

    const digest = await fetchDigest(meshCode);

    expect(digest?.is_ai_summary).toBe(false);
    expect(digest?.report_count).toBe(1);
  });
});

describe("reportDigest.list", () => {
  test("未認証でもカードを取得できる", async () => {
    withoutGemini();

    const user = await newRegisteredUser();
    const { caller: posterCaller } = await createCallerFor(user);
    const meshCode = uniqueMeshCode();
    await posterCaller.fieldReport.create({
      meshCode,
      roadCondition: "caution",
    });

    const { caller } = await createAnonymousCaller();
    const list = await caller.reportDigest.list({ limit: 100 });

    expect(list.some((card) => card.meshCode === meshCode)).toBe(true);
  });

  test("メッシュコードの前方一致で地点を絞れる", async () => {
    withoutGemini();

    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);
    const meshCode = uniqueMeshCode();
    await caller.fieldReport.create({ meshCode, roadCondition: "passable" });

    const matched = await caller.reportDigest.list({
      limit: 100,
      meshCodePrefix: meshCode.slice(0, 8),
    });
    expect(matched.some((card) => card.meshCode === meshCode)).toBe(true);

    const unmatched = await caller.reportDigest.list({
      limit: 100,
      meshCodePrefix: "9999",
    });
    expect(unmatched.some((card) => card.meshCode === meshCode)).toBe(false);
  });

  test("投稿の無い地点はカードにならない", async () => {
    const { caller } = await createAnonymousCaller();
    const list = await caller.reportDigest.list({ limit: 100 });

    expect(list.some((card) => card.meshCode === "0000000000")).toBe(false);
  });

  test("認証済みユーザーでも、カードに直接書き込むことはできない", async () => {
    withoutGemini();

    const user = await newRegisteredUser();
    const { caller, ctx } = await createCallerFor(user);
    const meshCode = uniqueMeshCode();
    await caller.fieldReport.create({ meshCode, roadCondition: "passable" });

    // RLS に INSERT / UPDATE のポリシーが無いため、捏造した件数を書き込めない
    const { error } = await ctx.supabase
      .from("field_report_digests")
      .update({ report_count: 999, summary: "捏造された要約" })
      .eq("mesh_code", meshCode);

    // authenticated には UPDATE の権限自体が無い（42501）
    expect(error?.code).toBe("42501");
    expect((await fetchDigest(meshCode))?.report_count).toBe(1);
  });
});
