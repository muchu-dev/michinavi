import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TRPCContext } from "@/server/trpc/init";
import { toTRPCError } from "@/server/trpc/errors";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/init";

/** 自宅位置は 10 桁の 4 分の 1 地域メッシュ（約 250m）で受け取る（S1） */
const meshCodeSchema = z
  .string()
  .regex(/^\d{10}$/, "メッシュコードは 10 桁の数字で指定してください");

const ageGroupSchema = z.enum(["infant", "child", "adult", "senior"]);

/** care_needs マスタの初期値のキー（docs/er/01-account-household.md）。マスタを増やしたら合わせる */
const careNeedKeySchema = z.enum([
  "wheelchair",
  "walking_difficulty",
  "visual_impairment",
  "hearing_impairment",
  "medical_device",
  "chronic_illness",
  "pregnant",
  "infant_care",
  "dementia",
  "language_support",
]);

const petSpeciesSchema = z.enum([
  "dog",
  "cat",
  "small_animal",
  "bird",
  "reptile",
  "other",
]);
const petSizeSchema = z.enum(["small", "medium", "large"]);

const memberInputSchema = z.object({
  /** 省略すると新規の構成員（アカウント無し）として追加する */
  id: z.uuid().optional(),
  displayName: z.string().trim().min(1).max(50),
  ageGroup: ageGroupSchema,
  needsAssistance: z.boolean().default(false),
  careNeedKeys: z.array(careNeedKeySchema).max(10).default([]),
  careNeedDetail: z.string().trim().max(200).optional(),
});

const petInputSchema = z.object({
  species: petSpeciesSchema,
  size: petSizeSchema,
  count: z.int().min(1).max(50),
  isCrateTrained: z.boolean().default(false),
  note: z.string().trim().max(200).optional(),
});

const updateInputSchema = z.object({
  areaId: z.uuid(),
  homeMeshCode: meshCodeSchema,
  carCount: z.int().min(0).max(20),
  /** 入力どおりに全置換する。本人（is_primary）の行は自分の id を含めて渡す */
  members: z.array(memberInputSchema).min(1).max(20),
  /** 入力どおりに全置換する */
  pets: z.array(petInputSchema).max(20).default([]),
});

/**
 * 呼び出し元の既定の世帯の家族構成・ペット・車・住所を組み立てる。
 * 複数テーブルの単純な読み取りなので、書き込みと違って DB 関数にまとめない
 * （docs/er/00-conventions.md#トランザクションの境界は書き込みだけが対象）。
 */
