import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { createSupabaseRequestContext } from "@/lib/supabase/server";

/**
 * リクエストごとに全 procedure へ渡される値。
 * Supabase クライアントはログインユーザーの JWT を引き継いだものを載せる。
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const { supabase, user } = await createSupabaseRequestContext(opts.headers);

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
