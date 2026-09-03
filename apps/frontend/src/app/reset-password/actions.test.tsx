import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirect, updateUser } = vi.hoisted(() => ({
  updateUser: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/lib/supabase/server-action", () => ({
  createSupabaseServerActionClient: vi.fn(async () => ({
    auth: { updateUser },
  })),
}));

vi.mock("next/navigation", () => ({ redirect }));

import { updatePassword } from "./actions";

beforeEach(() => {
  updateUser.mockReset();
  redirect.mockClear();
});

function formOf(password: string, confirmation = password) {
  const formData = new FormData();
  formData.set("password", password);
  formData.set("passwordConfirmation", confirmation);
  return formData;
}

describe("updatePassword", () => {
  it("requires a long enough password before calling Supabase", async () => {
    const state = await updatePassword({}, formOf("short"));

    expect(state.fieldErrors?.password).toEqual([
      "パスワードは8文字以上で入力してください。",
    ]);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("requires both entries to match", async () => {
    const state = await updatePassword(
      {},
      formOf("new-secret-password", "other-secret-password"),
    );

    expect(state.fieldErrors?.passwordConfirmation).toEqual([
      "確認用のパスワードが一致しません。",
    ]);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("updates the password and sends the user into the app", async () => {
    updateUser.mockResolvedValue({ error: null });

    await expect(
      updatePassword({}, formOf("new-secret-password")),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(updateUser).toHaveBeenCalledWith({
      password: "new-secret-password",
    });
    expect(redirect).toHaveBeenCalledWith("/onboarding");
  });

  it("explains that the recovery link is no longer valid", async () => {
    updateUser.mockResolvedValue({
      error: {
        code: "session_not_found",
        status: 401,
        message: "provider detail",
      },
    });

    const state = await updatePassword({}, formOf("new-secret-password"));

    expect(state.message).toBe(
      "再設定用のリンクの有効期限が切れています。もう一度メールを送信してください。",
    );
    expect(state.message).not.toContain("provider detail");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("passes on the provider's weak password rejection in our own words", async () => {
    updateUser.mockResolvedValue({
      error: { code: "weak_password", status: 422, message: "provider detail" },
    });

    const state = await updatePassword({}, formOf("new-secret-password"));

    expect(state.fieldErrors?.password).toEqual([
      "推測されやすいパスワードです。別のパスワードを入力してください。",
    ]);
  });

  it("asks for a different password when the provider rejects a reuse", async () => {
    updateUser.mockResolvedValue({
      error: { code: "same_password", status: 422, message: "provider detail" },
    });

    const state = await updatePassword({}, formOf("new-secret-password"));

    expect(state.fieldErrors?.password).toEqual([
      "現在のパスワードと同じです。別のパスワードを入力してください。",
    ]);
  });

  it("treats a forbidden response as an expired recovery session", async () => {
    updateUser.mockResolvedValue({
      error: { code: null, status: 403, message: "provider detail" },
    });

    const state = await updatePassword({}, formOf("new-secret-password"));

    expect(state.message).toBe(
      "再設定用のリンクの有効期限が切れています。もう一度メールを送信してください。",
    );
  });

  it("hides provider details when the auth service is unavailable", async () => {
    updateUser.mockRejectedValue(new Error("network detail"));

    const state = await updatePassword({}, formOf("new-secret-password"));

    expect(state.message).toBe(
      "パスワードを変更できませんでした。時間をおいてもう一度お試しください。",
    );
    expect(state.message).not.toContain("network detail");
  });
});
