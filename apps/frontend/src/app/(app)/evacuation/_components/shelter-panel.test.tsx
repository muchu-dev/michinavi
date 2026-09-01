import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const nearbyShelters = ["第一避難所", "第二避難所", "第三避難所"].map(
  (name, index) => ({
    id: `shelter-${index}`,
    name,
    latitude: 43.69 + index * 0.001,
    longitude: 142.51 + index * 0.001,
    distanceM: 1000 + index * 500,
    acceptances: [],
  }),
);

vi.mock("@/components/map/map-view", () => ({
  MapView: () => <section aria-label="地図" />,
}));

vi.mock("@/lib/trpc/client", () => ({
  api: {
    shelter: {
      nearby: {
        useQuery: (_input: unknown, options: { enabled: boolean }) => ({
          data: options.enabled ? nearbyShelters : undefined,
          error: null,
          isLoading: false,
          isFetching: false,
        }),
      },
      byId: {
        useQuery: () => ({ data: undefined, error: null, isLoading: false }),
      },
    },
  },
}));

import { ShelterPanel } from "./shelter-panel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ShelterPanel", () => {
  it("shows seeded shelters from the explicitly labelled demo location", () => {
    render(<ShelterPanel />);

    fireEvent.click(screen.getByRole("button", { name: "デモ位置" }));

    expect(screen.getByText("デモ位置：岡山県倉敷市真備町箭田")).toBeTruthy();
    for (const shelter of nearbyShelters) {
      expect(screen.getByText(shelter.name)).toBeTruthy();
    }
  });

  it("shows all shelters after obtaining the actual location without OSRM", () => {
    const externalFetch = vi.fn();
    vi.stubGlobal("fetch", externalFetch);
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) =>
          success({
            coords: { latitude: 43.7, longitude: 142.5 },
          } as GeolocationPosition),
      },
    });

    render(<ShelterPanel />);
    fireEvent.click(screen.getByRole("button", { name: "近隣の避難所を更新" }));

    for (const shelter of nearbyShelters) {
      expect(screen.getByText(shelter.name)).toBeTruthy();
    }
    expect(externalFetch).not.toHaveBeenCalled();
  });
});
