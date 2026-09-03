import { createTRPCRouter } from "./init";
import { areaRouter } from "./routers/area";
import { contentFlagRouter } from "./routers/content-flag";
import { fallbackRouter } from "./routers/fallback";
import { fieldReportRouter } from "./routers/field-report";
import { fieldReportPhotoRouter } from "./routers/field-report-photo";
import { healthRouter } from "./routers/health";
import { householdRouter } from "./routers/household";
import { memberStatusRouter } from "./routers/member-status";
import { moderationRouter } from "./routers/moderation";
import { reportDigestRouter } from "./routers/report-digest";
import { roadStatusRouter } from "./routers/road-status";
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
  fieldReportPhoto: fieldReportPhotoRouter,
  area: areaRouter,
  contentFlag: contentFlagRouter,
  fallback: fallbackRouter,
  memberStatus: memberStatusRouter,
  moderation: moderationRouter,
  reportDigest: reportDigestRouter,
  roadStatus: roadStatusRouter,
  shelter: shelterRouter,
  shelterAssignment: shelterAssignmentRouter,
});

export type AppRouter = typeof appRouter;
