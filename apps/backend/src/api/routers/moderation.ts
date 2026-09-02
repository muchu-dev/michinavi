import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { toTRPCError } from "../errors";
import type { TRPCContext } from "../init";
import { createTRPCRouter, moderatorProcedure } from "../init";

/**
 * 運営の措置（S4、BE-24）。
 *
 * 対象の状態を直接書き換える API にはしない。措置の行を追記し、その結果として
 * トリガ（apply_moderation_action）が field_reports.status と content_flags.status を
 * 更新する。状態を持つ列だけを見て「なぜ非表示になったか」が分からない状態を避ける
 * （docs/er/07-safety-moderation.md#moderation_actions措置）。
 */

const targetTypeSchema = z.literal("field_report");

const actionInputSchema = z.object({
  targetType: targetTypeSchema.default("field_report"),
  targetId: z.uuid(),
  /** なぜその措置を取ったか。後から見直せるよう必須にする */
  reason: z.string().trim().min(1).max(200),
  /** 元になった通報。自発的な措置なら省略する */
  contentFlagId: z.uuid().optional(),
});

type ActionInput = z.infer<typeof actionInputSchema>;
type ModerationActionKind = "hide" | "restore" | "delete";

/**
 * 措置を 1 行記録する。対象の状態はトリガが更新するので、ここでは書き換えない。
 *
 * 対象が存在しない場合はトリガが P0002 を投げ、NOT_FOUND として返る。
 * moderator_user_id は JWT から入れる。入力任せにすると、他の運営者の名前で
 * 措置を残せてしまう（RLS 側でも同じ条件を課している）。
 */
async function applyAction(
  ctx: TRPCContext & { user: NonNullable<TRPCContext["user"]> },
  input: ActionInput,
  action: ModerationActionKind,
  fallbackMessage: string,
) {
  const { data, error } = await ctx.supabase
    .from("moderation_actions")
    .insert({
      content_flag_id: input.contentFlagId ?? null,
      moderator_user_id: ctx.user.id,
      target_type: input.targetType,
      target_id: input.targetId,
      action,
      reason: input.reason,
    })
    .select("id, action, created_at")
    .single();

  if (error) {
    throw toTRPCError(error, fallbackMessage);
  }

  // 措置の結果を読み直して返す。トリガが更新した後の状態を呼び出し側へ渡す
  const { data: target, error: targetError } = await ctx.supabase
    .from("field_reports")
    .select("id, status, deleted_at")
    .eq("id", input.targetId)
    .maybeSingle();

  if (targetError) {
    throw toTRPCError(targetError, fallbackMessage);
  }
  if (!target) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "対象の投稿が見つかりません",
    });
  }

  return {
    actionId: data.id,
    action: data.action,
    targetId: target.id,
    status: target.status,
    isDeleted: target.deleted_at !== null,
    createdAt: data.created_at,
  };
}

export const moderationRouter = createTRPCRouter({
  /**
   * 投稿を非表示にする（BE-24）。
   *
   * 行を消さないのは、通報された内容を後から確認する必要があるためである
   * （docs/er/00-conventions.md#共通カラム）。利用者の一覧と地図からは消える。
   */
  hide: moderatorProcedure
    .input(actionInputSchema)
    .mutation(async ({ ctx, input }) => {
      return applyAction(ctx, input, "hide", "投稿を非表示にできませんでした");
    }),

  /**
   * 非表示にした投稿を戻す（BE-24）。
   * 誤って非表示にしたことも記録として残す。
   */
  restore: moderatorProcedure
    .input(actionInputSchema)
    .mutation(async ({ ctx, input }) => {
      return applyAction(ctx, input, "restore", "投稿を戻せませんでした");
    }),

  /**
   * 投稿を削除する（BE-24）。
   *
   * 物理削除はしない。deleted_at を入れて論理削除にし、非表示と同じく
   * 行そのものは残す。通報履歴と突き合わせられなくなるのを避けるためである。
   */
  remove: moderatorProcedure
    .input(actionInputSchema)
    .mutation(async ({ ctx, input }) => {
      return applyAction(ctx, input, "delete", "投稿を削除できませんでした");
    }),

  /** 対象に対して取られた措置の履歴（運営のみ） */
  history: moderatorProcedure
    .input(
      z.object({
        targetType: targetTypeSchema.default("field_report"),
        targetId: z.uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("moderation_actions")
        .select(
          "id, action, reason, moderator_user_id, content_flag_id, created_at",
        )
        .eq("target_type", input.targetType)
        .eq("target_id", input.targetId)
        .order("created_at", { ascending: false });

      if (error) {
        throw toTRPCError(error, "措置の履歴を取得できませんでした");
      }

      return data.map((row) => ({
        id: row.id,
        action: row.action,
        reason: row.reason,
        moderatorUserId: row.moderator_user_id,
        contentFlagId: row.content_flag_id,
        createdAt: row.created_at,
      }));
    }),
});
