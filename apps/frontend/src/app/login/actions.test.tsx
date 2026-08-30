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
});
