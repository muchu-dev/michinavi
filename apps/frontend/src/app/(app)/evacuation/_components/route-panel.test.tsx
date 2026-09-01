import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const nearbyShelters = [
  { id: "1", name: "箭田小学校", distanceM: 240 },
  { id: "2", name: "真備公民館", distanceM: 680 },
  { id: "3", name: "箭田中学校", distanceM: 1200 },
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
  },
}));

import { RoutePanel } from "./route-panel";

afterEach(cleanup);

describe("RoutePanel", () => {
  it("shows three DB shelters and recommends only the nearest one", () => {
    render(<RoutePanel />);
    for (const shelter of nearbyShelters)
      expect(screen.getByText(`徒歩で${shelter.name}へ`)).toBeTruthy();
    expect(screen.getAllByText("推奨")).toHaveLength(1);
    expect(
      screen.getByText("デモ位置から直線距離が最短のため推奨"),
    ).toBeTruthy();
  });
});
