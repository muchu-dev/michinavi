import { createTRPCRouter } from "@/server/trpc/init";
import { healthRouter } from "@/server/trpc/routers/health";

/**
 * アプリ全体の router。
 * 機能ごとに `routers/` へファイルを分けてここに繋ぐ。
 */
export const appRouter = createTRPCRouter({
  health: healthRouter,
});

export type AppRouter = typeof appRouter;
