import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

vi.mock("./app-navigation", () => ({
  AppNavigation: () => <nav aria-label="メインナビゲーション" />,
}));

afterEach(cleanup);

describe("AppShell", () => {
  it("provides the shared brand, main landmark, and navigation", () => {
    render(
      <AppShell>
        <h1>テスト画面</h1>
      </AppShell>,
    );

    expect(screen.getByText("みちナビ")).toBeDefined();
    expect(screen.getByRole("main").textContent).toContain("テスト画面");
    expect(
      screen.getByRole("navigation", { name: "メインナビゲーション" }),
    ).toBeDefined();
  });

  it("offers a keyboard skip link to the main content", () => {
    render(<AppShell>本文</AppShell>);

    expect(
      screen.getByRole("link", { name: "本文へ移動" }).getAttribute("href"),
    ).toBe("#main-content");
    expect(screen.getByRole("main").id).toBe("main-content");
  });
});
