import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const createDivIcon = vi.hoisted(() => vi.fn((options: unknown) => options));

vi.mock("leaflet", () => ({
  divIcon: createDivIcon,
}));

vi.mock("react-leaflet", () => ({
  CircleMarker: ({ children }: PropsWithChildren) => (
    <div data-testid="map-marker">{children}</div>
  ),
  MapContainer: ({ children }: PropsWithChildren) => (
    <div data-testid="leaflet-map">{children}</div>
  ),
  Marker: ({ children }: PropsWithChildren) => (
    <div data-testid="report-marker">{children}</div>
  ),
  Popup: ({ children }: PropsWithChildren) => <div>{children}</div>,
  TileLayer: ({ attribution, url }: { attribution: string; url: string }) => (
    <div
      data-attribution={attribution}
      data-testid="map-tiles"
      data-url={url}
    />
  ),
  useMap: () => ({ setView: vi.fn() }),
}));

import { MapCanvas } from "./map-canvas";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MapCanvas", () => {
  it("configures a Leaflet map with attributed OpenStreetMap tiles", () => {
    render(<MapCanvas />);

    expect(screen.getByTestId("leaflet-map")).toBeTruthy();
    expect(screen.getByTestId("map-tiles").getAttribute("data-url")).toContain(
      "tile.openstreetmap.org",
    );
    expect(
      screen.getByTestId("map-tiles").getAttribute("data-attribution"),
    ).toContain("OpenStreetMap");
  });

  it("renders a sample report marker in the planned API data shape", () => {
    render(<MapCanvas />);

    expect(screen.getAllByTestId("report-marker")).toHaveLength(1);
    expect(screen.queryAllByTestId("map-route")).toHaveLength(0);
    expect(screen.queryAllByTestId("map-marker")).toHaveLength(0);
    expect(screen.queryByText("現在地（デモ）")).toBeNull();
    expect(screen.getByText("通行不可・冠水（サンプル）")).toBeTruthy();
    expect(screen.getByText("（水深 30cm）")).toBeTruthy();
    expect(screen.getByText("道路が冠水しています")).toBeTruthy();
    expect(createDivIcon).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("var(--impassable)"),
      }),
    );
    expect(createDivIcon.mock.calls[0]?.[0]).not.toEqual(
      expect.objectContaining({
        html: expect.stringMatching(/#[0-9a-f]{3,8}/i),
      }),
    );
  });

  it("requests permission on user action and renders the acquired current position", async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 35.6812, longitude: 139.7671 },
      } as GeolocationPosition);
    });
    vi.stubGlobal("navigator", {
      geolocation: { getCurrentPosition },
    });

    render(<MapCanvas />);
    expect(getCurrentPosition).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "現在地を表示" }));

    expect(getCurrentPosition).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.getByText("現在地")).toBeTruthy();
    });
    expect(screen.getAllByTestId("map-marker")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toBe(
      "現在地を表示しています",
    );
  });

  it("shows guidance when location permission is denied", async () => {
    const getCurrentPosition = vi.fn(
      (_success: PositionCallback, error: PositionErrorCallback) => {
        error({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
      },
    );
    vi.stubGlobal("navigator", {
      geolocation: { getCurrentPosition },
    });

    render(<MapCanvas />);
    fireEvent.click(screen.getByRole("button", { name: "現在地を表示" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(
        "位置情報の利用が許可されませんでした",
      );
    });
    expect(screen.queryAllByTestId("map-marker")).toHaveLength(0);
  });
});
