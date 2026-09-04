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
  it("uses a generic accessible name and hides the legend without reports", () => {
    render(<MapView />);

    expect(screen.getByRole("region", { name: "地図" })).toBeTruthy();
    expect(screen.getByText("地図を読み込んでいます")).toBeTruthy();
    expect(screen.queryByText("通行可")).toBeNull();
    expect(screen.queryByText("注意")).toBeNull();
    expect(screen.queryByText("通行不可")).toBeNull();
  });

  it("shows the supplied region name and legend when reports are displayed", () => {
    render(
      <MapView
        regionName="倉敷市真備町周辺"
        reports={[
          {
            id: "report-1",
            meshCode: "5133756533",
            roadCondition: "passable",
            createdAt: "2026-09-04T00:00:00.000Z",
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("region", { name: "倉敷市真備町周辺の地図" }),
    ).toBeTruthy();
    expect(screen.getByText("通行可")).toBeTruthy();
    expect(screen.getByText("注意")).toBeTruthy();
    expect(screen.getByText("通行不可")).toBeTruthy();
  });
});
