import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { assignShelter, invalidateCurrent, mutationState } = vi.hoisted(() => ({
  assignShelter: vi.fn(),
  invalidateCurrent: vi.fn(),
  mutationState: { data: undefined as unknown },
}));

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
    useUtils: () => ({
      shelterAssignment: { current: { invalidate: invalidateCurrent } },
    }),
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
      current: {
        useQuery: () => ({ data: null }),
      },
      assign: {
        useMutation: () => ({
          data: mutationState.data,
          error: null,
          isPending: false,
          mutate: assignShelter,
        }),
      },
    },
  },
}));

import { RoutePanel } from "./route-panel";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mutationState.data = undefined;
});

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

  it("requests a distributed shelter assignment for the demo location", () => {
    render(<RoutePanel />);

    fireEvent.click(
      screen.getByRole("button", { name: "混雑を考慮して避難先を決める" }),
    );

    expect(assignShelter).toHaveBeenCalledWith({
      latitude: 34.6383,
      longitude: 133.6903,
      radiusM: 50_000,
      candidateLimit: 3,
    });
  });

  it("shows the assigned shelter and congestion-aware alternatives", () => {
    mutationState.data = {
      shelterId: "assigned",
      shelterName: "混雑の少ない小学校",
      partySize: 4,
      isOverCapacity: false,
      distanceM: 900,
      expectedPeopleBefore: 20,
      alternatives: [
        {
          id: "alternative",
          name: "代替公民館",
          address: "岡山県倉敷市",
          capacity: 100,
          distanceM: 1200,
          expectedPeople: 50,
          householdCount: 12,
          occupancyRate: 0.5,
          isAssigned: false,
        },
      ],
    };

    render(<RoutePanel />);

    expect(screen.getByText(/世帯4人の避難先に設定しました/)).toBeTruthy();
    expect(screen.getByText("徒歩で混雑の少ない小学校へ")).toBeTruthy();
    expect(screen.getByText("徒歩で代替公民館へ")).toBeTruthy();
    expect(screen.getByText(/定員の50%/)).toBeTruthy();
  });
});
