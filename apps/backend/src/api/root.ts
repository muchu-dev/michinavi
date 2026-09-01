import { createTRPCRouter } from "./init";
import { areaRouter } from "./routers/area";
import { fieldReportRouter } from "./routers/field-report";
import { healthRouter } from "./routers/health";
import { householdRouter } from "./routers/household";
import { shelterRouter } from "./routers/shelter";
import { shelterAssignmentRouter } from "./routers/shelter-assignment";
import { userRouter } from "./routers/user";

/**
 * アプリ全体の router。
 * 機能ごとに `routers/` へファイルを分けてここに繋ぐ。
 */
export const appRouter = createTRPCRouter({
  health: healthRouter,
  user: userRouter,
  household: householdRouter,
  fieldReport: fieldReportRouter,
  area: areaRouter,
  shelter: shelterRouter,
  shelterAssignment: shelterAssignmentRouter,
});

export type AppRouter = typeof appRouter;
