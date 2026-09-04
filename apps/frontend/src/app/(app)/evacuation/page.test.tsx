import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./_components/route-panel", () => ({
  RoutePanel: ({ isActive }: { isActive: boolean }) => (
    <p data-active={isActive}>避難経路パネル</p>
  ),
}));

vi.mock("./_components/shelter-panel", () => ({
  ShelterPanel: ({ isActive }: { isActive: boolean }) => (
    <div data-active={isActive}>
      <p>避難所パネル</p>
      <label>
        取得済み現在地
        <input aria-label="取得済み現在地" />
      </label>
    </div>
  ),
}));

import EvacuationPage from "./page";

afterEach(cleanup);

describe("EvacuationPage", () => {
  it("switches from the route view to the shelter view with buttons", () => {
    render(<EvacuationPage />);

    expect(
      screen.getByRole("button", { name: "避難経路" }).className,
    ).toContain("text-ink");
    expect(screen.getByRole("button", { name: "避難所" }).className).toContain(
      "text-ink",
    );
    expect(screen.getByText("避難経路パネル")).toBeTruthy();
    expect(screen.getByText("避難経路パネル").dataset.active).toBe("true");
    expect(screen.getByText("避難所パネル").parentElement?.dataset.active).toBe(
      "false",
    );
    expect(screen.getByTestId("route-panel-container").className).toContain(
      "flex",
    );
    expect(screen.getByTestId("shelter-panel-container").className).toContain(
      "hidden",
    );

    fireEvent.click(screen.getByRole("button", { name: "避難所" }));

    expect(screen.getByText("避難所パネル")).toBeTruthy();
    expect(screen.getByText("避難経路パネル").dataset.active).toBe("false");
    expect(screen.getByText("避難所パネル").parentElement?.dataset.active).toBe(
      "true",
    );
    expect(screen.getByTestId("route-panel-container").className).toContain(
      "hidden",
    );
    expect(screen.getByTestId("shelter-panel-container").className).toContain(
      "flex",
    );
    expect(
      screen
        .getByRole("button", { name: "避難所" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("keeps shelter state when switching tabs", () => {
    render(<EvacuationPage />);
    fireEvent.click(screen.getByRole("button", { name: "避難所" }));

    const location = screen.getByLabelText("取得済み現在地");
    fireEvent.change(location, { target: { value: "34.6383,133.6903" } });

    fireEvent.click(screen.getByRole("button", { name: "避難経路" }));
    fireEvent.click(screen.getByRole("button", { name: "避難所" }));

    expect(
      screen.getByLabelText<HTMLInputElement>("取得済み現在地").value,
    ).toBe("34.6383,133.6903");
  });
});
