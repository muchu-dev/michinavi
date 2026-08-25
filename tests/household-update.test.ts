import { TRPCError } from "@trpc/server";
import { afterEach, describe, expect, test } from "vitest";
import {
  createAnonymousCaller,
  createCallerFor,
  createServiceRoleClient,
  createTestUser,
  deleteTestUser,
  SEED_AREA_IDS,
  type TestUser,
} from "./helpers/supabase";

const serviceRole = createServiceRoleClient();
const createdUserIds: string[] = [];

/** 後片付けまで含めてテストユーザーを用意し、初期登録も済ませる */
async function newHouseholdUser() {
  const user = await createTestUser();
  createdUserIds.push(user.id);
  const { caller, ctx } = await createCallerFor(user);

  const setup = await caller.user.setup({
    displayName: "山田太郎",
    areaId: SEED_AREA_IDS.mabiYata,
    homeMeshCode: "5133451124",
    householdName: "山田家",
    ageGroup: "adult",
    carCount: 0,
  });

  return { user, caller, ctx, setup };
}

afterEach(async () => {
  await Promise.all(createdUserIds.splice(0).map(deleteTestUser));
});

describe("household.get", () => {
  test("初期登録直後は本人 1 人だけの世帯が返る", async () => {
    const { caller, setup } = await newHouseholdUser();

    const result = await caller.household.get();

    expect(result.household.id).toBe(setup.household.id);
    expect(result.household.carCount).toBe(0);
    expect(result.members).toHaveLength(1);
    expect(result.members[0]?.isPrimary).toBe(true);
    expect(result.members[0]?.ageGroup).toBe("adult");
    expect(result.members[0]?.careNeedKeys).toEqual([]);
    expect(result.pets).toEqual([]);
  });

  test("世帯を作っていないユーザーは NOT_FOUND", async () => {
    const user = await createTestUser();
    createdUserIds.push(user.id);
    const { caller } = await createCallerFor(user);

    await expect(caller.household.get()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("未認証のリクエストは実行できない", async () => {
    const { caller } = await createAnonymousCaller();

    await expect(caller.household.get()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("household.update", () => {
  test("車・住所・年齢層・要配慮・ペットをまとめて更新できる", async () => {
    const { caller, setup } = await newHouseholdUser();
    const primaryMemberId = setup.householdMemberId;

    const result = await caller.household.update({
      areaId: SEED_AREA_IDS.tamashima,
      homeMeshCode: "5133451130",
      carCount: 2,
      members: [
        {
          id: primaryMemberId,
          displayName: "山田太郎",
          ageGroup: "adult",
          needsAssistance: false,
          careNeedKeys: ["wheelchair"],
          careNeedDetail: "電動車いすを使用",
        },
        {
          displayName: "山田花子",
          ageGroup: "senior",
          needsAssistance: true,
          careNeedKeys: ["dementia"],
        },
      ],
      pets: [
        { species: "dog", size: "medium", count: 1, isCrateTrained: true },
      ],
    });

    expect(result.household.areaId).toBe(SEED_AREA_IDS.tamashima);
    expect(result.household.homeMeshCode).toBe("5133451130");
    expect(result.household.carCount).toBe(2);
    expect(result.household.hasCar).toBe(true);

    expect(result.members).toHaveLength(2);
    const primary = result.members.find((m) => m.id === primaryMemberId);
    expect(primary?.careNeedKeys).toEqual(["wheelchair"]);
    expect(primary?.careNeedDetail).toBe("電動車いすを使用");

    const newMember = result.members.find((m) => m.id !== primaryMemberId);
    expect(newMember?.displayName).toBe("山田花子");
    expect(newMember?.ageGroup).toBe("senior");
    expect(newMember?.needsAssistance).toBe(true);
    expect(newMember?.careNeedKeys).toEqual(["dementia"]);
    expect(newMember?.userId).toBeNull();

    expect(result.pets).toHaveLength(1);
    expect(result.pets[0]).toMatchObject({
      species: "dog",
      size: "medium",
      count: 1,
      isCrateTrained: true,
    });

    // service role 側からも同じ内容が見える
    const { data: dbPets } = await serviceRole
      .from("pets")
      .select("species, size, count")
      .eq("household_id", setup.household.id);
    expect(dbPets).toHaveLength(1);
  });

  test("構成員とペットは入力どおりに全置換される", async () => {
    const { caller, setup } = await newHouseholdUser();
    const primaryMemberId = setup.householdMemberId;

    const first = await caller.household.update({
      areaId: SEED_AREA_IDS.mabiYata,
      homeMeshCode: "5133451124",
      carCount: 0,
      members: [
        {
          id: primaryMemberId,
          displayName: "山田太郎",
          ageGroup: "adult",
          needsAssistance: false,
          careNeedKeys: [],
        },
        {
          displayName: "山田次郎",
          ageGroup: "child",
          needsAssistance: false,
          careNeedKeys: [],
        },
      ],
      pets: [{ species: "cat", size: "small", count: 2 }],
    });
    expect(first.members).toHaveLength(2);

    // 次郎を含めずに送ると脱退として扱われ、ペットも入れ替わる
    const second = await caller.household.update({
      areaId: SEED_AREA_IDS.mabiYata,
      homeMeshCode: "5133451124",
      carCount: 0,
      members: [
        {
          id: primaryMemberId,
          displayName: "山田太郎",
          ageGroup: "adult",
          needsAssistance: false,
          careNeedKeys: [],
        },
      ],
      pets: [],
    });

    expect(second.members).toHaveLength(1);
    expect(second.members[0]?.id).toBe(primaryMemberId);
    expect(second.pets).toEqual([]);

    const { count: memberCount } = await serviceRole
      .from("household_members")
      .select("id", { count: "exact", head: true })
      .eq("household_id", setup.household.id);
    expect(memberCount).toBe(1);
  });

  test("本人（is_primary）の行は入力から漏れても削除されない", async () => {
    const { caller, setup } = await newHouseholdUser();

    const result = await caller.household.update({
      areaId: SEED_AREA_IDS.mabiYata,
      homeMeshCode: "5133451124",
      carCount: 0,
      members: [
        {
          displayName: "山田次郎",
          ageGroup: "child",
          needsAssistance: false,
        },
      ],
      pets: [],
    });

    expect(
      result.members.some((m) => m.id === setup.householdMemberId),
    ).toBe(true);
    expect(result.members).toHaveLength(2);
  });

  test("未認証のリクエストは実行できない", async () => {
    const { caller } = await createAnonymousCaller();

    await expect(
      caller.household.update({
        areaId: SEED_AREA_IDS.mabiYata,
        homeMeshCode: "5133451124",
        carCount: 0,
        members: [
          { displayName: "名無し", ageGroup: "adult", needsAssistance: false },
        ],
        pets: [],
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("他人の構成員 id を渡しても更新できない", async () => {
    const owner = await newHouseholdUser();
    const stranger = await newHouseholdUser();

    const error = await stranger.caller.household
      .update({
        areaId: SEED_AREA_IDS.mabiYata,
        homeMeshCode: "5133451124",
        carCount: 0,
        members: [
          {
            id: owner.setup.householdMemberId,
            displayName: "乗っ取り",
            ageGroup: "adult",
            needsAssistance: false,
          },
        ],
        pets: [],
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TRPCError);
    expect(error).toMatchObject({ code: "NOT_FOUND" });

    // 被害者側の構成員は変わっていない
    const { data } = await serviceRole
      .from("household_members")
      .select("display_name")
      .eq("id", owner.setup.householdMemberId)
      .single();
    expect(data?.display_name).toBe("山田太郎");
  });

  test("入力の検証で弾かれる", async () => {
    const { caller } = await newHouseholdUser();

    // メッシュコードが 10 桁でない
    await expect(
      caller.household.update({
        areaId: SEED_AREA_IDS.mabiYata,
        homeMeshCode: "12345",
        carCount: 0,
        members: [
          { displayName: "検証", ageGroup: "adult", needsAssistance: false },
        ],
        pets: [],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // 構成員が 1 人もいない
    await expect(
      caller.household.update({
        areaId: SEED_AREA_IDS.mabiYata,
        homeMeshCode: "5133451124",
        carCount: 0,
        members: [],
        pets: [],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // 存在しない要配慮キー
    await expect(
      caller.household.update({
        areaId: SEED_AREA_IDS.mabiYata,
        homeMeshCode: "5133451124",
        carCount: 0,
        members: [
          {
            displayName: "検証",
            ageGroup: "adult",
            needsAssistance: false,
            careNeedKeys: ["not_a_real_care_need"] as never,
          },
        ],
        pets: [],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // ペットの頭数が 0
    await expect(
      caller.household.update({
        areaId: SEED_AREA_IDS.mabiYata,
        homeMeshCode: "5133451124",
        carCount: 0,
        members: [
          { displayName: "検証", ageGroup: "adult", needsAssistance: false },
        ],
        pets: [{ species: "dog", size: "small", count: 0 }],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
