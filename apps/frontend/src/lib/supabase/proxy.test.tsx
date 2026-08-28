import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type CookieAdapter = {
  getAll: () => { name: string; value: string }[];
  setAll: (
    cookies: {
      name: string;
      value: string;
      options: { path?: string };
    }[],
    headers: Record<string, string>,
  ) => void;
};

const testState = vi.hoisted(() => ({
  cookieAdapter: undefined as CookieAdapter | undefined,
  env: {
    APP_ENV: "local",
    DEV_AUTH_BYPASS: undefined as string | undefined,
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  },
  getClaims: vi.fn(),
}));

vi.mock("@/env.frontend", () => ({
  env: testState.env,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(
    (_url: string, _key: string, options: { cookies: CookieAdapter }) => {
      testState.cookieAdapter = options.cookies;
      return { auth: { getClaims: testState.getClaims } };
    },
  ),
}));

import { updateSession } from "./proxy";

beforeEach(() => {
  testState.cookieAdapter = undefined;
  testState.env.APP_ENV = "local";
  testState.env.DEV_AUTH_BYPASS = undefined;
  testState.getClaims.mockReset();
  vi.stubEnv("NODE_ENV", "test");
});

describe("updateSession", () => {
  it("bypasses authentication only when explicitly enabled in local development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    testState.env.DEV_AUTH_BYPASS = "true";

    const response = await updateSession(new NextRequest("http://localhost/"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-michinavi-auth-bypass")).toBe(
      "development-only",
    );
    expect(testState.getClaims).not.toHaveBeenCalled();
  });

  it.each([
    { appEnv: "preview", nodeEnv: "development" },
    { appEnv: "local", nodeEnv: "production" },
  ])("does not bypass authentication in $appEnv/$nodeEnv", async ({
    appEnv,
    nodeEnv,
  }) => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    testState.env.APP_ENV = appEnv;
    testState.env.DEV_AUTH_BYPASS = "true";
    testState.getClaims.mockResolvedValue({ data: { claims: null } });

    const response = await updateSession(new NextRequest("http://localhost/"));

    expect(response.status).toBe(307);
    expect(response.headers.get("x-michinavi-auth-bypass")).toBeNull();
    expect(testState.getClaims).toHaveBeenCalledOnce();
  });

  it("redirects an anonymous application request to login", async () => {
    testState.getClaims.mockResolvedValue({ data: { claims: null } });

    const response = await updateSession(
      new NextRequest("http://localhost/family"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("keeps the login route public", async () => {
    testState.getClaims.mockResolvedValue({ data: { claims: null } });

    const response = await updateSession(
      new NextRequest("http://localhost/login"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows an authenticated application request", async () => {
    testState.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-id" } },
    });

    const response = await updateSession(new NextRequest("http://localhost/"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("writes refreshed cookies and cache headers to the response", async () => {
    testState.getClaims.mockImplementation(async () => {
      expect(testState.cookieAdapter?.getAll()).toEqual([]);
      testState.cookieAdapter?.setAll(
        [
          {
            name: "sb-auth-token",
            value: "refreshed-token",
            options: { path: "/" },
          },
        ],
        { "cache-control": "private, no-store" },
      );
      return { data: { claims: { sub: "user-id" } } };
    });

    const response = await updateSession(new NextRequest("http://localhost/"));

    expect(response.cookies.get("sb-auth-token")?.value).toBe(
      "refreshed-token",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
