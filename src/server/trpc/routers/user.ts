import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { toTRPCError } from "@/server/trpc/errors";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/init";

/** 自宅位置は 10 桁の 4 分の 1 地域メッシュ（約 250m）で受け取る（S1） */
const meshCodeSchema = z
  .string()
  .regex(/^\d{10}$/, "メッシュコードは 10 桁の数字で指定してください");

const setupInputSchema = z.object({
  /** 実名は求めない */
  displayName: z.string().trim().min(1).max(50),
  areaId: z.uuid(),
  homeMeshCode: meshCodeSchema,
  /** 省略時は表示名を世帯の呼び名にする */
  householdName: z.string().trim().min(1).max(50).optional(),
  ageGroup: z.enum(["infant", "child", "adult", "senior"]).default("adult"),
  carCount: z.int().min(0).max(20).default(0),
});

export const userRouter = createTRPCRouter({
  /**
   * 認証後の初期登録。アプリ内のプロフィールと本人 1 人の世帯を作る。
   * Supabase Auth のアカウント自体を作る処理ではない。
   *
   * 対象のユーザーは JWT から解決するため、userId と ownerUserId は入力に持たない。
   * 同じユーザーが再実行しても、世帯と構成員は増えない。
   */
  setup: protectedProcedure
    .input(setupInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .rpc("setup_user_account", {
          p_display_name: input.displayName,
          p_area_id: input.areaId,
          p_home_mesh_code: input.homeMeshCode,
          p_household_name: input.householdName,
          p_age_group: input.ageGroup,
          p_car_count: input.carCount,
        })
        .single();

      if (error) {
        throw toTRPCError(error, "初期登録に失敗しました");
      }

      if (!data) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "初期登録に失敗しました",
        });
      }

      return {
        user: {
          id: data.user_id,
          displayName: data.display_name,
          areaId: data.area_id,
          homeMeshCode: data.home_mesh_code,
        },
        household: {
          id: data.household_id,
          name: data.household_name,
          carCount: data.car_count,
          hasCar: data.has_car,
        },
        householdMemberId: data.household_member_id,
        /** 今回の呼び出しで世帯を作ったか。再実行では false になる */
        isCreated: data.is_created,
      };
    }),
});
