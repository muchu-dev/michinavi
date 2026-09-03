import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirect, signInWithPassword } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/lib/supabase/server-action", () => ({
  createSupabaseServerActionClient: vi.fn(async () => ({
    auth: { signInWithPassword },
  })),
}));

vi.mock("next/navigation", () => ({ redirect }));

import { login } from "./actions";

beforeEach(() => {
  signInWithPassword.mockReset();
  redirect.mockClear();
});

describe("login", () => {
  it("rejects missing credentials before calling Supabase", async () => {
    const state = await login({}, new FormData());

    expect(state.fieldErrors).toEqual({
      email: ["メールアドレスを入力してください。"],
      password: ["パスワードを入力してください。"],
    });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("rejects a malformed email before calling Supabase", async () => {
    const formData = new FormData();
    formData.set("email", "invalid-email");
    formData.set("password", "secret-password");

    const state = await login({}, formData);

    expect(state.fieldErrors?.email).toEqual([
      "有効なメールアドレスを入力してください。",
    ]);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("returns a generic message when Supabase rejects the credentials", async () => {
    signInWithPassword.mockResolvedValue({
      error: { code: "invalid_credentials", message: "provider detail" },
    });
    const formData = new FormData();
    formData.set("email", "resident@example.com");
    formData.set("password", "secret-password");

    const state = await login({}, formData);

    expect(state.message).toBe(
      "メールアドレスまたはパスワードが正しくありません。",
    );
    expect(state.message).not.toContain("provider detail");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("returns a generic retry message when the auth service is unavailable", async () => {
    signInWithPassword.mockRejectedValue(new Error("network detail"));
    const formData = new FormData();
    formData.set("email", "resident@example.com");
    formData.set("password", "secret-password");

    const state = await login({}, formData);

    expect(state.message).toBe(
      "ログインできませんでした。時間をおいてもう一度お試しください。",
    );
    expect(state.message).not.toContain("network detail");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("tells the user to wait when the auth provider rate limits the attempt", async () => {
    signInWithPassword.mockResolvedValue({
      error: {
        code: "over_request_rate_limit",
        status: 429,
        message: "provider detail",
      },
    });
    const formData = new FormData();
    formData.set("email", "resident@example.com");
    formData.set("password", "secret-password");

    const state = await login({}, formData);

    expect(state.message).toBe(
      "試行の回数が上限に達しました。しばらく時間をおいてからもう一度お試しください。",
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it("points at the confirmation mail when the address is not confirmed", async () => {
    signInWithPassword.mockResolvedValue({
      error: {
        code: "email_not_confirmed",
        status: 400,
        message: "provider detail",
      },
    });
    const formData = new FormData();
    formData.set("email", "resident@example.com");
    formData.set("password", "secret-password");

    const state = await login({}, formData);

    expect(state.message).toBe(
      "メールアドレスの確認が済んでいません。届いている確認メールをご確認ください。",
    );
  });

  it("signs in and redirects to onboarding", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    const formData = new FormData();
    formData.set("email", "resident@example.com");
    formData.set("password", "secret-password");

    await expect(login({}, formData)).rejects.toThrow("NEXT_REDIRECT");

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "resident@example.com",
      password: "secret-password",
    });
    expect(redirect).toHaveBeenCalledWith("/onboarding");
  });

  it("returns to the page the user was sent to login from", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    const formData = new FormData();
    formData.set("email", "resident@example.com");
    formData.set("password", "secret-password");
    formData.set("next", "/family/settings");

    await expect(login({}, formData)).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/family/settings");
  });

  it("ignores a destination that points off-site", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    const formData = new FormData();
    formData.set("email", "resident@example.com");
    formData.set("password", "secret-password");
    formData.set("next", "https://evil.example/steal");

    await expect(login({}, formData)).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/onboarding");
  });

  it("keeps the destination when the credentials are rejected", async () => {
    signInWithPassword.mockResolvedValue({
      error: { code: "invalid_credentials", message: "provider detail" },
    });
    const formData = new FormData();
    formData.set("email", "resident@example.com");
    formData.set("password", "secret-password");
    formData.set("next", "/family/settings");

    const state = await login({}, formData);

    expect(state.values).toEqual({
      email: "resident@example.com",
      next: "/family/settings",
    });
  });
});
