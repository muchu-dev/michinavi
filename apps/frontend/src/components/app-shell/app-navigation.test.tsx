import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { primaryNavigation } from "@/config/navigation";
import { AppNavigation } from "./app-navigation";

const mockedPathname = vi.hoisted(() => ({ current: "/posts" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mockedPathname.current,
}));

afterEach(() => {
  cleanup();
  mockedPathname.current = "/posts";
});

describe("primaryNavigation", () => {
  it("defines the four destinations required by FE-04", () => {
    expect(
      primaryNavigation.map(({ href, label }) => ({ href, label })),
    ).toEqual([
      { href: "/", label: "地図" },
      { href: "/posts", label: "投稿" },
      { href: "/evacuation", label: "避難計画" },
      { href: "/family", label: "家族" },
    ]);
  });
});

describe("AppNavigation", () => {
  it("renders every destination as a semantic link", () => {
    render(<AppNavigation />);

    const navigation = screen.getByRole("navigation", {
      name: "メインナビゲーション",
    });
    const links = Array.from(navigation.querySelectorAll("a"));

    expect(links).toHaveLength(4);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/",
      "/posts",
      "/evacuation",
      "/family",
    ]);
  });

  it("announces the current destination", () => {
    render(<AppNavigation />);

    expect(
      screen.getByRole("link", { name: "投稿" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: "地図" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("only marks the map link current on the root route", () => {
    mockedPathname.current = "/";
    render(<AppNavigation />);

    expect(
      screen.getByRole("link", { name: "地図" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: "投稿" }).getAttribute("aria-current"),
    ).toBeNull();
  });
});
