import {
  createServiceRoleClient,
  createTestUser,
  deleteTestUser,
  SEED_AREA_IDS,
  type TestUser,
} from "@michinavi/testing";
import { afterEach, describe, expect, test } from "vitest";
import { createCallerFor } from "../../__tests__/helpers";

const serviceRole = createServiceRoleClient();
const createdUserIds: string[] = [];

/** email の段階では 1 時間に 5 件まで（docs/er/07-safety-moderation.md#レート制限） */
const HOURLY_LIMIT_FOR_EMAIL = 5;

let meshCodeSequence = 0;
function uniqueMeshCode(): string {
  meshCodeSequence += 1;
  return `55${String(Date.now()).slice(-6)}${String(meshCodeSequence).padStart(2, "0")}`;
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
});

describe("本人確認の段階", () => {
  test("メール確認済みのアカウントは email の段階から始まる", async () => {
    const user = await newRegisteredUser();

    const { data } = await serviceRole
      .from("users")
      .select("verification_level")
      .eq("id", user.id)
      .single();

    // anonymous のままだと上限が 0 で 1 件も投稿できない
    expect(data?.verification_level).toBe("email");
  });
});

describe("投稿のレート制限(BE-23)", () => {
  test("上限までは投稿でき、超えると弾かれる", async () => {
    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);

    for (let index = 0; index < HOURLY_LIMIT_FOR_EMAIL; index += 1) {
      await caller.fieldReport.create({
        meshCode: uniqueMeshCode(),
        roadCondition: "passable",
      });
    }

    await expect(
      caller.fieldReport.create({
        meshCode: uniqueMeshCode(),
        roadCondition: "passable",
      }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  test("弾かれた投稿は保存されない", async () => {
    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);

    for (let index = 0; index < HOURLY_LIMIT_FOR_EMAIL; index += 1) {
      await caller.fieldReport.create({
        meshCode: uniqueMeshCode(),
        roadCondition: "caution",
      });
    }

    const blockedMeshCode = uniqueMeshCode();
    await expect(
      caller.fieldReport.create({
        meshCode: blockedMeshCode,
        roadCondition: "caution",
      }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });

    const { data } = await serviceRole
      .from("field_reports")
      .select("id")
      .eq("mesh_code", blockedMeshCode);

    expect(data).toEqual([]);
  });

  test("カウンタは成功した投稿の回数だけを数える", async () => {
    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);

    for (let index = 0; index < HOURLY_LIMIT_FOR_EMAIL; index += 1) {
      await caller.fieldReport.create({
        meshCode: uniqueMeshCode(),
        roadCondition: "passable",
      });
    }
    await caller.fieldReport
      .create({ meshCode: uniqueMeshCode(), roadCondition: "passable" })
      .catch(() => undefined);

    const { data } = await serviceRole
      .from("rate_limit_counters")
      .select("scope, count")
      .eq("user_id", user.id)
      .eq("action", "field_report");

    // 上限を超えた試行は巻き戻るため加算されない
    for (const row of data ?? []) {
      expect(row.count).toBe(HOURLY_LIMIT_FOR_EMAIL);
    }
    expect(data?.map((row) => row.scope).sort()).toEqual(["day", "hour"]);
  });

  test("ある人が上限に達しても、別の人の投稿は通る", async () => {
    const blocked = await newRegisteredUser();
    const other = await newRegisteredUser();

    const { caller: blockedCaller } = await createCallerFor(blocked);
    for (let index = 0; index < HOURLY_LIMIT_FOR_EMAIL; index += 1) {
      await blockedCaller.fieldReport.create({
        meshCode: uniqueMeshCode(),
        roadCondition: "passable",
      });
    }
    await expect(
      blockedCaller.fieldReport.create({
        meshCode: uniqueMeshCode(),
        roadCondition: "passable",
      }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });

    const { caller: otherCaller } = await createCallerFor(other);
    const posted = await otherCaller.fieldReport.create({
      meshCode: uniqueMeshCode(),
      roadCondition: "passable",
    });

    expect(posted.id).toBeTruthy();
  });
});

describe("上限とカウンタの守り", () => {
  test("上限のマスタは誰でも読める", async () => {
    const user = await newRegisteredUser();
    const { ctx } = await createCallerFor(user);

    const { data } = await ctx.supabase
      .from("rate_limits")
      .select("action, scope, level, max_count")
      .eq("action", "field_report")
      .eq("scope", "hour")
      .eq("level", "email")
      .single();

    expect(data?.max_count).toBe(HOURLY_LIMIT_FOR_EMAIL);
  });

  test("上限のマスタは書き換えられない", async () => {
    const user = await newRegisteredUser();
    const { ctx } = await createCallerFor(user);

    const { error } = await ctx.supabase
      .from("rate_limits")
      .update({ max_count: 9999 })
      .eq("action", "field_report");

    expect(error?.code).toBe("42501");
  });

  test("自分のカウンタは読めるが、書き換えて上限を回避することはできない", async () => {
    const user = await newRegisteredUser();
    const { caller, ctx } = await createCallerFor(user);
    await caller.fieldReport.create({
      meshCode: uniqueMeshCode(),
      roadCondition: "passable",
    });

    const { data } = await ctx.supabase
      .from("rate_limit_counters")
      .select("count")
      .eq("user_id", user.id);
    expect(data?.length).toBe(2);

    const { error } = await ctx.supabase
      .from("rate_limit_counters")
      .update({ count: 0 })
      .eq("user_id", user.id);
    expect(error?.code).toBe("42501");
  });

  test("他人のカウンタは読めない", async () => {
    const owner = await newRegisteredUser();
    const stranger = await newRegisteredUser();

    const { caller } = await createCallerFor(owner);
    await caller.fieldReport.create({
      meshCode: uniqueMeshCode(),
      roadCondition: "passable",
    });

    const { ctx } = await createCallerFor(stranger);
    const { data } = await ctx.supabase
      .from("rate_limit_counters")
      .select("user_id")
      .eq("user_id", owner.id);

    expect(data).toEqual([]);
  });
});
