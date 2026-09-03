import { describe, expect, it } from "vitest";
import { resolveSiteOrigin } from "./site-url";

function headers(values: Record<string, string>) {
  return new Headers(values);
}

describe("resolveSiteOrigin", () => {
  it("prefers the configured origin over anything the request claims", () => {
    const origin = resolveSiteOrigin(
      headers({ origin: "https://attacker.example" }),
      "https://michinavi.example/",
    );

    expect(origin).toBe("https://michinavi.example");
  });

  it("falls back to the request origin so preview deployments work unconfigured", () => {
    expect(
      resolveSiteOrigin(headers({ origin: "https://preview.vercel.app" })),
    ).toBe("https://preview.vercel.app");
  });

  it("rebuilds the origin from forwarded headers behind a proxy", () => {
    expect(
      resolveSiteOrigin(
        headers({
          "x-forwarded-host": "michinavi.example",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe("https://michinavi.example");
  });

  it("uses the host header on local development", () => {
    expect(resolveSiteOrigin(headers({ host: "127.0.0.1:3000" }))).toBe(
      "http://127.0.0.1:3000",
    );
  });

  it("rejects a configured value that is not an absolute http(s) origin", () => {
    expect(() =>
      resolveSiteOrigin(headers({}), "javascript:alert(1)"),
    ).toThrowError();
  });

  it("throws when the request carries no usable host", () => {
    expect(() => resolveSiteOrigin(headers({}))).toThrowError();
  });
});
