import { cleanup, render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-leaflet", () => ({
  CircleMarker: ({ children }: PropsWithChildren) => (
    <div data-testid="map-marker">{children}</div>
  ),
  MapContainer: ({ children }: PropsWithChildren) => (
    <div data-testid="leaflet-map">{children}</div>
  ),
  Polyline: () => <div data-testid="map-route" />,
  Popup: ({ children }: PropsWithChildren) => <div>{children}</div>,
  TileLayer: ({ attribution, url }: { attribution: string; url: string }) => (
    <div
      data-attribution={attribution}
      data-testid="map-tiles"
      data-url={url}
    />
  ),
}));

import { MapCanvas } from "./map-canvas";

afterEach(cleanup);

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

  it("renders the prototype route conditions and map points", () => {
    render(<MapCanvas showDemoLocation />);

    expect(screen.getAllByTestId("map-route")).toHaveLength(3);
    expect(screen.getAllByTestId("map-marker")).toHaveLength(2);
    expect(screen.getByText("デモ位置")).toBeTruthy();
    expect(
      screen.getByText("白川橋付近：通行不可の報告があります"),
    ).toBeTruthy();
  });
});
