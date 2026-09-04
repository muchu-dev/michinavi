import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuickPostAction } from "./quick-post-action";

const mockedPathname = vi.hoisted(() => ({ current: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mockedPathname.current,
}));

afterEach(() => {
  cleanup();
  mockedPathname.current = "/";
});

describe("QuickPostAction", () => {
  it("keeps the primary action reachable from the map", () => {
    render(<QuickPostAction />);

    const link = screen.getByRole("link", { name: "いまの状況を投稿" });

    expect(link.getAttribute("href")).toBe("/posts");
    // 指で押せる大きさと、親指の届く高さに固定する
    expect(link.className).toContain("min-h-14");
    expect(link.className).toContain("tap-target");
  });

  it("does not repeat the action on the posts screen", () => {
    mockedPathname.current = "/posts";
    const { container } = render(<QuickPostAction />);

    expect(container.firstChild).toBeNull();
  });
});
