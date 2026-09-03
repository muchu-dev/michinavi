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

async function newRegisteredUser(
  displayName = "テスト太郎",
): Promise<TestUser> {
  const user = await createTestUser();
  createdUserIds.push(user.id);

  const { caller } = await createCallerFor(user);
  await caller.user.setup({
    displayName,
    areaId: SEED_AREA_IDS.mabiYata,
    homeMeshCode: "5133451124",
  });

  return user;
}

/** アカウントを持たない家族を 1 人足した世帯を作る */
async function newHouseholdWithProxyMember(displayName = "テスト太郎") {
  const user = await newRegisteredUser(displayName);
  const { caller } = await createCallerFor(user);
  const household = await caller.household.get();
  const primary = household.members.find((member) => member.isPrimary);

  if (!primary) {
    throw new Error("本人の構成員が見つかりません");
  }

  const updated = await caller.household.update({
    areaId: SEED_AREA_IDS.mabiYata,
    homeMeshCode: "5133451124",
    carCount: 0,
    members: [
      {
        id: primary.id,
        displayName,
        ageGroup: "adult",
        needsAssistance: false,
        careNeeds: [],
      },
      {
        displayName: "祖母",
        ageGroup: "senior",
        needsAssistance: true,
        careNeeds: [],
      },
    ],
    pets: [],
  });

  const proxyMember = updated.members.find((member) => !member.isPrimary);
  if (!proxyMember) {
    throw new Error("代理登録の対象が見つかりません");
  }

  return { user, selfMemberId: primary.id, proxyMemberId: proxyMember.id };
}

/**
 * 同じ世帯にもう 1 人アカウント持ちの家族を入れる。
 * 招待の仕組み（A2）がまだ無いため、service role で構成員の行を足す
 */
async function joinHousehold(householdId: string, displayName: string) {
  const user = await createTestUser();
  createdUserIds.push(user.id);

  const { error: userError } = await serviceRole
    .from("users")
    .insert({ id: user.id, display_name: displayName });
  expect(userError).toBeNull();

  const { data, error } = await serviceRole
    .from("household_members")
    .insert({
      household_id: householdId,
      user_id: user.id,
      display_name: displayName,
      age_group: "adult",
      is_primary: true,
    })
    .select("id")
    .single();
  expect(error).toBeNull();

  return { user, memberId: data?.id as string };
}

afterEach(async () => {
  await Promise.all(createdUserIds.splice(0).map(deleteTestUser));
});

