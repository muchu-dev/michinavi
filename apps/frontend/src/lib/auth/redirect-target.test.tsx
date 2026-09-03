import { describe, expect, it } from "vitest";
import { DEFAULT_SIGNED_IN_PATH, resolveRedirectPath } from "./redirect-target";

describe("resolveRedirectPath", () => {
  it("keeps a same-origin path with its query string", () => {
    expect(resolveRedirectPath("/family/settings?tab=share")).toBe(
      "/family/settings?tab=share",
    );
  });

  it("falls back when nothing was requested", () => {
    expect(resolveRedirectPath(null)).toBe(DEFAULT_SIGNED_IN_PATH);
    expect(resolveRedirectPath("")).toBe(DEFAULT_SIGNED_IN_PATH);
    expect(resolveRedirectPath(undefined)).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  it.each([
    "https://evil.example/steal",
    "//evil.example/steal",
    "/\\evil.example/steal",
    "javascript:alert(1)",
    "family",
  ])("refuses %s so the form cannot send a user off-site", (value) => {
    expect(resolveRedirectPath(value)).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  it("refuses a control character that could split a header", () => {
    expect(resolveRedirectPath("/family\nSet-Cookie: a=b")).toBe(
      DEFAULT_SIGNED_IN_PATH,
    );
  });

  it.each([
    "/login",
    "/login?next=/family",
    "/forgot-password",
    "/auth/confirm",
  ])("refuses %s so signing in does not loop back to an auth screen", (value) => {
    expect(resolveRedirectPath(value)).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  it("uses the given fallback instead of the default one", () => {
    expect(resolveRedirectPath("/login", "/reset-password")).toBe(
      "/reset-password",
    );
  });

  it("accepts an array only when the browser sent a single value", () => {
    expect(resolveRedirectPath(["/family"])).toBe(DEFAULT_SIGNED_IN_PATH);
  });
});
