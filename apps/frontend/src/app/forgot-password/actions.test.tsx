import { beforeEach, describe, expect, it, vi } from "vitest";

const { headers, resetPasswordForEmail } = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  headers: vi.fn(
    async () => new Headers({ origin: "https://michinavi.example" }),
  ),
}));

vi.mock("@/lib/supabase/server-action", () => ({
  createSupabaseServerActionClient: vi.fn(async () => ({
    auth: { resetPasswordForEmail },
  })),
}));

vi.mock("next/headers", () => ({ headers }));

vi.mock("@/env.frontend", () => ({ env: { SITE_URL: undefined } }));

import { requestPasswordReset } from "./actions";

beforeEach(() => {
  resetPasswordForEmail.mockReset();
  headers.mockClear();
});

describe("requestPasswordReset", () => {
  it("rejects a malformed address before calling Supabase", async () => {
    const formData = new FormData();
    formData.set("email", "invalid-email");

    const state = await requestPasswordReset({}, formData);

    expect(state.fieldErrors?.email).toEqual([
      "有効なメールアドレスを入力してください。",
    ]);
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("sends the recovery mail back through our own callback route", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    const formData = new FormData();
    formData.set("email", "resident@example.com");

    const state = await requestPasswordReset({}, formData);

    expect(resetPasswordForEmail).toHaveBeenCalledWith("resident@example.com", {
      redirectTo:
        "https://michinavi.example/auth/confirm?next=%2Freset-password",
    });
    expect(state.status).toBe("sent");
  });

  it("answers the same way for an unknown address", async () => {
    resetPasswordForEmail.mockResolvedValue({
      error: {
        code: "user_not_found",
        status: 400,
        message: "provider detail",
      },
    });
    const formData = new FormData();
    formData.set("email", "stranger@example.com");

    const state = await requestPasswordReset({}, formData);

    expect(state.status).toBe("sent");
    expect(state.message).not.toContain("provider detail");
  });

  it("tells the user to wait when the mail rate limit is hit", async () => {
    resetPasswordForEmail.mockResolvedValue({
      error: {
        code: "over_email_send_rate_limit",
        status: 429,
        message: "provider detail",
      },
    });
    const formData = new FormData();
    formData.set("email", "resident@example.com");

    const state = await requestPasswordReset({}, formData);

    expect(state.status).toBe("error");
    expect(state.message).toBe(
      "メールの送信が上限に達しました。しばらく時間をおいてからもう一度お試しください。",
    );
  });

  it("hides provider details when the auth service is unavailable", async () => {
    resetPasswordForEmail.mockRejectedValue(new Error("network detail"));
    const formData = new FormData();
    formData.set("email", "resident@example.com");

    const state = await requestPasswordReset({}, formData);

    expect(state.status).toBe("error");
    expect(state.message).toBe(
      "メールを送信できませんでした。時間をおいてもう一度お試しください。",
    );
    expect(state.message).not.toContain("network detail");
  });
});
