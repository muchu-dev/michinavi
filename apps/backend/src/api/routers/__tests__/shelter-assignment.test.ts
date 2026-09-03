import {
  createServiceRoleClient,
  createTestUser,
  deleteTestUser,
  SEED_AREA_IDS,
  type TestUser,
} from "@michinavi/testing";
import { afterEach, describe, expect, test } from "vitest";
import {
  createAnonymousCaller,
  createCallerFor,
} from "../../__tests__/helpers";

const serviceRole = createServiceRoleClient();
const createdUserIds: string[] = [];

/** seed の架空の避難所が集まっている場所（真備町箭田） */
const MABI_YATA = { latitude: 34.6383, longitude: 133.6903 };

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

/** 避難所の定員を一時的に変える。afterEach で戻す */
const capacityOverrides: { code: string; capacity: number | null }[] = [];
async function setCapacity(externalCode: string, capacity: number | null) {
  const { data } = await serviceRole
    .from("shelters")
    .select("capacity")
    .eq("external_code", externalCode)
    .single();

  capacityOverrides.push({
    code: externalCode,
    capacity: data?.capacity ?? null,
  });

  await serviceRole
    .from("shelters")
    .update({ capacity })
    .eq("external_code", externalCode);
}

afterEach(async () => {
  // 割り当ては世帯の削除に追随する（cascade）が、テストユーザーは
  // field_reports などが残ると消えないため、割り当てを直接消しておく
  await serviceRole
    .from("shelter_assignments")
    .delete()
    .neq("household_id", "00000000-0000-4000-8000-000000000000");

  for (const override of capacityOverrides.splice(0)) {
    await serviceRole
      .from("shelters")
      .update({ capacity: override.capacity })
      .eq("external_code", override.code);
  }

  await Promise.all(createdUserIds.splice(0).map(deleteTestUser));
});

