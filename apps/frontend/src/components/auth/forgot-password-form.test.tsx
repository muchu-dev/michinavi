import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/forgot-password/actions", () => ({
  initialPasswordResetRequestState: {},
  requestPasswordReset: vi.fn(),
}));

import { ForgotPasswordForm } from "./forgot-password-form";

afterEach(cleanup);

describe("ForgotPasswordForm", () => {
  it("asks only for the address and links back to login", () => {
    render(<ForgotPasswordForm action={vi.fn()} />);

    const email = screen.getByRole("textbox", { name: "メールアドレス" });

    expect(email.getAttribute("type")).toBe("email");
    expect(email.getAttribute("autocomplete")).toBe("email");
    expect(
      screen.getByRole("button", { name: "再設定メールを送る" }),
    ).toBeDefined();
    expect(
      screen
        .getByRole("link", { name: "ログイン画面へ戻る" })
        .getAttribute("href"),
    ).toBe("/login");
  });

  it("associates a validation error with the address field", async () => {
    const action = vi.fn(async () => ({
      fieldErrors: { email: ["有効なメールアドレスを入力してください。"] },
    }));

    render(<ForgotPasswordForm action={action} />);
    fireEvent.submit(screen.getByRole("form", { name: "パスワードの再設定" }));

    expect(
      await screen.findByText("有効なメールアドレスを入力してください。"),
    ).toBeDefined();
    expect(
      screen.getByLabelText("メールアドレス").getAttribute("aria-invalid"),
    ).toBe("true");
  });

  it("confirms the send without revealing whether the address exists", async () => {
    const action = vi.fn(async () => ({
      status: "sent" as const,
      message:
        "入力されたメールアドレス宛に再設定用のリンクを送りました。メールをご確認ください。",
    }));

    render(<ForgotPasswordForm action={action} />);
    fireEvent.submit(screen.getByRole("form", { name: "パスワードの再設定" }));

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("再設定用のリンクを送りました");
    expect(
      screen.queryByRole("textbox", { name: "メールアドレス" }),
    ).toBeNull();
  });

  it("shows a stale link notice handed over from the callback route", () => {
    render(<ForgotPasswordForm action={vi.fn()} linkExpired />);

    expect(screen.getByRole("alert").textContent).toContain(
      "有効期限が切れています",
    );
  });
});
