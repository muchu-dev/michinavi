import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/reset-password/actions", () => ({
  updatePassword: vi.fn(),
}));

import { ResetPasswordForm } from "./reset-password-form";

afterEach(cleanup);

describe("ResetPasswordForm", () => {
  it("asks for the new password twice with new-password hints", () => {
    render(<ResetPasswordForm action={vi.fn()} />);

    const password = screen.getByLabelText("新しいパスワード");
    const confirmation = screen.getByLabelText("新しいパスワード（確認）");

    expect(password.getAttribute("type")).toBe("password");
    expect(password.getAttribute("autocomplete")).toBe("new-password");
    expect(confirmation.getAttribute("autocomplete")).toBe("new-password");
    expect(
      screen.getByRole("button", { name: "パスワードを変更する" }),
    ).toBeDefined();
  });

  it("associates server validation errors with their inputs", async () => {
    const action = vi.fn(async () => ({
      fieldErrors: {
        password: ["パスワードは8文字以上で入力してください。"],
        passwordConfirmation: ["確認用のパスワードが一致しません。"],
      },
    }));

    render(<ResetPasswordForm action={action} />);
    fireEvent.submit(screen.getByRole("form", { name: "パスワードの再設定" }));

    expect(
      await screen.findByText("パスワードは8文字以上で入力してください。"),
    ).toBeDefined();
    expect(
      screen.getByLabelText("新しいパスワード").getAttribute("aria-invalid"),
    ).toBe("true");
    expect(
      screen
        .getByLabelText("新しいパスワード（確認）")
        .getAttribute("aria-invalid"),
    ).toBe("true");
  });

  it("disables the submit button while the change is pending", async () => {
    let resolveAction: ((value: Record<string, never>) => void) | undefined;
    const action = vi.fn(
      () =>
        new Promise<Record<string, never>>((resolve) => {
          resolveAction = resolve;
        }),
    );

    render(<ResetPasswordForm action={action} />);
    fireEvent.submit(screen.getByRole("form", { name: "パスワードの再設定" }));

    await waitFor(() => {
      expect(
        screen
          .getByRole("button", { name: "変更中…" })
          .hasAttribute("disabled"),
      ).toBe(true);
    });

    resolveAction?.({});
  });
});
