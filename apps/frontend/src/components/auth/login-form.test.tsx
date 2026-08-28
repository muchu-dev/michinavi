import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/login/actions", () => ({
  initialLoginState: {},
  login: vi.fn(),
}));

import { LoginForm } from "./login-form";

afterEach(cleanup);

describe("LoginForm", () => {
  it("exposes a labelled email/password form and recovery link", () => {
    render(<LoginForm action={vi.fn()} />);

    const email = screen.getByRole("textbox", { name: "メールアドレス" });
    const password = screen.getByLabelText("パスワード");

    expect(email.getAttribute("type")).toBe("email");
    expect(email.getAttribute("autocomplete")).toBe("email");
    expect(password.getAttribute("type")).toBe("password");
    expect(password.getAttribute("autocomplete")).toBe("current-password");
    expect(screen.getByRole("button", { name: "ログイン" })).toBeDefined();
    expect(
      screen
        .getByRole("link", { name: "パスワードをお忘れですか？" })
        .getAttribute("href"),
    ).toBe("/forgot-password");
  });

  it("shows an explicit onboarding preview entry only when provided", () => {
    const { rerender } = render(
      <LoginForm action={vi.fn()} previewHref="/onboarding" />,
    );

    expect(
      screen
        .getByRole("link", { name: "初回設定をプレビュー" })
        .getAttribute("href"),
    ).toBe("/onboarding");

    rerender(<LoginForm action={vi.fn()} />);
    expect(
      screen.queryByRole("link", { name: "初回設定をプレビュー" }),
    ).toBeNull();
  });

  it("associates server validation errors with their inputs", async () => {
    const action = vi.fn(async () => ({
      fieldErrors: {
        email: ["メールアドレスを入力してください。"],
        password: ["パスワードを入力してください。"],
      },
    }));

    render(<LoginForm action={action} />);
    fireEvent.submit(screen.getByRole("form", { name: "ログイン" }));

    expect(
      await screen.findByText("メールアドレスを入力してください。"),
    ).toBeDefined();
    expect(
      screen.getByLabelText("メールアドレス").getAttribute("aria-invalid"),
    ).toBe("true");
    expect(
      screen.getByLabelText("パスワード").getAttribute("aria-invalid"),
    ).toBe("true");
  });

  it("disables the submit button while authentication is pending", async () => {
    let resolveAction: ((value: Record<string, never>) => void) | undefined;
    const action = vi.fn(
      () =>
        new Promise<Record<string, never>>((resolve) => {
          resolveAction = resolve;
        }),
    );

    render(<LoginForm action={action} />);
    fireEvent.submit(screen.getByRole("form", { name: "ログイン" }));

    await waitFor(() => {
      expect(
        screen
          .getByRole("button", { name: "ログイン中…" })
          .hasAttribute("disabled"),
      ).toBe(true);
    });

    resolveAction?.({});
  });
});