describe("memberStatus.set", () => {
  test("自分の安否を登録すると現在値と履歴の両方が残る", async () => {
    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);

    const result = await caller.memberStatus.set({
      status: "evacuating",
      needsHelp: false,
      message: "これから避難所へ向かいます",
    });

    expect(result.isProxy).toBe(false);

    const { data: current } = await serviceRole
      .from("member_statuses")
      .select("status, message, needs_help")
      .eq("household_member_id", result.memberId)
      .single();
    expect(current?.status).toBe("evacuating");
    expect(current?.message).toBe("これから避難所へ向かいます");

    const history = await caller.memberStatus.history({ limit: 10 });
    expect(history).toHaveLength(1);
    expect(history[0]?.source).toBe("self");
  });

  test("状態を変えると現在値が上書きされ、履歴は積み上がる", async () => {
    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);

    await caller.memberStatus.set({ status: "preparing" });
    await caller.memberStatus.set({ status: "at_shelter" });

    const list = await caller.memberStatus.listForHousehold();
    expect(list[0]?.status).toBe("at_shelter");

    const history = await caller.memberStatus.history({ limit: 10 });
    expect(history.map((row) => row.status)).toEqual([
      "at_shelter",
      "preparing",
    ]);
  });

  test("避難済みでも支援が必要だと伝えられる", async () => {
    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);

    await caller.memberStatus.set({
      status: "at_shelter",
      needsHelp: true,
      message: "薬が切れそうです",
    });

    const list = await caller.memberStatus.listForHousehold();
    expect(list[0]?.status).toBe("at_shelter");
    expect(list[0]?.needsHelp).toBe(true);
  });

  test("未認証では登録できない", async () => {
    const { caller } = await createAnonymousCaller();

    await expect(
      caller.memberStatus.set({ status: "safe_home" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("家族への共有(E4/E5)", () => {
  test("同じ世帯の家族には相手の状態が見える", async () => {
    const { user: owner } = await newHouseholdWithProxyMember("父");
    const { caller: ownerCaller } = await createCallerFor(owner);
    const household = await ownerCaller.household.get();

    const { user: family } = await joinHousehold(household.household.id, "母");

    await ownerCaller.memberStatus.set({
      status: "at_shelter",
      needsHelp: true,
    });

    const { caller: familyCaller } = await createCallerFor(family);
    const list = await familyCaller.memberStatus.listForHousehold();
    const father = list.find((row) => row.displayName === "父");

    expect(father?.status).toBe("at_shelter");
    expect(father?.needsHelp).toBe(true);
  });

  test("別の世帯の人には見えない", async () => {
    const owner = await newRegisteredUser("父");
    const stranger = await newRegisteredUser("他人");

    const { caller: ownerCaller } = await createCallerFor(owner);
    const result = await ownerCaller.memberStatus.set({ status: "needs_help" });

    const { caller: strangerCaller, ctx } = await createCallerFor(stranger);
    const list = await strangerCaller.memberStatus.listForHousehold();
    expect(list.some((row) => row.memberId === result.memberId)).toBe(false);

    const { data } = await ctx.supabase
      .from("member_statuses")
      .select("status")
      .eq("household_member_id", result.memberId);
    expect(data).toEqual([]);
  });

  test("共有範囲を none にすると、家族からも状態が見えなくなる", async () => {
    const { user: owner } = await newHouseholdWithProxyMember("父");
    const { caller: ownerCaller } = await createCallerFor(owner);
    const household = await ownerCaller.household.get();
    const { user: family } = await joinHousehold(household.household.id, "母");

    await ownerCaller.memberStatus.set({ status: "safe_home" });
    await ownerCaller.memberStatus.setShareScope({ scope: "none" });

    const { caller: familyCaller } = await createCallerFor(family);
    const list = await familyCaller.memberStatus.listForHousehold();
    const father = list.find((row) => row.displayName === "父");

    // 名前は消さず、状態だけを伏せる
    expect(father).toBeTruthy();
    expect(father?.status).toBeNull();

    // 本人には引き続き見える
    const ownList = await ownerCaller.memberStatus.listForHousehold();
    expect(ownList.find((row) => row.isSelf)?.status).toBe("safe_home");
  });
});

describe("代理登録", () => {
  test("アカウントを持たない家族の安否を代理で登録できる", async () => {
    const { user, proxyMemberId } = await newHouseholdWithProxyMember();
    const { caller } = await createCallerFor(user);

    const result = await caller.memberStatus.set({
      memberId: proxyMemberId,
      status: "at_shelter",
      needsHelp: true,
    });

    expect(result.isProxy).toBe(true);

    const list = await caller.memberStatus.listForHousehold();
    const grandmother = list.find((row) => row.memberId === proxyMemberId);
    expect(grandmother?.status).toBe("at_shelter");
    expect(grandmother?.hasAccount).toBe(false);

    const { data } = await serviceRole
      .from("member_status_events")
      .select("source, actor_user_id")
      .eq("household_member_id", proxyMemberId)
      .single();
    expect(data?.source).toBe("proxy");
    expect(data?.actor_user_id).toBe(user.id);
  });

  test("別の世帯の構成員は代理登録できない", async () => {
    const { proxyMemberId } = await newHouseholdWithProxyMember();
    const stranger = await newRegisteredUser("他人");
    const { caller } = await createCallerFor(stranger);

    await expect(
      caller.memberStatus.set({
        memberId: proxyMemberId,
        status: "safe_home",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("アカウントを持つ家族の安否は代理で書き換えられない", async () => {
    const { user: owner } = await newHouseholdWithProxyMember("父");
    const { caller: ownerCaller } = await createCallerFor(owner);
    const household = await ownerCaller.household.get();
    const { memberId: familyMemberId } = await joinHousehold(
      household.household.id,
      "母",
    );

    await expect(
      ownerCaller.memberStatus.set({
        memberId: familyMemberId,
        status: "safe_home",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("現在値の守り", () => {
  test("現在値を直接書き換えることはできない", async () => {
    const user = await newRegisteredUser();
    const { caller, ctx } = await createCallerFor(user);
    const result = await caller.memberStatus.set({ status: "needs_help" });

    const { error } = await ctx.supabase
      .from("member_statuses")
      .update({ status: "safe_home", needs_help: false })
      .eq("household_member_id", result.memberId);

    expect(error?.code).toBe("42501");

    const { data } = await serviceRole
      .from("member_statuses")
      .select("status")
      .eq("household_member_id", result.memberId)
      .single();
    expect(data?.status).toBe("needs_help");
  });

  test("他人になりすまして履歴を足すことはできない", async () => {
    const owner = await newRegisteredUser("父");
    const attacker = await newRegisteredUser("他人");
    const { caller: ownerCaller } = await createCallerFor(owner);
    const own = await ownerCaller.memberStatus.set({ status: "safe_home" });

    const { ctx } = await createCallerFor(attacker);
    const { error } = await ctx.supabase.from("member_status_events").insert({
      household_member_id: own.memberId,
      status: "needs_help",
      actor_user_id: attacker.id,
    });

    expect(error?.code).toBe("42501");
  });
});