async function fetchHouseholdSnapshot(
  supabase: TRPCContext["supabase"],
  householdId: string,
) {
  const [
    { data: household, error: householdError },
    { data: members, error: membersError },
    { data: pets, error: petsError },
  ] = await Promise.all([
    supabase
      .from("households")
      .select("id, area_id, home_mesh_code, car_count, has_car")
      .eq("id", householdId)
      .single(),
    supabase
      .from("household_members")
      .select(
        "id, display_name, age_group, needs_assistance, is_primary, user_id",
      )
      .eq("household_id", householdId),
    supabase
      .from("pets")
      .select("id, species, size, count, is_crate_trained, note")
      .eq("household_id", householdId),
  ]);

  if (householdError) {
    throw toTRPCError(householdError, "世帯の取得に失敗しました");
  }
  if (membersError) {
    throw toTRPCError(membersError, "構成員の取得に失敗しました");
  }
  if (petsError) {
    throw toTRPCError(petsError, "ペットの取得に失敗しました");
  }
  if (!household) {
    throw new TRPCError({ code: "NOT_FOUND", message: "世帯が見つかりません" });
  }

  const memberIds = (members ?? []).map((member) => member.id);

  const { data: careNeedLinks, error: careNeedLinksError } =
    memberIds.length > 0
      ? await supabase
          .from("household_member_care_needs")
          .select("household_member_id, care_need_id, detail")
          .in("household_member_id", memberIds)
      : { data: [], error: null };

  if (careNeedLinksError) {
    throw toTRPCError(careNeedLinksError, "要配慮の取得に失敗しました");
  }

  const careNeedIds = [
    ...new Set((careNeedLinks ?? []).map((link) => link.care_need_id)),
  ];

  const { data: careNeeds, error: careNeedsError } =
    careNeedIds.length > 0
      ? await supabase
          .from("care_needs")
          .select("id, key")
          .in("id", careNeedIds)
      : { data: [], error: null };

  if (careNeedsError) {
    throw toTRPCError(careNeedsError, "要配慮の取得に失敗しました");
  }

  const careNeedKeyById = new Map(
    (careNeeds ?? []).map((careNeed) => [careNeed.id, careNeed.key]),
  );

  return {
    household: {
      id: household.id,
      areaId: household.area_id,
      homeMeshCode: household.home_mesh_code,
      carCount: household.car_count,
      hasCar: household.has_car,
    },
    members: (members ?? []).map((member) => {
      const links = (careNeedLinks ?? []).filter(
        (link) => link.household_member_id === member.id,
      );

      return {
        id: member.id,
        userId: member.user_id,
        displayName: member.display_name,
        ageGroup: member.age_group,
        needsAssistance: member.needs_assistance,
        isPrimary: member.is_primary,
        careNeedKeys: links
          .map((link) => careNeedKeyById.get(link.care_need_id))
          .filter((key): key is string => key !== undefined),
        careNeedDetail: links.find((link) => link.detail)?.detail ?? null,
      };
    }),
    pets: (pets ?? []).map((pet) => ({
      id: pet.id,
      species: pet.species,
      size: pet.size,
      count: pet.count,
      isCrateTrained: pet.is_crate_trained,
      note: pet.note,
    })),
  };
}

export const householdRouter = createTRPCRouter({
  /** 自分の世帯の人数・年齢層・要配慮・ペット・車・住所を取得する（BE-09） */
  get: protectedProcedure.query(async ({ ctx }) => {
    const { data: member, error } = await ctx.supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", ctx.user.id)
      .eq("is_primary", true)
      .maybeSingle();

    if (error) {
      throw toTRPCError(error, "世帯の取得に失敗しました");
    }
    if (!member) {
      throw new TRPCError({ code: "NOT_FOUND", message: "世帯が見つかりません" });
    }

    return fetchHouseholdSnapshot(ctx.supabase, member.household_id);
  }),

  /**
   * 人数・年齢層・要配慮者・ペット・車の有無・住所をまとめて更新する（BE-09）。
   *
   * 対象の世帯は JWT から解決するため household_id は入力に持たない。
   * members と pets は入力どおりに全置換する。本人（is_primary）の構成員行だけは
   * 入力から漏れても削除されない。
   */
  update: protectedProcedure
    .input(updateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .rpc("update_household_account", {
          p_area_id: input.areaId,
          p_home_mesh_code: input.homeMeshCode,
          p_car_count: input.carCount,
          p_members: input.members.map((member) => ({
            id: member.id ?? null,
            displayName: member.displayName,
            ageGroup: member.ageGroup,
            needsAssistance: member.needsAssistance,
            careNeedKeys: member.careNeedKeys,
            careNeedDetail: member.careNeedDetail ?? null,
          })),
          p_pets: input.pets.map((pet) => ({
            species: pet.species,
            size: pet.size,
            count: pet.count,
            isCrateTrained: pet.isCrateTrained,
            note: pet.note ?? null,
          })),
        })
        .single();

      if (error) {
        throw toTRPCError(error, "世帯情報の更新に失敗しました");
      }
      if (!data) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "世帯情報の更新に失敗しました",
        });
      }

      return fetchHouseholdSnapshot(ctx.supabase, data.household_id);
    }),
});
