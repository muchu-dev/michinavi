import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { toTRPCError } from "../errors";
import type { TRPCContext } from "../init";
import { createTRPCRouter, protectedProcedure } from "../init";

/**
 * 安否と家族共有（BE-22、機能 E4 / E5）。
 *
 * 安否の主体は世帯構成員（household_members）で、ユーザではない。
 * アカウントを持たない家族の安否も代理で登録できる必要があるためである。
 */

const statusSchema = z.enum([
  "unknown",
  "safe_home",
  "preparing",
  "evacuating",
  "at_shelter",
  "needs_help",
  "safe_other",
]);

const meshCodeSchema = z
  .string()
  .regex(/^\d{10}$/, "メッシュコードは 10 桁の数字で指定してください");

const setInputSchema = z.object({
  /**
   * 対象の構成員。省略すると自分自身。
   * アカウントを持たない同居家族の代理登録にだけ指定する
   */
  memberId: z.uuid().optional(),
  status: statusSchema,
  /** 状態と別に立てる。避難済みでも支援が要ることがある */
  needsHelp: z.boolean().default(false),
  message: z.string().trim().min(1).max(200).optional(),
  /** 現在地の共有を選んだときだけ渡す（S1） */
  meshCode: meshCodeSchema.optional(),
});

/** 呼び出し元の既定の世帯と、本人の構成員 ID */
async function resolveOwnMembership(
  supabase: TRPCContext["supabase"],
  userId: string,
) {
  const { data, error } = await supabase
    .from("household_members")
    .select("id, household_id")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .maybeSingle();

  if (error) {
    throw toTRPCError(error, "世帯の取得に失敗しました");
  }
  if (!data) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "世帯が見つかりません",
    });
  }

  return { memberId: data.id, householdId: data.household_id };
}

export const memberStatusRouter = createTRPCRouter({
  /**
   * 自分、または同居する家族の安否を登録する（BE-22）。
   *
   * 現在値を直接更新せず履歴を 1 行足す。現在値はトリガが反映する。
   * 「いま何なのか」と「なぜそうなったか」が食い違う状態を作らないためである。
   *
   * 代理で登録できるのはアカウントを持たない構成員だけで、その判定は
   * DB 側（can_update_member_status）が行う。
   */
  set: protectedProcedure
    .input(setInputSchema)
    .mutation(async ({ ctx, input }) => {
      const own = await resolveOwnMembership(ctx.supabase, ctx.user.id);
      const targetMemberId = input.memberId ?? own.memberId;
      const isProxy = targetMemberId !== own.memberId;

      const { data, error } = await ctx.supabase
        .from("member_status_events")
        .insert({
          household_member_id: targetMemberId,
          status: input.status,
          needs_help: input.needsHelp,
          message: input.message ?? null,
          mesh_code: input.meshCode ?? null,
          actor_user_id: ctx.user.id,
          source: isProxy ? "proxy" : "self",
        })
        .select("id, status, needs_help, occurred_at")
        .single();

      if (error) {
        throw toTRPCError(error, "安否の登録に失敗しました");
      }

      return {
        eventId: data.id,
        memberId: targetMemberId,
        status: data.status,
        needsHelp: data.needs_help,
        occurredAt: data.occurred_at,
        isProxy,
      };
    }),

  /**
   * 世帯の家族それぞれの安否を返す（BE-22、E4）。
   *
   * 共有範囲（E5）で見せない設定にしている家族は status を持たない形で返す。
   * 一覧から名前ごと消すと「誰がいないのか」が分からなくなるため、
   * 行は出したうえで状態を伏せる。
   */
  listForHousehold: protectedProcedure.query(async ({ ctx }) => {
    const own = await resolveOwnMembership(ctx.supabase, ctx.user.id);

    const { data: members, error: membersError } = await ctx.supabase
      .from("household_members")
      .select("id, display_name, age_group, user_id, is_primary")
      .eq("household_id", own.householdId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    if (membersError) {
      throw toTRPCError(membersError, "家族の取得に失敗しました");
    }

    const memberIds = (members ?? []).map((member) => member.id);

    // 見てよい行だけが返る（RLS の can_view_member_status）
    const { data: statuses, error: statusesError } =
      memberIds.length > 0
        ? await ctx.supabase
            .from("member_statuses")
            .select(
              "household_member_id, status, needs_help, message, status_updated_at",
            )
            .in("household_member_id", memberIds)
        : { data: [], error: null };

    if (statusesError) {
      throw toTRPCError(statusesError, "安否の取得に失敗しました");
    }

    return (members ?? []).map((member) => {
      const status = (statuses ?? []).find(
        (row) => row.household_member_id === member.id,
      );

      return {
        memberId: member.id,
        displayName: member.display_name,
        ageGroup: member.age_group,
        isSelf: member.id === own.memberId,
        hasAccount: member.user_id !== null,
        /** 共有されていない場合は null */
        status: status?.status ?? null,
        needsHelp: status?.needs_help ?? false,
        message: status?.message ?? null,
        statusUpdatedAt: status?.status_updated_at ?? null,
      };
    });
  }),

  /** 自分の安否の履歴（新しい順） */
  history: protectedProcedure
    .input(z.object({ limit: z.int().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const own = await resolveOwnMembership(ctx.supabase, ctx.user.id);

      const { data, error } = await ctx.supabase
        .from("member_status_events")
        .select("id, status, needs_help, message, source, occurred_at")
        .eq("household_member_id", own.memberId)
        .order("occurred_at", { ascending: false })
        .limit(input.limit);

      if (error) {
        throw toTRPCError(error, "安否の履歴の取得に失敗しました");
      }

      return data.map((row) => ({
        eventId: row.id,
        status: row.status,
        needsHelp: row.needs_help,
        message: row.message,
        source: row.source,
        occurredAt: row.occurred_at,
      }));
    }),

  /**
   * 自分の安否を誰に見せるかを変える（E5）。
   * `none` にすると、同じ世帯の家族からも見えなくなる。
   */
  setShareScope: protectedProcedure
    .input(z.object({ scope: z.enum(["household", "family", "none"]) }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("users")
        .update({ status_share_scope: input.scope })
        .eq("id", ctx.user.id)
        .select("status_share_scope")
        .single();

      if (error) {
        throw toTRPCError(error, "共有範囲の変更に失敗しました");
      }

      return { scope: data.status_share_scope };
    }),
});
