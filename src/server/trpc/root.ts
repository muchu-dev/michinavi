import { createTRPCRouter } from "@/server/trpc/init";
import { healthRouter } from "@/server/trpc/routers/health";
import { userRouter } from "@/server/trpc/routers/user";

/**
 * アプリ全体の router。
 * 機能ごとに `routers/` へファイルを分けてここに繋ぐ。
 */
export const appRouter = createTRPCRouter({
  health: healthRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
