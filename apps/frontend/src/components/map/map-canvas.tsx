"use client";

import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
} from "react-leaflet";

const center: [number, number] = [43.6969, 142.5104];

const passableRoute: [number, number][] = [
  [43.6994, 142.5038],
  [43.6984, 142.507],
  [43.6974, 142.5108],
];

const cautionRoute: [number, number][] = [
  [43.6951, 142.506],
  [43.6964, 142.509],
  [43.6974, 142.5108],
];

const impassableRoute: [number, number][] = [
  [43.6974, 142.5108],
  [43.6985, 142.5138],
  [43.6996, 142.5162],
];

type MapCanvasProps = {
  currentLocation?: { latitude: number; longitude: number } | null;
  locationLabel?: string;
  showDemoLocation?: boolean;
};

export function MapCanvas({
  currentLocation = null,
  locationLabel,
  showDemoLocation = false,
}: MapCanvasProps) {
  const displayedLocation: [number, number] | null = currentLocation
    ? [currentLocation.latitude, currentLocation.longitude]
    : showDemoLocation
      ? center
      : null;

  return (
    <MapContainer
      key={displayedLocation?.join(",") ?? "default-map-center"}
      center={displayedLocation ?? center}
      zoom={15}
      scrollWheelZoom={false}
      className="absolute inset-0 h-full min-h-0 w-full"
      style={{ background: "var(--app-canvas)" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polyline
        positions={passableRoute}
        pathOptions={{ color: "var(--passable)", weight: 7, opacity: 0.9 }}
      />
      <Polyline
        positions={cautionRoute}
        pathOptions={{
          color: "var(--caution)",
          weight: 7,
          opacity: 0.9,
          dashArray: "8 10",
        }}
      />
      <Polyline
        positions={impassableRoute}
        pathOptions={{ color: "var(--impassable)", weight: 7, opacity: 0.9 }}
      />
      {displayedLocation && (
        <CircleMarker
          center={displayedLocation}
          radius={9}
          pathOptions={{
            color: "var(--surface)",
            fillColor: "var(--brand)",
            fillOpacity: 1,
            weight: 4,
          }}
        >
          <Popup>
            {locationLabel ?? (currentLocation ? "現在地" : "デモ位置")}
          </Popup>
        </CircleMarker>
      )}
      <CircleMarker
        center={[43.6986, 142.5139]}
        radius={11}
        pathOptions={{
          color: "var(--surface)",
          fillColor: "var(--impassable)",
          fillOpacity: 1,
          weight: 3,
        }}
      >
        <Popup>白川橋付近：通行不可の報告があります</Popup>
      </CircleMarker>
    </MapContainer>
  );
}
