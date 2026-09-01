import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  appRouter: { createCaller: vi.fn() },
  createTRPCContext: vi.fn(),
  env: {
    APP_ENV: "local",
    DEV_AUTH_BYPASS: "false",
  },
  getHousehold: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@michinavi/backend", () => ({
  appRouter: testState.appRouter,
  createTRPCContext: testState.createTRPCContext,
}));

vi.mock("@/env.frontend", () => ({ env: testState.env }));
vi.mock("next/headers", () => ({ headers: testState.headers }));

import { hasCompletedOnboarding } from "./completion";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  testState.env.APP_ENV = "local";
  testState.env.DEV_AUTH_BYPASS = "false";
  testState.getHousehold.mockReset();
  testState.createTRPCContext.mockReset();
  testState.appRouter.createCaller.mockReset();
  testState.headers.mockReset();

  const requestHeaders = new Headers({ cookie: "session=test" });
  const context = { user: { id: "user-id" } };
  testState.headers.mockResolvedValue(requestHeaders);
  testState.createTRPCContext.mockResolvedValue(context);
  testState.appRouter.createCaller.mockReturnValue({
    household: { get: testState.getHousehold },
  });
});

describe("hasCompletedOnboarding", () => {
  it("returns true when the authenticated user already has a household", async () => {
    testState.getHousehold.mockResolvedValue({ id: "household-id" });

    await expect(hasCompletedOnboarding()).resolves.toBe(true);

    const requestHeaders = await testState.headers.mock.results[0]?.value;
    expect(testState.createTRPCContext).toHaveBeenCalledWith({
      headers: requestHeaders,
    });
    expect(testState.getHousehold).toHaveBeenCalledOnce();
  });

  it("returns false when the authenticated user has no household", async () => {
    testState.getHousehold.mockRejectedValue(
      new TRPCError({ code: "NOT_FOUND" }),
    );

    await expect(hasCompletedOnboarding()).resolves.toBe(false);
  });

  it("does not hide failures other than a missing household", async () => {
    const error = new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    testState.getHousehold.mockRejectedValue(error);

    await expect(hasCompletedOnboarding()).rejects.toBe(error);
  });

  it("keeps the Supabase-free development preview available", async () => {
    vi.stubEnv("NODE_ENV", "development");
    testState.env.DEV_AUTH_BYPASS = "true";

    await expect(hasCompletedOnboarding()).resolves.toBe(false);

    expect(testState.headers).not.toHaveBeenCalled();
    expect(testState.createTRPCContext).not.toHaveBeenCalled();
    expect(testState.getHousehold).not.toHaveBeenCalled();
  });
});
