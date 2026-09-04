import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

vi.mock("./app-navigation", () => ({
  AppNavigation: () => <nav aria-label="メインナビゲーション" />,
}));

// QuickPostAction が現在のパスを見るため（FE-19）
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
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

  it("keeps the primary action inside the shell, above the navigation (FE-19)", () => {
    render(
      <AppShell>
        <h1>テスト画面</h1>
      </AppShell>,
    );

    expect(
      screen
        .getByRole("link", { name: "いまの状況を投稿" })
        .getAttribute("href"),
    ).toBe("/posts");
  });

  it("offers a keyboard skip link to the main content", () => {
    render(<AppShell>本文</AppShell>);

    expect(
      screen.getByRole("link", { name: "本文へ移動" }).getAttribute("href"),
    ).toBe("#main-content");
    expect(screen.getByRole("main").id).toBe("main-content");
  });

  it("uses the existing high-contrast ink token for a caution header", () => {
    const { container } = render(
      <AppShell>
        <section data-app-header-tone="caution">本文</section>
      </AppShell>,
    );

    const shell = container.querySelector(".shadow-app");
    expect(shell?.className).toContain(
      "[&:has([data-app-header-tone=caution])>header]:text-ink",
    );
    expect(container.querySelector("header")?.className).toContain(
      "text-white",
    );
    expect(screen.getByText("地域防災ナビゲーション").className).toContain(
      "text-current",
    );
  });
});
