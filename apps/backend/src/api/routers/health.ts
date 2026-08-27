import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../init";

/**
 * tRPC の疎通確認用。実装が進んだら消してよい。
 */
export const healthRouter = createTRPCRouter({
  /** 入力なしの query */
  ping: publicProcedure.query(() => {
    return {
      ok: true,
      // superjson を通すので Date のまま届く
      serverTime: new Date(),
    };
  }),

  /** 入力ありの query */
  echo: publicProcedure
    .input(z.object({ message: z.string().min(1).max(100) }))
    .query(({ input }) => {
      return {
        echo: input.message,
        length: input.message.length,
      };
    }),

  /** mutation の疎通確認 */
  shout: publicProcedure
    .input(z.object({ message: z.string().min(1).max(100) }))
    .mutation(({ input }) => {
      return {
        shouted: `${input.message.toUpperCase()}!!`,
        at: new Date(),
      };
    }),
});
