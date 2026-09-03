import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/family/family-status-board", () => ({
  FamilyStatusBoard: () => <div data-testid="family-status-board" />,
}));

import FamilyPage, { metadata } from "./page";

afterEach(cleanup);

describe("FamilyPage", () => {
  it("defines route metadata", () => {
    expect(metadata.title).toBe("家族");
  });

  it("shows the live family status board instead of sample copy", () => {
    render(<FamilyPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "家族の状況" }),
    ).toBeDefined();
    expect(screen.getByTestId("family-status-board")).toBeDefined();
    expect(screen.queryByText("サンプル表示です")).toBeNull();
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
