import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { toTRPCError } from "../errors";
import {
  createTRPCRouter,
  moderatorProcedure,
  protectedProcedure,
} from "../init";

/**
 * 通報（S4、BE-24）。
 *
 * 住民が地図に上げる情報は field_reports、不適切な内容の申告は content_flags と
 * 呼び分ける（docs/er/00-conventions.md#命名規則）。
 */

/** BE-24 で通報できるのは現地報告だけ。コミュニティ投稿は E1 の実装後に足す */
const targetTypeSchema = z.literal("field_report");

const reasonSchema = z.enum([
  "false_info",
  "privacy",
  "spam",
  "abuse",
  "other",
]);

const statusSchema = z.enum(["open", "reviewing", "actioned", "dismissed"]);

const createInputSchema = z.object({
  targetType: targetTypeSchema.default("field_report"),
  targetId: z.uuid(),
  reason: reasonSchema,
  /** 通報者の補足。運営だけが読む */
  detail: z.string().trim().min(1).max(200).optional(),
});

const listInputSchema = z.object({
  status: statusSchema.optional(),
  limit: z.int().min(1).max(100).default(50),
});

export const contentFlagRouter = createTRPCRouter({
  /**
   * 投稿を通報する（BE-24）。
   *
   * 通報者は JWT から解決するため、入力に reporter_user_id は持たない。
   * 同じ人が同じ対象を二度通報することはできない（UNIQUE 制約）。
   */
  create: protectedProcedure
    .input(createInputSchema)
    .mutation(async ({ ctx, input }) => {
      // 存在しない投稿や、すでに見えなくなっている投稿への通報は受けない。
      // content_flags.target_id には外部キーを張れない（対象が複数テーブルに
      // またがる）ため、この確認が参照整合性の代わりになる。
      // RLS が効くので、他人の非表示の投稿はここで見つからない
      const { data: target, error: targetError } = await ctx.supabase
        .from("field_reports")
        .select("id")
        .eq("id", input.targetId)
        .is("deleted_at", null)
        .maybeSingle();

      if (targetError) {
        throw toTRPCError(targetError, "通報の対象を確認できませんでした");
      }
      if (!target) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "通報の対象が見つかりません",
        });
      }

      const { data, error } = await ctx.supabase
        .from("content_flags")
        .insert({
          target_type: input.targetType,
          target_id: input.targetId,
          reporter_user_id: ctx.user.id,
          reason: input.reason,
          detail: input.detail ?? null,
        })
        .select("id, target_type, target_id, reason, status, created_at")
        .single();

      if (error) {
        throw toTRPCError(error, "通報の送信に失敗しました");
      }

      return {
        id: data.id,
        targetType: data.target_type,
        targetId: data.target_id,
        reason: data.reason,
        status: data.status,
        createdAt: data.created_at,
      };
    }),

  /**
   * 自分が通報した対象の一覧（BE-24）。
   * 画面が「通報済み」を出すために使う。理由や補足は返さない。
   */
  mine: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("content_flags")
      .select("target_type, target_id, status, created_at")
      .eq("reporter_user_id", ctx.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw toTRPCError(error, "通報の取得に失敗しました");
    }

    return data.map((row) => ({
      targetType: row.target_type,
      targetId: row.target_id,
      status: row.status,
      createdAt: row.created_at,
    }));
  }),

  /**
   * 通報の一覧（運営のみ）。既定では未処理のものから見る。
   * 通報者の user_id も返す。誰が通報したかは運営の判断材料になる
   */
  list: moderatorProcedure
    .input(listInputSchema)
    .query(async ({ ctx, input }) => {
      let query = ctx.supabase
        .from("content_flags")
        .select(
          "id, target_type, target_id, reporter_user_id, reason, detail, status, resolved_by, resolved_at, created_at",
        );

      if (input.status) {
        query = query.eq("status", input.status);
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(input.limit);

      if (error) {
        throw toTRPCError(error, "通報一覧の取得に失敗しました");
      }

      return data.map((row) => ({
        id: row.id,
        targetType: row.target_type,
        targetId: row.target_id,
        reporterUserId: row.reporter_user_id,
        reason: row.reason,
        detail: row.detail,
        status: row.status,
        resolvedBy: row.resolved_by,
        resolvedAt: row.resolved_at,
        createdAt: row.created_at,
      }));
    }),
});
