import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/dynamic", () => ({
  default: (
    _loader: () => Promise<unknown>,
    options: { loading: () => ReactNode },
  ) => options.loading,
}));

import { MapView } from "./map-view";

afterEach(cleanup);

describe("MapView", () => {
  it("provides an accessible loading state and route-condition legend", () => {
    render(<MapView />);

    expect(
      screen.getByRole("region", { name: "東川町周辺の地図" }),
    ).toBeTruthy();
    expect(screen.getByText("地図を読み込んでいます")).toBeTruthy();
    expect(screen.getByText("通行可")).toBeTruthy();
    expect(screen.getByText("注意")).toBeTruthy();
    expect(screen.getByText("通行不可")).toBeTruthy();
  });
});
