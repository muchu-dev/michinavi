import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const assignShelter = vi.fn();

vi.mock("@/lib/trpc/client", () => ({
  api: {
    shelterAssignment: {
      assign: {
        useMutation: () => ({
          data: undefined,
          error: null,
          isPending: false,
          mutate: assignShelter,
        }),
      },
    },
  },
}));

vi.mock("@/components/map/map-view", () => ({
  MapView: ({
    currentLocation,
    isVisible,
    locationLabel,
  }: {
    currentLocation: { latitude: number; longitude: number } | null;
    isVisible: boolean;
    locationLabel?: string;
  }) => (
    <section
      aria-label="地図"
      data-visible={isVisible}
      data-location={
        currentLocation
          ? `${currentLocation.latitude},${currentLocation.longitude}`
          : ""
      }
      data-location-label={locationLabel}
    />
  ),
}));

vi.mock("./choice-panel", () => ({
  ChoicePanel: ({ isActive }: { isActive: boolean }) => (
    <section aria-label="AIが提案する避難の選択肢" data-active={isActive} />
  ),
}));

import { RoutePanel } from "./route-panel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RoutePanel", () => {
  it("shows BE-19 choices below the existing map", () => {
    render(<RoutePanel />);

    expect(screen.getByRole("region", { name: "地図" })).toBeTruthy();
    expect(
      screen.getByRole("region", { name: "AIが提案する避難の選択肢" }),
    ).toBeTruthy();
  });

  it("passes the active state to both the map and choices", () => {
    render(<RoutePanel isActive={false} />);

    expect(screen.getByRole("region", { name: "地図" }).dataset.visible).toBe(
      "false",
    );
    expect(
      screen.getByRole("region", { name: "AIが提案する避難の選択肢" }).dataset
        .active,
    ).toBe("false");
  });

  it("moves the map to the explicit demo location", () => {
    render(<RoutePanel />);

    fireEvent.click(screen.getByRole("button", { name: "デモ位置" }));

    expect(screen.getByRole("region", { name: "地図" }).dataset.location).toBe(
      "34.6383,133.6903",
    );
    expect(
      screen.getByRole("region", { name: "地図" }).dataset.locationLabel,
    ).toBe("デモ位置（真備町箭田）");
    expect(screen.queryByText("地図表示：デモ位置")).toBeNull();
    expect(assignShelter).toHaveBeenCalledWith({
      latitude: 34.6383,
      longitude: 133.6903,
      radiusM: 5000,
      candidateLimit: 10,
    });
  });

  it("moves only the map to the device location", () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (success: PositionCallback) =>
          success({
            coords: { latitude: 35.01, longitude: 135.76 },
          } as GeolocationPosition),
      },
    });
    render(<RoutePanel />);

    fireEvent.click(screen.getByRole("button", { name: "現在地" }));

    expect(screen.getByRole("region", { name: "地図" }).dataset.location).toBe(
      "35.01,135.76",
    );
    expect(screen.queryByText("地図表示：現在地")).toBeNull();
    expect(screen.queryByText(/避難方法は登録済みの自宅周辺/)).toBeNull();
    expect(assignShelter).toHaveBeenCalledWith({
      latitude: 35.01,
      longitude: 135.76,
      radiusM: 5000,
      candidateLimit: 10,
    });
  });
});
