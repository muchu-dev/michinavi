import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import FamilySettingsPage, { metadata } from "./page";

afterEach(cleanup);

describe("FamilySettingsPage", () => {
  it("defines route metadata", () => {
    expect(metadata.title).toBe("家族の設定");
  });

  it("shows the settings entries from the supplied Family design", () => {
    render(<FamilySettingsPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "家族の設定" }),
    ).toBeDefined();
    const familyProfileButton = screen.getByRole("button", {
      name: /家族構成の登録・更新.*準備中/,
    });
    const personalProfileButton = screen.getByRole("button", {
      name: /個人情報の編集.*準備中/,
    });

    expect(familyProfileButton.getAttribute("aria-disabled")).toBe("true");
    expect(familyProfileButton.hasAttribute("disabled")).toBe(false);
    expect(personalProfileButton.getAttribute("aria-disabled")).toBe("true");
    expect(personalProfileButton.hasAttribute("disabled")).toBe(false);
    expect(
      screen.getByRole("link", { name: "連携" }).getAttribute("href"),
    ).toBe("/family/connect");
  });
});
