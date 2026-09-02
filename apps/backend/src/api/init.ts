import { createSupabaseRequestContext } from "@michinavi/db";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { supabaseConnection } from "../env.backend";

/**
 * リクエストごとに全 procedure へ渡される値。
 * Supabase クライアントはログインユーザーの JWT を引き継いだものを載せる。
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const { supabase, user } = await createSupabaseRequestContext(
    opts.headers,
    supabaseConnection,
  );

  return {
    headers: opts.headers,
    supabase,
    user,
  };
};

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

/** router を定義する */
export const createTRPCRouter = t.router;

/** 認証不要の procedure */
export const publicProcedure = t.procedure;

/**
 * 認証必須の procedure。
 * ユーザーは JWT からのみ解決し、入力の user_id は認可に使わない。
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "ログインが必要です",
    });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});

/**
 * 運営（モデレーター）だけが実行できる procedure（S4）。
 *
 * 権限は users の列ではなく JWT の app_metadata.app_role で決まる
 * （docs/er/07-safety-moderation.md#ポリシーの一覧）。app_metadata は
 * Supabase Auth の管理 API からしか書けないため、利用者自身が付け替えられない。
 *
 * DB 側にも同じ判定の RLS（public.is_moderator）がある。
 * ここは 2 枚目の防壁で、権限が無いことを 404 ではなく 403 として返し、
 * 「操作は存在するが権限が足りない」ことを呼び出し側に伝えるためにある。
 */
export const moderatorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.app_metadata?.app_role !== "moderator") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "この操作は運営のみが実行できます",
    });
  }

  return next({ ctx });
});
