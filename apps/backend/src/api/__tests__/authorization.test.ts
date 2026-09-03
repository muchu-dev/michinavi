import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createServiceRoleClient,
  createTestUser,
  deleteTestUser,
  SEED_AREA_IDS,
  type TestUser,
} from "@michinavi/testing";
import { afterEach, describe, expect, test } from "vitest";
import { createAnonymousCaller, createCallerFor } from "./helpers";

/**
 * 認可の確認（BE-25、機能 S6）。
 *
 * 「他人の ID を指定しても取れない」ことを、tRPC の入り口と PostgREST の
 * 両方から確かめる。router を通さず直接テーブルを叩く経路が残っていると、
 * router 側の検査だけでは守れないためである
 * （docs/er/07-safety-moderation.md#認可のテスト）。
 */

const serviceRole = createServiceRoleClient();
const createdUserIds: string[] = [];

/**
 * 公開してよいテーブル。ここに無いテーブルは、未ログインから 1 行も
 * 読めないことを検査する。
 *
 * 新しいテーブルを足したときにこのテストが落ちたら、公開してよいかを
 * 判断してここへ足すか、RLS を直すかのどちらかになる。黙って公開されない
 * ようにするのがこの一覧の役目である。
 */
const PUBLICLY_READABLE_TABLES = new Set([
  // 地区マスタ（地図の初期表示に要る）
  "areas",
  // 要配慮の種類のマスタ（登録画面の選択肢）
  "care_needs",
  // 現地報告そのもの（C3。未ログインでも地図を見られる）
  "field_reports",
  // 現地報告に添えた写真（C3。投稿本体と同じく未ログインでも見える。BE-13）
  "field_report_photos",
  // 避難所（D1/D2）。地区の境界と同じく公開情報として座標を丸めない。BE-14
  "shelters",
  // 避難所が対応する災害種別（BE-14）
  "shelter_hazard_supports",
  // 受入条件のマスタ（表示用の選択肢。BE-14）
  "acceptance_conditions",
  // 避難所ごとの受入条件の状況（BE-14）
  "shelter_acceptances",
  // レート制限のしきい値マスタ。個人データを含まない運用パラメータで、
  // 画面側で「あと何回投稿できるか」を出す用途にも使える（BE-23）
  "rate_limits",
  // mesh_code ごとの道路状態のAI推定（BE-16）。地図表示用で、field_reports と
  // 同じく未ログインでも見える（roadStatus.list は publicProcedure）
  "road_status_estimates",
]);

/**
 * 生成された型定義からテーブル名を読む。
 * テストに一覧を書き写すと、テーブルが増えたときに古いままになる
 */
