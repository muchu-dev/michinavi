import {
  createServiceRoleClient,
  createTestUser,
  deleteTestUser,
  SEED_AREA_IDS,
  type TestUser,
} from "@michinavi/testing";
import { TRPCError } from "@trpc/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  createAnonymousCaller,
  createCallerFor,
} from "../../__tests__/helpers";

// road_status_estimates の再計算(BE-16)は field-report.test.ts の関心事ではない。
// Gemini への実通信を避けるため、常に失敗させて多数決フォールバックに任せる
vi.mock("../../../ai/gemini-client", () => ({
  generateStructuredJson: vi.fn(async () => ({
    ok: false as const,
    error: "mocked: not available in field-report.test.ts",
  })),
}));

const serviceRole = createServiceRoleClient();
const createdUserIds: string[] = [];

/** 投稿できる状態（public.users が存在する）のテストユーザーを用意する */
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
});

describe("fieldReport.create", () => {
  test("認証済みユーザーが投稿すると保存される", async () => {
    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);

    const result = await caller.fieldReport.create({
      meshCode: "5133451124",
      roadCondition: "impassable",
    });

    expect(result.meshCode).toBe("5133451124");
    expect(result.roadCondition).toBe("impassable");

    const { data } = await serviceRole
      .from("field_reports")
      .select("user_id, report_type, road_condition, mesh_code")
      .eq("id", result.id)
      .single();

    expect(data?.user_id).toBe(user.id);
    expect(data?.report_type).toBe("road");
    expect(data?.road_condition).toBe("impassable");
    expect(data?.mesh_code).toBe("5133451124");
  });

  test("未認証のリクエストは実行できない", async () => {
    const { caller } = await createAnonymousCaller();

    await expect(
      caller.fieldReport.create({
        meshCode: "5133451124",
        roadCondition: "caution",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("入力の検証で弾かれる", async () => {
    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);

    // メッシュコードが 10 桁でない
    await expect(
      caller.fieldReport.create({
        meshCode: "51334511",
        roadCondition: "passable",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // 状態が定義済みの値でない
    await expect(
      caller.fieldReport.create({
        meshCode: "5133451124",
        // biome-ignore lint/suspicious/noExplicitAny: 不正な値の検証のため
        roadCondition: "flooded" as any,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("public.users にまだ登録していない状態では投稿できない", async () => {
    const user = await createTestUser();
    createdUserIds.push(user.id);
    const { caller } = await createCallerFor(user);

    const error = await caller.fieldReport
      .create({ meshCode: "5133451124", roadCondition: "passable" })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TRPCError);
    expect(error).toMatchObject({ code: "BAD_REQUEST" });
  });

  test("投稿に他人の user_id を混ぜても、JWT のユーザーで保存される", async () => {
    const victim = await newRegisteredUser();
    const attacker = await newRegisteredUser();
    const { caller } = await createCallerFor(attacker);

    const result = await caller.fieldReport.create({
      meshCode: "5133451124",
      roadCondition: "passable",
      // 入力スキーマに userId は無いが、素通しされていないことを念のため確認する
      ...({ userId: victim.id } as object),
    });

    const { data } = await serviceRole
      .from("field_reports")
      .select("user_id")
      .eq("id", result.id)
      .single();
    expect(data?.user_id).toBe(attacker.id);
  });
});

describe("fieldReport.list", () => {
  test("保存した投稿が新しい順に返る", async () => {
    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);

    const first = await caller.fieldReport.create({
      meshCode: "5133451124",
      roadCondition: "passable",
    });
    const second = await caller.fieldReport.create({
      meshCode: "5133451125",
      roadCondition: "impassable",
    });

    const list = await caller.fieldReport.list({ limit: 100 });
    const ids = list.map((r) => r.id);

    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
  });

  test("未認証でも一覧は取得できる", async () => {
    const user = await newRegisteredUser();
    const { caller: posterCaller } = await createCallerFor(user);
    const posted = await posterCaller.fieldReport.create({
      meshCode: "5133451124",
      roadCondition: "caution",
    });

    const { caller } = await createAnonymousCaller();
    const list = await caller.fieldReport.list({ limit: 100 });

    expect(list.some((r) => r.id === posted.id)).toBe(true);
  });

  test("limit で件数を絞れる", async () => {
    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);

    await caller.fieldReport.create({
      meshCode: "5133451124",
      roadCondition: "passable",
    });
    await caller.fieldReport.create({
      meshCode: "5133451125",
      roadCondition: "passable",
    });

    const list = await caller.fieldReport.list({ limit: 1 });
    expect(list).toHaveLength(1);
  });
});
