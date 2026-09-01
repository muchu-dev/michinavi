import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import FamilyConnectPage, { metadata } from "./page";

afterEach(cleanup);

describe("FamilyConnectPage", () => {
  it("defines route metadata", () => {
    expect(metadata.title).toBe("家族と連携");
  });

  it("shows the Family connection controls from the supplied design", () => {
    render(<FamilyConnectPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "家族と連携" }),
    ).toBeDefined();
    expect(screen.getByText("QRコード")).toBeDefined();
    const scanButton = screen.getByRole("button", {
      name: /読み取る.*準備中/,
    });
    expect(scanButton.getAttribute("aria-disabled")).toBe("true");
    expect(scanButton.hasAttribute("disabled")).toBe(false);
  });
});