function listPublicTables(): string[] {
  const source = readFileSync(
    fileURLToPath(
      new URL(
        "../../../../../packages/db/src/database.types.ts",
        import.meta.url,
      ),
    ),
    "utf8",
  );
  const tablesBlock = source.slice(
    source.indexOf("    Tables: {"),
    source.indexOf("    Views: {"),
  );

  return [
    ...new Set(
      [...tablesBlock.matchAll(/^ {6}([a-z_]+): \{$/gm)].flatMap((matched) =>
        matched[1] ? [matched[1]] : [],
      ),
    ),
  ];
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

/** 世帯・構成員・ペット・要配慮まで登録済みのユーザーを作る */
async function newUserWithFamily() {
  const user = await newRegisteredUser();
  const { caller } = await createCallerFor(user);
  const household = await caller.household.get();
  const primary = household.members.find((member) => member.isPrimary);

  if (!primary) {
    throw new Error("本人の構成員が見つかりません");
  }

  await caller.household.update({
    areaId: SEED_AREA_IDS.mabiYata,
    homeMeshCode: "5133451124",
    carCount: 1,
    members: [
      {
        id: primary.id,
        displayName: "テスト太郎",
        ageGroup: "adult",
        needsAssistance: false,
        careNeeds: [],
      },
      {
        displayName: "テスト花子",
        ageGroup: "senior",
        needsAssistance: true,
        careNeeds: [{ key: "wheelchair", detail: "電動車いす" }],
      },
    ],
    pets: [{ species: "dog", size: "small", count: 1, isCrateTrained: true }],
  });

  return { user, householdId: household.household.id };
}

afterEach(async () => {
  await Promise.all(createdUserIds.splice(0).map(deleteTestUser));
});

describe("未ログインからの読み取り", () => {
  const tables = listPublicTables();

  test("検査の対象になるテーブルが 1 つ以上ある", () => {
    expect(tables.length).toBeGreaterThan(0);
  });

  test.each(
    tables.filter((table) => !PUBLICLY_READABLE_TABLES.has(table)),
  )("%s は未ログインから 1 行も読めない", async (table) => {
    const { ctx } = await createAnonymousCaller();
    // biome-ignore lint/suspicious/noExplicitAny: テーブル名を実行時に決めるため
    const { data, error } = await (ctx.supabase as any)
      .from(table)
      .select("*")
      .limit(1);

    // 権限エラーで弾かれるか、RLS で 0 行になるかのどちらか
    if (error) {
      expect(error.code).toBe("42501");
    } else {
      expect(data).toEqual([]);
    }
  });

  test.each([
    ...PUBLICLY_READABLE_TABLES,
  ])("%s は公開してよいテーブルとして扱っている", (table) => {
    expect(tables).toContain(table);
  });
});

describe("他人の ID を指定した読み取り", () => {
  test("他人の世帯 ID を指定しても世帯情報は取れない", async () => {
    const { householdId } = await newUserWithFamily();
    const stranger = await newRegisteredUser();
    const { ctx } = await createCallerFor(stranger);

    const { data } = await ctx.supabase
      .from("households")
      .select("id, home_mesh_code, car_count")
      .eq("id", householdId);

    expect(data).toEqual([]);
  });

  test("他人の世帯 ID を指定しても構成員は取れない", async () => {
    const { householdId } = await newUserWithFamily();
    const stranger = await newRegisteredUser();
    const { ctx } = await createCallerFor(stranger);

    const { data } = await ctx.supabase
      .from("household_members")
      .select("id, display_name, age_group, needs_assistance")
      .eq("household_id", householdId);

    expect(data).toEqual([]);
  });

  test("他人の世帯 ID を指定してもペットは取れない", async () => {
    const { householdId } = await newUserWithFamily();
    const stranger = await newRegisteredUser();
    const { ctx } = await createCallerFor(stranger);

    const { data } = await ctx.supabase
      .from("pets")
      .select("id, species, size")
      .eq("household_id", householdId);

    expect(data).toEqual([]);
  });

  test("他人の構成員 ID を指定しても要配慮の内容は取れない", async () => {
    const { user, householdId } = await newUserWithFamily();
    const stranger = await newRegisteredUser();

    // 本人には見えていることを先に確かめる（テストが素通しになるのを防ぐ）
    const { data: ownerRows } = await serviceRole
      .from("household_members")
      .select("id")
      .eq("household_id", householdId);
    const memberIds = (ownerRows ?? []).map((row) => row.id);
    expect(memberIds.length).toBeGreaterThan(1);

    const { ctx: ownerCtx } = await createCallerFor(user);
    const { data: visibleToOwner } = await ownerCtx.supabase
      .from("household_member_care_needs")
      .select("household_member_id, detail")
      .in("household_member_id", memberIds);
    expect(visibleToOwner?.length).toBe(1);

    const { ctx } = await createCallerFor(stranger);
    const { data } = await ctx.supabase
      .from("household_member_care_needs")
      .select("household_member_id, detail")
      .in("household_member_id", memberIds);

    expect(data).toEqual([]);
  });

  test("他人のユーザー ID を指定しても住所は取れない", async () => {
    const owner = await newRegisteredUser();
    const stranger = await newRegisteredUser();
    const { ctx } = await createCallerFor(stranger);

    // RLS は列を隠せないため、行ごと見せないことで home_mesh_code を守っている
    const { data } = await ctx.supabase
      .from("users")
      .select("id, area_id, home_mesh_code")
      .eq("id", owner.id);

    expect(data).toEqual([]);
  });

  test("household.get は自分の世帯だけを返す", async () => {
    const { user: owner } = await newUserWithFamily();
    const stranger = await newRegisteredUser();

    const { caller: ownerCaller } = await createCallerFor(owner);
    const ownerHousehold = await ownerCaller.household.get();

    const { caller } = await createCallerFor(stranger);
    const strangerHousehold = await caller.household.get();

    expect(strangerHousehold.household.id).not.toBe(
      ownerHousehold.household.id,
    );
    expect(strangerHousehold.members).toHaveLength(1);
  });
});

describe("他人の ID を指定した書き込み", () => {
  test("他人の構成員 ID を混ぜた世帯の更新は失敗する", async () => {
    const { householdId } = await newUserWithFamily();
    const stranger = await newRegisteredUser();

    const { data: victimMembers } = await serviceRole
      .from("household_members")
      .select("id")
      .eq("household_id", householdId);
    const victimMemberId = victimMembers?.[0]?.id;
    expect(victimMemberId).toBeTruthy();

    const { caller } = await createCallerFor(stranger);
    const own = await caller.household.get();
    const ownPrimary = own.members.find((member) => member.isPrimary);

    await expect(
      caller.household.update({
        areaId: SEED_AREA_IDS.mabiYata,
        homeMeshCode: "5133451124",
        carCount: 0,
        members: [
          {
            id: ownPrimary?.id,
            displayName: "テスト太郎",
            ageGroup: "adult",
            needsAssistance: false,
            careNeeds: [],
          },
          {
            // 他人の世帯の構成員を自分の世帯の更新に混ぜる
            id: victimMemberId,
            displayName: "乗っ取り",
            ageGroup: "adult",
            needsAssistance: false,
            careNeeds: [],
          },
        ],
        pets: [],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // 相手の構成員の名前が書き換わっていない
    const { data } = await serviceRole
      .from("household_members")
      .select("display_name")
      .eq("id", victimMemberId ?? "")
      .single();
    expect(data?.display_name).not.toBe("乗っ取り");
  });

  test("他人の世帯へ構成員を差し込むことはできない", async () => {
    const { householdId } = await newUserWithFamily();
    const stranger = await newRegisteredUser();
    const { ctx } = await createCallerFor(stranger);

    const { error } = await ctx.supabase.from("household_members").insert({
      household_id: householdId,
      display_name: "紛れ込んだ人",
      age_group: "adult",
    });

    expect(error?.code).toBe("42501");
  });

  test("他人の世帯の車の台数を書き換えることはできない", async () => {
    const { householdId } = await newUserWithFamily();
    const stranger = await newRegisteredUser();
    const { ctx } = await createCallerFor(stranger);

    await ctx.supabase
      .from("households")
      .update({ car_count: 99 })
      .eq("id", householdId);

    const { data } = await serviceRole
      .from("households")
      .select("car_count")
      .eq("id", householdId)
      .single();

    // RLS の USING に掛からないため、更新対象が 0 行になる
    expect(data?.car_count).toBe(1);
  });

  test("他人のプロフィールを書き換えることはできない", async () => {
    const owner = await newRegisteredUser();
    const stranger = await newRegisteredUser();
    const { ctx } = await createCallerFor(stranger);

    await ctx.supabase
      .from("users")
      .update({ display_name: "書き換えられた" })
      .eq("id", owner.id);

    const { data } = await serviceRole
      .from("users")
      .select("display_name")
      .eq("id", owner.id)
      .single();

    expect(data?.display_name).toBe("テスト太郎");
  });
});
