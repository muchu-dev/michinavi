import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import FamilySettingsPage from "./page";

afterEach(cleanup);

describe("FamilySettingsPage", () => {
  it("shows the settings entries from the supplied Family design", () => {
    render(<FamilySettingsPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "家族の設定" }),
    ).toBeDefined();
    expect(screen.getByText("家族構成の登録・更新")).toBeDefined();
    expect(screen.getByText("個人情報の編集")).toBeDefined();
    expect(
      screen.getByRole("link", { name: "連携" }).getAttribute("href"),
    ).toBe("/family/connect");
  });
});