describe("shelterAssignment.assign", () => {
  test("空いていれば最寄りの避難所が割り当てられる", async () => {
    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);

    const result = await caller.shelterAssignment.assign({
      ...MABI_YATA,
      radiusM: 3000,
    });

    const { caller: anonymousCaller } = await createAnonymousCaller();
    const nearby = await anonymousCaller.shelter.nearby({
      ...MABI_YATA,
      radiusM: 3000,
      limit: 10,
    });

    expect(result.shelterId).toBe(nearby[0]?.id);
    expect(result.isOverCapacity).toBe(false);
    expect(result.partySize).toBe(1);
  });

  test("想定人数は割り当てのたびに積み上がる", async () => {
    const first = await newRegisteredUser();
    const second = await newRegisteredUser();

    const { caller: firstCaller } = await createCallerFor(first);
    const assigned = await firstCaller.shelterAssignment.assign({
      ...MABI_YATA,
      radiusM: 3000,
    });

    const { caller: anonymousCaller } = await createAnonymousCaller();
    const loads = await anonymousCaller.shelterAssignment.loads({
      shelterIds: [assigned.shelterId],
    });
    expect(loads[0]?.expectedPeople).toBe(1);
    expect(loads[0]?.householdCount).toBe(1);

    const { caller: secondCaller } = await createCallerFor(second);
    const secondResult = await secondCaller.shelterAssignment.assign({
      ...MABI_YATA,
      radiusM: 3000,
    });

    // 2 人目には、1 人目までの想定人数が見えている
    expect(secondResult.expectedPeopleBefore).toBe(1);
  });

  test("定員が埋まっている避難所は避け、別の候補が割り当てられる", async () => {
    // 最寄りの定員を 1 にして、先に別の世帯で埋める
    await setCapacity("DEMO-SHELTER-001", 1);

    const first = await newRegisteredUser();
    const { caller: firstCaller } = await createCallerFor(first);
    const firstResult = await firstCaller.shelterAssignment.assign({
      ...MABI_YATA,
      radiusM: 3000,
    });

    const second = await newRegisteredUser();
    const { caller: secondCaller } = await createCallerFor(second);
    const secondResult = await secondCaller.shelterAssignment.assign({
      ...MABI_YATA,
      radiusM: 3000,
    });

    expect(secondResult.shelterId).not.toBe(firstResult.shelterId);
    expect(secondResult.isOverCapacity).toBe(false);
  });

  test("代替の候補が想定人数つきで返る", async () => {
    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);

    const result = await caller.shelterAssignment.assign({
      ...MABI_YATA,
      radiusM: 3000,
    });

    expect(result.alternatives.length).toBeGreaterThan(0);
    for (const alternative of result.alternatives) {
      expect(alternative.id).not.toBe(result.shelterId);
      expect(alternative.distanceM).toBeGreaterThanOrEqual(0);
      expect(alternative.expectedPeople).toBeGreaterThanOrEqual(0);
    }
  });

  test("どこも定員を超えていたら、最も空いている避難所を超過ありで返す", async () => {
    // 半径内の避難所（真備町の 4 件）をすべて定員 1 にし、1 世帯ずつ入れて埋める
    const codes = [
      "DEMO-SHELTER-001",
      "DEMO-SHELTER-002",
      "DEMO-SHELTER-003",
      "DEMO-SHELTER-004",
    ];
    for (const code of codes) {
      await setCapacity(code, 1);
    }

    for (let index = 0; index < codes.length; index += 1) {
      const filler = await newRegisteredUser();
      const { caller } = await createCallerFor(filler);
      await caller.shelterAssignment.assign({ ...MABI_YATA, radiusM: 3000 });
    }

    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);
    const result = await caller.shelterAssignment.assign({
      ...MABI_YATA,
      radiusM: 3000,
    });

    // 候補が 0 件になるより、超過を明示して出すほうが安全である
    expect(result.shelterId).toBeTruthy();
    expect(result.isOverCapacity).toBe(true);
  });

  test("定員が不明な避難所は上限不明として扱い、候補から外さない", async () => {
    await setCapacity("DEMO-SHELTER-001", 1);
    await setCapacity("DEMO-SHELTER-002", 1);

    const filler = await newRegisteredUser();
    const { caller: fillerCaller } = await createCallerFor(filler);
    await fillerCaller.shelterAssignment.assign({
      ...MABI_YATA,
      radiusM: 3000,
    });

    const second = await newRegisteredUser();
    const { caller: secondCaller } = await createCallerFor(second);
    await secondCaller.shelterAssignment.assign({
      ...MABI_YATA,
      radiusM: 3000,
    });

    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);
    const result = await caller.shelterAssignment.assign({
      ...MABI_YATA,
      radiusM: 3000,
    });

    // 定員が NULL の DEMO-SHELTER-003（高台公園）が残っている
    const { data } = await serviceRole
      .from("shelters")
      .select("external_code, capacity")
      .eq("id", result.shelterId)
      .single();

    expect(data?.external_code).toBe("DEMO-SHELTER-003");
    expect(data?.capacity).toBeNull();
    expect(result.isOverCapacity).toBe(false);
  });

  test("割り当ては世帯ごとに 1 つで、選び直すと上書きされる", async () => {
    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);

    await caller.shelterAssignment.assign({ ...MABI_YATA, radiusM: 3000 });
    await caller.shelterAssignment.assign({ ...MABI_YATA, radiusM: 20_000 });

    const current = await caller.shelterAssignment.current();
    expect(current?.shelterId).toBeTruthy();

    const { data } = await serviceRole
      .from("shelter_assignments")
      .select("household_id");
    expect(data).toHaveLength(1);
  });

  test("周辺に避難所が無ければエラーになる", async () => {
    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);

    await expect(
      caller.shelterAssignment.assign({
        latitude: 43.0,
        longitude: 141.0,
        radiusM: 1000,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("未認証では割り当てられない", async () => {
    const { caller } = await createAnonymousCaller();

    await expect(
      caller.shelterAssignment.assign({ ...MABI_YATA, radiusM: 3000 }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("割り当ての守り", () => {
  test("他人の避難先は読めない", async () => {
    const owner = await newRegisteredUser();
    const stranger = await newRegisteredUser();

    const { caller: ownerCaller } = await createCallerFor(owner);
    await ownerCaller.shelterAssignment.assign({ ...MABI_YATA, radiusM: 3000 });

    const { caller: strangerCaller, ctx } = await createCallerFor(stranger);
    expect(await strangerCaller.shelterAssignment.current()).toBeNull();

    const { data } = await ctx.supabase
      .from("shelter_assignments")
      .select("household_id, shelter_id");
    expect(data).toEqual([]);
  });

  test("想定人数を直接書き込んで候補から外させることはできない", async () => {
    const owner = await newRegisteredUser();
    const attacker = await newRegisteredUser();

    const { caller } = await createCallerFor(owner);
    const assigned = await caller.shelterAssignment.assign({
      ...MABI_YATA,
      radiusM: 3000,
    });

    const { ctx } = await createCallerFor(attacker);
    const { error } = await ctx.supabase.from("shelter_assignments").insert({
      household_id: "00000000-0000-4000-8000-00000000beef",
      shelter_id: assigned.shelterId,
      party_size: 999,
    });

    expect(error?.code).toBe("42501");
  });

  test("想定人数の集計は、どの世帯が行くかを返さない", async () => {
    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);
    const assigned = await caller.shelterAssignment.assign({
      ...MABI_YATA,
      radiusM: 3000,
    });

    const { caller: anonymousCaller } = await createAnonymousCaller();
    const loads = await anonymousCaller.shelterAssignment.loads({
      shelterIds: [assigned.shelterId],
    });

    expect(loads[0]?.expectedPeople).toBe(1);
    expect(Object.keys(loads[0] ?? {})).toEqual([
      "shelterId",
      "expectedPeople",
      "householdCount",
      "capacity",
      "occupancyRate",
    ]);
  });
});
