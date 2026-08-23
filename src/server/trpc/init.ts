import { initTRPC } from "@trpc/server";
import superjson from "superjson";

/**
 * リクエストごとに全 procedure へ渡される値。
 * Supabase クライアントやログインユーザーはここに足していく。
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  return {
    headers: opts.headers,
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
