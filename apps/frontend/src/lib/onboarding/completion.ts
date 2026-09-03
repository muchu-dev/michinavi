import { appRouter, createTRPCContext } from "@michinavi/backend";
import { TRPCError } from "@trpc/server";
import { headers } from "next/headers";
import { env } from "@/env.frontend";
import { isDevelopmentAuthBypassEnabled } from "@/lib/auth/development-bypass";

export async function hasCompletedOnboarding() {
  if (
    isDevelopmentAuthBypassEnabled({
      appEnv: env.APP_ENV,
      flag: env.DEV_AUTH_BYPASS,
      nodeEnv: process.env.NODE_ENV,
    })
  ) {
    return false;
  }

  const caller = appRouter.createCaller(
    await createTRPCContext({ headers: await headers() }),
  );

  try {
    await caller.household.get();
    return true;
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      return false;
    }

    throw error;
  }
}
