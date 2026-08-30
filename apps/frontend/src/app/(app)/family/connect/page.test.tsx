import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import FamilyConnectPage from "./page";

afterEach(cleanup);

describe("FamilyConnectPage", () => {
  it("shows the Family connection controls from the supplied design", () => {
    render(<FamilyConnectPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "家族と連携" }),
    ).toBeDefined();
    expect(screen.getByText("QRコード")).toBeDefined();
    expect(screen.getByRole("button", { name: "読み取る" })).toBeDefined();
  });
});
