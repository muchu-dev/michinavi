import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const nearbyShelters = [
  { id: "1", name: "満員の最寄り避難所", distanceM: 240 },
  { id: "2", name: "空きのある避難所", distanceM: 680 },
  { id: "3", name: "第三避難所", distanceM: 1200 },
].map((shelter) => ({
  ...shelter,
  latitude: 34.6383,
  longitude: 133.6903,
  acceptances: [],
}));

vi.mock("@/components/map/map-view", () => ({
  MapView: () => <section aria-label="地図" />,
}));
vi.mock("@/lib/trpc/client", () => ({
  api: {
    shelter: {
      nearby: {
        useQuery: () => ({
          data: nearbyShelters,
          error: null,
          isLoading: false,
        }),
      },
    },
    shelterAssignment: {
      loads: {
        useQuery: () => ({
          data: [
            { shelterId: "1", expectedPeople: 100, occupancyRate: 1 },
            { shelterId: "2", expectedPeople: 40, occupancyRate: 0.4 },
            { shelterId: "3", expectedPeople: 60, occupancyRate: 0.6 },
          ],
          error: null,
        }),
      },
    },
  },
}));

import { RoutePanel } from "./route-panel";

afterEach(cleanup);

describe("RoutePanel", () => {
  it("shows congestion-aware choices without requiring a button click", () => {
    render(<RoutePanel />);

    for (const shelter of nearbyShelters)
      expect(screen.getByText(`徒歩で${shelter.name}へ`)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getAllByText("推奨")).toHaveLength(1);
    expect(screen.getByText("徒歩で空きのある避難所へ")).toBeTruthy();
    expect(
      screen.getByText("空きのある避難所から、直線距離が近い順に推奨"),
    ).toBeTruthy();
    expect(screen.getByText(/定員の40%/)).toBeTruthy();
    expect(screen.getByText("約9分・直線距離約0.7km")).toBeTruthy();
    expect(screen.queryByText(/0\.7km \/ 空きのある避難所/)).toBeNull();
  });

  it("explains that the proposal and congestion data can change", () => {
    render(<RoutePanel />);

    expect(
      screen.getByText(/混雑状況は変化するため、自治体の避難情報/),
    ).toBeTruthy();
  });
});
