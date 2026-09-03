import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { setView } = vi.hoisted(() => ({ setView: vi.fn() }));

const createDivIcon = vi.hoisted(() => vi.fn((options: unknown) => options));

vi.mock("leaflet", () => ({
  divIcon: createDivIcon,
}));

vi.mock("react-leaflet", () => ({
  CircleMarker: ({ children }: PropsWithChildren) => (
    <div data-testid="map-marker">{children}</div>
  ),
  MapContainer: ({
    children,
    className,
  }: PropsWithChildren<{ className?: string }>) => (
    <div className={className} data-testid="leaflet-map">
      {children}
    </div>
  ),
  Marker: ({
    children,
    icon,
    position,
  }: PropsWithChildren<{ icon?: { html?: string }; position?: unknown }>) => (
    <div
      data-icon-html={icon?.html}
      data-position={JSON.stringify(position)}
      data-testid="report-marker"
    >
      {children}
    </div>
  ),
  Popup: ({ children }: PropsWithChildren) => <div>{children}</div>,
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
  vi.restoreAllMocks();
  setView.mockClear();
});

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(
    new Date("2026-08-29T02:00:00.000Z").getTime(),
  );
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

  it("uses the compact map height without clipping map controls", () => {
    render(<MapCanvas compact />);

    expect(screen.getByTestId("leaflet-map").className).toContain("min-h-full");
    expect(screen.getByTestId("map-tiles")).toBeTruthy();
  });

  it("renders recent report markers and popup details from API data", () => {
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
    expect(screen.queryAllByTestId("map-marker")).toHaveLength(0);
    expect(screen.queryByText("現在地（デモ）")).toBeNull();
    expect(screen.getByText("2件の投稿")).toBeTruthy();
    expect(screen.getByText("通行不可")).toBeTruthy();
    expect(screen.getByText("注意")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "✓ 確認済み" })).toBeNull();
  });

  it("ignores expired reports and invalid mesh codes", () => {
    render(
      <MapCanvas
        reports={[
          {
            id: "expired",
            meshCode: "5133756531",
            roadCondition: "caution",
            createdAt: "2026-08-28T19:59:59.000Z",
          },
          {
            id: "invalid",
            meshCode: "5133889911",
            roadCondition: "impassable",
            createdAt: "2026-08-29T01:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.queryAllByTestId("report-marker")).toHaveLength(0);
  });

  it("previews the post bubble at the center of its saved mesh", () => {
    render(<MapCanvas previewPosition={[35.6812, 139.7671]} />);

    const preview = screen.getByTestId("report-marker");
    expect(preview.getAttribute("data-position")).toBe(
      JSON.stringify([35.68020833333334, 139.7671875]),
    );
    expect(preview.getAttribute("data-icon-html")).toContain("var(--brand)");
    expect(setView).toHaveBeenCalledWith([35.68020833333334, 139.7671875], 16);
    expect(screen.getByText("投稿後の吹き出し表示位置")).toBeTruthy();
    expect(screen.queryAllByTestId("map-marker")).toHaveLength(0);
  });

  it("merges the preview into an existing bubble in the same mesh", () => {
    render(
      <MapCanvas
        reports={[
          {
            id: "existing",
            meshCode: "5339461132",
            roadCondition: "caution",
            createdAt: "2026-08-29T01:00:00.000Z",
          },
        ]}
        previewPosition={[35.6812, 139.7671]}
      />,
    );

    expect(screen.getAllByTestId("report-marker")).toHaveLength(1);
    expect(
      screen.getByTestId("report-marker").getAttribute("data-icon-html"),
    ).toContain(">2</text>");
  });

  it("starts tracking on user action and renders the acquired current position", async () => {
    const onPositionChange = vi.fn();
    const watchPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 35.6812, longitude: 139.7671 },
      } as GeolocationPosition);
      return 1;
    });
    vi.stubGlobal("navigator", {
      geolocation: { watchPosition, clearWatch: vi.fn() },
    });

    render(<MapCanvas onPositionChange={onPositionChange} />);
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
    expect(onPositionChange).toHaveBeenCalledWith([35.6812, 139.7671]);
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

  it("clears the location watcher when leaving the map", () => {
    const clearWatch = vi.fn();
    const watchPosition = vi.fn(() => 7);
    vi.stubGlobal("navigator", {
      geolocation: { watchPosition, clearWatch },
    });

    const view = render(<MapCanvas />);
    fireEvent.click(screen.getByRole("button", { name: "現在地を追跡" }));
    view.unmount();

    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it("does not request or draw misleading routes to reports", async () => {
    const watchPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 35.6812, longitude: 139.7671 },
      } as GeolocationPosition);
      return 4;
    });
    vi.stubGlobal("navigator", {
      geolocation: { watchPosition, clearWatch: vi.fn() },
    });
    const fetchRoute = vi.fn();
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

    expect(fetchRoute).not.toHaveBeenCalled();
    expect(screen.queryAllByTestId("map-route")).toHaveLength(0);
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

  it("renders a location supplied by an evacuation screen without its own control", () => {
    render(
      <MapCanvas
        currentLocation={{ latitude: 34.6383, longitude: 133.6903 }}
        locationLabel="デモ位置（真備町箭田）"
        showLocationControl={false}
      />,
    );

    expect(screen.getByText("デモ位置（真備町箭田）")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "現在地を表示" })).toBeNull();
    expect(screen.getAllByTestId("map-marker")).toHaveLength(1);
  });
});
