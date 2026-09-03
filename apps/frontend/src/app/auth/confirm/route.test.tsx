import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { exchangeCodeForSession, verifyOtp } = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server-action", () => ({
  createSupabaseServerActionClient: vi.fn(async () => ({
    auth: { verifyOtp, exchangeCodeForSession },
  })),
}));

import { GET } from "./route";

beforeEach(() => {
  verifyOtp.mockReset();
  exchangeCodeForSession.mockReset();
});

describe("GET /auth/confirm", () => {
  it("verifies a recovery token and opens the reset screen", async () => {
    verifyOtp.mockResolvedValue({ error: null });

    const response = await GET(
      new NextRequest(
        "http://localhost/auth/confirm?token_hash=hash-value&type=recovery",
      ),
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      type: "recovery",
      token_hash: "hash-value",
    });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/reset-password",
    );
  });

  it("exchanges a PKCE code when the mail template sends one", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(
      new NextRequest("http://localhost/auth/confirm?code=auth-code"),
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("auth-code");
    expect(response.headers.get("location")).toBe(
      "http://localhost/reset-password",
    );
  });

  it("refuses a destination that points off-site", async () => {
    verifyOtp.mockResolvedValue({ error: null });

    const response = await GET(
      new NextRequest(
        "http://localhost/auth/confirm?token_hash=hash-value&type=recovery&next=https%3A%2F%2Fevil.example",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost/reset-password",
    );
  });

  it("sends an expired link back to the request screen", async () => {
    verifyOtp.mockResolvedValue({
      error: { code: "otp_expired", status: 403, message: "provider detail" },
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/auth/confirm?token_hash=hash-value&type=recovery",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/forgot-password?error=link_expired",
    );
  });

  it("refuses a confirmation type outside password recovery", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/auth/confirm?token_hash=hash-value&type=email_change",
      ),
    );

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "http://localhost/forgot-password?error=link_expired",
    );
  });

  it("refuses a request that carries no credential at all", async () => {
    const response = await GET(
      new NextRequest("http://localhost/auth/confirm"),
    );

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "http://localhost/forgot-password?error=link_expired",
    );
  });
});
