import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { toTRPCError } from "../errors";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../init";
import { refreshRoadStatusEstimate } from "./road-status";

/**
 * 投稿位置は 10 桁の 4 分の 1 地域メッシュ（約 250m）で受け取る（S1）。
 * GPS からメッシュへの変換をサーバ側で行う処理はまだ無く、クライアントが
 * 丸めた値をそのまま送る前提に立つ（BE-12 でサーバ側変換に置き換える）。
 */
const meshCodeSchema = z
  .string()
  .regex(/^\d{10}$/, "メッシュコードは 10 桁の数字で指定してください");

const createInputSchema = z.object({
  meshCode: meshCodeSchema,
  /** 通れる／注意／通れない（C3） */
  roadCondition: z.enum(["passable", "caution", "impassable"]),
});

const listInputSchema = z.object({
  limit: z.int().min(1).max(100).default(50),
});

export const fieldReportRouter = createTRPCRouter({
  /**
   * 通行可否の投稿を保存する（BE-11）。
   * report_type は 'road' に固定する。hazard / shop / other は別タスクで扱う。
   *
   * 対象のユーザーは JWT から解決するため、user_id は入力に持たない。
   */
  create: protectedProcedure
    .input(createInputSchema)
    .mutation(async ({ ctx, input }) => {
      // 直接 INSERT せず DB 関数を通すのは、レート制限の加算と投稿の保存を
      // 同じトランザクションで行うためである（BE-23）。上限を超えると
      // 例外で巻き戻り、加算も投稿もどちらも残らない
      const { data, error } = await ctx.supabase
        .rpc("create_field_report", {
          p_mesh_code: input.meshCode,
          p_road_condition: input.roadCondition,
        })
        .single();

      if (error) {
        throw toTRPCError(error, "投稿の保存に失敗しました");
      }
      if (!data) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "投稿の保存に失敗しました",
        });
      }

      try {
        // AI推定の失敗が投稿の成否に影響しないよう、ここで吸収する（BE-16）
        await refreshRoadStatusEstimate(ctx.supabase, input.meshCode);
      } catch {
        // road_status_estimates の更新に失敗しても投稿自体は成功させる
      }

      return {
        id: data.id,
        meshCode: data.mesh_code,
        roadCondition: data.road_condition,
        createdAt: data.created_at,
      };
    }),

  /**
   * 通行可否の投稿を新しい順に返す（BE-11）。
   *
   * 運営が非表示にした投稿を落とす条件はここに書かず、RLS に任せる（BE-24）。
   * 条件を router 側にも書くと、「自分の投稿は状態にかかわらず見える」という
   * 例外まで二重に持つことになり、片方だけ直す事故が起きる。
   * 本人が自分の非表示の投稿を見たときに分かるよう、status を返す
   */
  list: publicProcedure.input(listInputSchema).query(async ({ ctx, input }) => {
    const { data, error } = await ctx.supabase
      .from("field_reports")
      .select("id, mesh_code, road_condition, status, created_at")
      .eq("report_type", "road")
      .order("created_at", { ascending: false })
      .limit(input.limit);

    if (error) {
      throw toTRPCError(error, "投稿一覧の取得に失敗しました");
    }

    return data.map((row) => ({
      id: row.id,
      meshCode: row.mesh_code,
      roadCondition: row.road_condition,
      status: row.status,
      createdAt: row.created_at,
    }));
  }),
});
