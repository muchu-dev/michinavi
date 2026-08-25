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

/** 後片付けまで含めてテストユーザーを用意する */
async function newUser(): Promise<TestUser> {
  const user = await createTestUser();
  createdUserIds.push(user.id);
  return user;
}

afterEach(async () => {
  await Promise.all(createdUserIds.splice(0).map(deleteTestUser));
});

describe("user.setup", () => {
  test("認証済みユーザーが実行すると、ユーザーと本人 1 人の世帯が作られる", async () => {
    const user = await newUser();
    const { caller } = await createCallerFor(user);

    const result = await caller.user.setup({
      displayName: "山田太郎",
      areaId: SEED_AREA_IDS.mabiYata,
      homeMeshCode: "5133451124",
      householdName: "山田家",
      ageGroup: "adult",
      carCount: 1,
    });

    expect(result.user.id).toBe(user.id);
    expect(result.household.name).toBe("山田家");
    expect(result.isCreated).toBe(true);

    const { data: users } = await serviceRole
      .from("users")
      .select("id, display_name, area_id, home_mesh_code")
      .eq("id", user.id);
    expect(users).toHaveLength(1);
    expect(users?.[0]?.display_name).toBe("山田太郎");
    expect(users?.[0]?.home_mesh_code).toBe("5133451124");

    const { data: households } = await serviceRole
      .from("households")
      .select("id, owner_user_id, area_id, car_count, has_car")
      .eq("id", result.household.id);
    expect(households).toHaveLength(1);
    // 作成した本人が世帯の管理者になっている
    expect(households?.[0]?.owner_user_id).toBe(user.id);

    const { data: members } = await serviceRole
      .from("household_members")
      .select("id, user_id, display_name, age_group, is_primary")
      .eq("household_id", result.household.id);
    expect(members).toHaveLength(1);
    expect(members?.[0]?.user_id).toBe(user.id);
    // 本人の構成員レコードが既定の世帯になっている
    expect(members?.[0]?.is_primary).toBe(true);
    expect(members?.[0]?.age_group).toBe("adult");
  });

  test("世帯の呼び名を省略すると、表示名がそのまま使われる", async () => {
    const user = await newUser();
    const { caller } = await createCallerFor(user);

    const result = await caller.user.setup({
      displayName: "佐藤",
      areaId: SEED_AREA_IDS.mabiKawabe,
      homeMeshCode: "5133451125",
    });

    expect(result.household.name).toBe("佐藤");
  });

  test("has_car は car_count から生成される", async () => {
    const withoutCar = await newUser();
    const withCar = await newUser();

    const { caller: callerWithoutCar } = await createCallerFor(withoutCar);
    const noCarResult = await callerWithoutCar.user.setup({
      displayName: "車なし",
      areaId: SEED_AREA_IDS.mabiYata,
      homeMeshCode: "5133451124",
      carCount: 0,
    });
    expect(noCarResult.household.carCount).toBe(0);
    expect(noCarResult.household.hasCar).toBe(false);

    const { caller: callerWithCar } = await createCallerFor(withCar);
    const carResult = await callerWithCar.user.setup({
      displayName: "車あり",
      areaId: SEED_AREA_IDS.mabiYata,
      homeMeshCode: "5133451124",
      carCount: 2,
    });
    expect(carResult.household.carCount).toBe(2);
    expect(carResult.household.hasCar).toBe(true);

    // 生成列なので DB 側の値も一致する
    const { data } = await serviceRole
      .from("households")
      .select("car_count, has_car")
      .eq("id", carResult.household.id)
      .single();
    expect(data).toEqual({ car_count: 2, has_car: true });
  });

  test("未認証のリクエストは実行できない", async () => {
    const { caller } = await createAnonymousCaller();

    await expect(
      caller.user.setup({
        displayName: "名無し",
        areaId: SEED_AREA_IDS.mabiYata,
        homeMeshCode: "5133451124",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("壊れた JWT を送っても実行できない", async () => {
    const { caller } = await createCallerFor({
      id: "00000000-0000-4000-8000-00000000dead",
      email: "broken@example.test",
      accessToken: "not-a-valid-jwt",
    });

    await expect(
      caller.user.setup({
        displayName: "偽装",
        areaId: SEED_AREA_IDS.mabiYata,
        homeMeshCode: "5133451124",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("同じユーザーが再実行しても、世帯と構成員は増えない", async () => {
    const user = await newUser();
    const { caller } = await createCallerFor(user);

    const first = await caller.user.setup({
      displayName: "田中",
      areaId: SEED_AREA_IDS.mabiYata,
      homeMeshCode: "5133451124",
      householdName: "田中家",
      carCount: 1,
    });

    const second = await caller.user.setup({
      displayName: "別名",
      areaId: SEED_AREA_IDS.tamashima,
      homeMeshCode: "5133451130",
      householdName: "別世帯",
      carCount: 3,
    });

    expect(second.household.id).toBe(first.household.id);
    expect(second.householdMemberId).toBe(first.householdMemberId);
    expect(second.isCreated).toBe(false);
    // 既存の登録内容は上書きしない
    expect(second.household.name).toBe("田中家");

    const { count: householdCount } = await serviceRole
      .from("households")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", user.id);
    expect(householdCount).toBe(1);

    const { count: memberCount } = await serviceRole
      .from("household_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    expect(memberCount).toBe(1);
  });

  test("同時に実行しても、世帯は 1 つしか作られない", async () => {
    const user = await newUser();
    const { caller } = await createCallerFor(user);

    const input = {
      displayName: "同時実行",
      areaId: SEED_AREA_IDS.mabiYata,
      homeMeshCode: "5133451124",
    };

    const results = await Promise.all([
      caller.user.setup(input),
      caller.user.setup(input),
    ]);

    expect(results[0]?.household.id).toBe(results[1]?.household.id);

    const { count } = await serviceRole
      .from("households")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", user.id);
    expect(count).toBe(1);
  });

  test("入力に他人の ID を混ぜても、JWT のユーザーで作られる", async () => {
    const victim = await newUser();
    const attacker = await newUser();

    const { caller: victimCaller } = await createCallerFor(victim);
    const victimResult = await victimCaller.user.setup({
      displayName: "被害者",
      areaId: SEED_AREA_IDS.mabiYata,
      homeMeshCode: "5133451124",
    });

    const { caller: attackerCaller } = await createCallerFor(attacker);
    const attackerResult = await attackerCaller.user.setup({
      displayName: "攻撃者",
      areaId: SEED_AREA_IDS.mabiYata,
      homeMeshCode: "5133451124",
      // 入力に混ぜても認可には使われない
      userId: victim.id,
      ownerUserId: victim.id,
      householdId: victimResult.household.id,
    } as Parameters<typeof attackerCaller.user.setup>[0]);

    expect(attackerResult.user.id).toBe(attacker.id);
    expect(attackerResult.household.id).not.toBe(victimResult.household.id);

    const { data: victimHousehold } = await serviceRole
      .from("households")
      .select("owner_user_id")
      .eq("id", victimResult.household.id)
      .single();
    expect(victimHousehold?.owner_user_id).toBe(victim.id);

    const { count } = await serviceRole
      .from("household_members")
      .select("id", { count: "exact", head: true })
      .eq("household_id", victimResult.household.id);
    expect(count).toBe(1);
  });

  test("別ユーザーの users / households / household_members は取得できない", async () => {
    const owner = await newUser();
    const stranger = await newUser();

    const { caller: ownerCaller } = await createCallerFor(owner);
    const ownerResult = await ownerCaller.user.setup({
      displayName: "世帯主",
      areaId: SEED_AREA_IDS.mabiYata,
      homeMeshCode: "5133451124",
    });

    const { caller: strangerCaller, ctx: strangerCtx } =
      await createCallerFor(stranger);
    await strangerCaller.user.setup({
      displayName: "他人",
      areaId: SEED_AREA_IDS.tamashima,
      homeMeshCode: "5133451130",
    });

    const { data: users } = await strangerCtx.supabase
      .from("users")
      .select("id")
      .eq("id", owner.id);
    expect(users).toEqual([]);

    const { data: households } = await strangerCtx.supabase
      .from("households")
      .select("id")
      .eq("id", ownerResult.household.id);
    expect(households).toEqual([]);

    const { data: members } = await strangerCtx.supabase
      .from("household_members")
      .select("id")
      .eq("household_id", ownerResult.household.id);
    expect(members).toEqual([]);

    // 自分の行だけは見える
    const { data: ownRows } = await strangerCtx.supabase
      .from("users")
      .select("id");
    expect(ownRows).toEqual([{ id: stranger.id }]);
  });

  test("他人の世帯に自分を構成員として入れられない", async () => {
    const owner = await newUser();
    const stranger = await newUser();

    const { caller: ownerCaller } = await createCallerFor(owner);
    const ownerResult = await ownerCaller.user.setup({
      displayName: "世帯主",
      areaId: SEED_AREA_IDS.mabiYata,
      homeMeshCode: "5133451124",
    });

    const { ctx: strangerCtx } = await createCallerFor(stranger);
    const { error } = await strangerCtx.supabase
      .from("household_members")
      .insert({
        household_id: ownerResult.household.id,
        user_id: stranger.id,
        display_name: "侵入",
        age_group: "adult",
      });

    // RLS のポリシー違反
    expect(error?.code).toBe("42501");
  });

  test("DB 関数の途中で失敗すると、データが部分的に残らない", async () => {
    const user = await newUser();
    const { caller } = await createCallerFor(user);

    const error = await caller.user
      .setup({
        displayName: "存在しない地区",
        // seed に無い地区。外部キー違反で関数全体がロールバックする
        areaId: "00000000-0000-4000-8000-0000000000ff",
        homeMeshCode: "5133451124",
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TRPCError);
    expect(error).toMatchObject({ code: "BAD_REQUEST" });

    const { count: userCount } = await serviceRole
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("id", user.id);
    expect(userCount).toBe(0);

    const { count: householdCount } = await serviceRole
      .from("households")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", user.id);
    expect(householdCount).toBe(0);
  });

  test("世帯を削除できるのは管理者だけ", async () => {
    const owner = await newUser();
    const stranger = await newUser();

    const { caller: ownerCaller } = await createCallerFor(owner);
    const ownerResult = await ownerCaller.user.setup({
      displayName: "世帯主",
      areaId: SEED_AREA_IDS.mabiYata,
      homeMeshCode: "5133451124",
    });

    const { ctx: strangerCtx } = await createCallerFor(stranger);
    // RLS は対象の行を絞るので、エラーにはならず 1 行も消えない
    await strangerCtx.supabase
      .from("households")
      .delete()
      .eq("id", ownerResult.household.id);

    const { count } = await serviceRole
      .from("households")
      .select("id", { count: "exact", head: true })
      .eq("id", ownerResult.household.id);
    expect(count).toBe(1);
  });

  test("管理者以外は世帯の管理者を付け替えられない", async () => {
    const owner = await newUser();
    const member = await newUser();

    const { caller: ownerCaller, ctx: ownerCtx } = await createCallerFor(owner);
    const ownerResult = await ownerCaller.user.setup({
      displayName: "世帯主",
      areaId: SEED_AREA_IDS.mabiYata,
      homeMeshCode: "5133451124",
    });

    const { caller: memberCaller, ctx: memberCtx } =
      await createCallerFor(member);
    await memberCaller.user.setup({
      displayName: "同居人",
      areaId: SEED_AREA_IDS.mabiYata,
      homeMeshCode: "5133451124",
    });

    // 管理者が同居人を自分の世帯へ加える
    const { error: insertError } = await ownerCtx.supabase
      .from("household_members")
      .insert({
        household_id: ownerResult.household.id,
        user_id: member.id,
        display_name: "同居人",
        age_group: "adult",
      });
    expect(insertError).toBeNull();

    // 構成員になっても管理者の付け替えはできない
    const { error } = await memberCtx.supabase
      .from("households")
      .update({ owner_user_id: member.id })
      .eq("id", ownerResult.household.id);
    expect(error?.code).toBe("42501");

    const { data } = await serviceRole
      .from("households")
      .select("owner_user_id")
      .eq("id", ownerResult.household.id)
      .single();
    expect(data?.owner_user_id).toBe(owner.id);
  });

  test("入力の検証で弾かれる", async () => {
    const user = await newUser();
    const { caller } = await createCallerFor(user);

    // メッシュコードが 10 桁でない
    await expect(
      caller.user.setup({
        displayName: "検証",
        areaId: SEED_AREA_IDS.mabiYata,
        homeMeshCode: "51334511",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // 車の台数が負
    await expect(
      caller.user.setup({
        displayName: "検証",
        areaId: SEED_AREA_IDS.mabiYata,
        homeMeshCode: "5133451124",
        carCount: -1,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // 表示名が空
    await expect(
      caller.user.setup({
        displayName: "   ",
        areaId: SEED_AREA_IDS.mabiYata,
        homeMeshCode: "5133451124",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // 地区が UUID でない
    await expect(
      caller.user.setup({
        displayName: "検証",
        areaId: "not-a-uuid",
        homeMeshCode: "5133451124",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
