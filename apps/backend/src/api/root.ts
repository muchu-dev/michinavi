import { createTRPCRouter } from "./init";
import { healthRouter } from "./routers/health";
import { householdRouter } from "./routers/household";
import { userRouter } from "./routers/user";

/**
 * アプリ全体の router。
 * 機能ごとに `routers/` へファイルを分けてここに繋ぐ。
 */
export const appRouter = createTRPCRouter({
  health: healthRouter,
  user: userRouter,
  household: householdRouter,
});

export type AppRouter = typeof appRouter;
