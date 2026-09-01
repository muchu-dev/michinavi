import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./_components/route-panel", () => ({
  RoutePanel: () => <p>避難経路パネル</p>,
}));

vi.mock("./_components/shelter-panel", () => ({
  ShelterPanel: () => <p>避難所パネル</p>,
}));

import EvacuationPage from "./page";

afterEach(cleanup);

describe("EvacuationPage", () => {
  it("switches from the route view to the shelter view with buttons", () => {
    render(<EvacuationPage />);

    expect(screen.getByText("避難経路パネル")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "避難所" }));

    expect(screen.getByText("避難所パネル")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "避難所" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
});
