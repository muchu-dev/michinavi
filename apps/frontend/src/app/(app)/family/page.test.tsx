import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import FamilyPage from "./page";

afterEach(cleanup);

describe("FamilyPage", () => {
  it("shows each family member with their current evacuation status", () => {
    render(<FamilyPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "家族の状況" }),
    ).toBeDefined();

    const statusList = screen.getByRole("list", {
      name: "家族の避難状況",
    });
    const statusItems = within(statusList).getAllByRole("listitem");

    expect(statusItems).toHaveLength(2);
    expect(within(statusItems[0]).getByText("母")).toBeDefined();
    expect(within(statusItems[0]).getByText("避難済み")).toBeDefined();
    expect(within(statusItems[1]).getByText("父")).toBeDefined();
    expect(within(statusItems[1]).getByText("支援が必要")).toBeDefined();
  });

  it("shows the family settings entry without unfinished placeholder copy", () => {
    render(<FamilyPage />);

    expect(
      screen.getByRole("link", { name: "設定" }).getAttribute("href"),
    ).toBe("/family/settings");
    expect(screen.queryByText(/次の実装範囲/)).toBeNull();
    expect(screen.queryByText(/対象タスク/)).toBeNull();
  });
});
