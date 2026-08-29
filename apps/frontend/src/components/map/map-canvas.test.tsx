import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { setView } = vi.hoisted(() => ({ setView: vi.fn() }));

vi.mock("leaflet", () => ({
  divIcon: (options: unknown) => options,
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
  Polyline: ({
    children,
    pathOptions,
    positions,
  }: PropsWithChildren<{
    pathOptions: { color: string; dashArray?: string };
    positions: [number, number][];
  }>) => (
    <div
      data-color={pathOptions.color}
      data-dash-array={pathOptions.dashArray}
      data-point-count={positions.length}
      data-testid="map-route"
    >
      {children}
    </div>
  ),
  Popup: ({ children }: PropsWithChildren) => <div>{children}</div>,
  Tooltip: ({ children }: PropsWithChildren) => <div>{children}</div>,
  TileLayer: ({ attribution, url }: { attribution: string; url: string }) => (
    <div
      data-attribution={attribution}
      data-testid="map-tiles"
      data-url={url}
    />
  ),
  useMap: () => ({ setView }),
}));

import { MapCanvas } from "./map-canvas";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setView.mockClear();
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

  it("renders report markers and their hover details from API data", () => {
    render(
      <MapCanvas
        reports={[
          {
            id: "report-1",
            meshCode: "5133756531",
            roadCondition: "impassable",
            createdAt: "2026-08-29T00:00:00.000Z",
          },
          {
            id: "report-2",
            meshCode: "5133756531",
            roadCondition: "caution",
            createdAt: "2026-08-28T23:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getAllByTestId("report-marker")).toHaveLength(1);
    expect(screen.queryAllByTestId("map-route")).toHaveLength(0);
    expect(screen.queryAllByTestId("map-marker")).toHaveLength(0);
    expect(screen.queryByText("現在地（デモ）")).toBeNull();
    expect(screen.getAllByText("2件の投稿")).toHaveLength(2);
    expect(screen.getAllByText("通行不可")).toHaveLength(2);
    expect(screen.getAllByText("注意")).toHaveLength(2);
    expect(screen.getAllByText(/2026\/08\/29/)).toHaveLength(4);

    const confirmedButtons = screen.getAllByRole("button", {
      name: "✓ 確認済み",
    });
    const inappropriateButtons = screen.getAllByRole("button", {
      name: "不適切な投稿",
    });
    fireEvent.click(confirmedButtons[0] as HTMLButtonElement);
    expect(confirmedButtons[0]?.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(inappropriateButtons[0] as HTMLButtonElement);
    expect(confirmedButtons[0]?.getAttribute("aria-pressed")).toBe("false");
    expect(inappropriateButtons[0]?.getAttribute("aria-pressed")).toBe("true");
  });

  it("starts tracking on user action and renders the acquired current position", async () => {
    const watchPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 35.6812, longitude: 139.7671 },
      } as GeolocationPosition);
      return 1;
    });
    vi.stubGlobal("navigator", {
      geolocation: { watchPosition, clearWatch: vi.fn() },
    });

    render(<MapCanvas />);
    expect(watchPosition).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "現在地を追跡" }));

    expect(watchPosition).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.getByText("現在地")).toBeTruthy();
    });
    expect(screen.getAllByTestId("map-marker")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toBe(
      "現在地を追跡しています",
    );
    expect(setView).toHaveBeenCalledWith([35.6812, 139.7671], 16);
  });

  it("automatically tracks location when permission is already granted", async () => {
    const watchPosition = vi.fn(() => 2);
    vi.stubGlobal("navigator", {
      geolocation: { watchPosition, clearWatch: vi.fn() },
      permissions: {
        query: vi.fn().mockResolvedValue({
          state: "granted",
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
      },
    });

    render(<MapCanvas />);

    await waitFor(() => expect(watchPosition).toHaveBeenCalledOnce());
  });

  it("draws estimated route lines from the current position by report condition", async () => {
    const watchPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 35.6812, longitude: 139.7671 },
      } as GeolocationPosition);
      return 4;
    });
    vi.stubGlobal("navigator", {
      geolocation: { watchPosition, clearWatch: vi.fn() },
    });
    const fetchRoute = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: "Ok",
        routes: [
          {
            geometry: {
              coordinates: [
                [139.7671, 35.6812],
                [139.766, 35.682],
                [139.765, 35.683],
              ],
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchRoute);

    render(
      <MapCanvas
        reports={[
          {
            id: "passable",
            meshCode: "5133756531",
            roadCondition: "passable",
            createdAt: "2026-08-29T00:00:00.000Z",
          },
          {
            id: "caution",
            meshCode: "5133756532",
            roadCondition: "caution",
            createdAt: "2026-08-29T00:00:00.000Z",
          },
          {
            id: "impassable",
            meshCode: "5133756533",
            roadCondition: "impassable",
            createdAt: "2026-08-29T00:00:00.000Z",
          },
          {
            id: "recovered-passable",
            meshCode: "5133756541",
            roadCondition: "passable",
            createdAt: "2026-08-29T01:00:00.000Z",
          },
          {
            id: "previously-impassable",
            meshCode: "5133756541",
            roadCondition: "impassable",
            createdAt: "2026-08-28T23:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.queryAllByTestId("map-route")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "現在地を追跡" }));

    await waitFor(() => {
      expect(screen.getAllByTestId("map-route")).toHaveLength(4);
    });
    expect(fetchRoute).toHaveBeenCalledTimes(4);
    expect(screen.getAllByTestId("map-route")[0]?.dataset.pointCount).toBe("3");
    expect(screen.getAllByTestId("map-route")[0]?.dataset.color).toBe(
      "#2e5d4e",
    );
    expect(screen.getAllByTestId("map-route")[1]?.dataset.dashArray).toBe(
      "4 9",
    );
    expect(screen.getAllByTestId("map-route")[2]?.dataset.color).toBe(
      "#c7362a",
    );
    expect(screen.getAllByTestId("map-route")[3]?.dataset.color).toBe(
      "#f0a92e",
    );
    expect(screen.getAllByTestId("map-route")[3]?.dataset.dashArray).toBe(
      "4 9",
    );
  });

  it("shows guidance when location permission is denied", async () => {
    const watchPosition = vi.fn(
      (_success: PositionCallback, error: PositionErrorCallback) => {
        error({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
        return 3;
      },
    );
    vi.stubGlobal("navigator", {
      geolocation: { watchPosition, clearWatch: vi.fn() },
    });

    render(<MapCanvas />);
    fireEvent.click(screen.getByRole("button", { name: "現在地を追跡" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(
        "位置情報の利用が許可されませんでした",
      );
    });
    expect(screen.queryAllByTestId("map-marker")).toHaveLength(0);
  });
});
