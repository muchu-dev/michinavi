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

export function MapCanvas() {
  return (
    <MapContainer
      center={center}
      zoom={15}
      scrollWheelZoom={false}
      className="absolute inset-0 h-full min-h-[30rem] w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polyline
        positions={passableRoute}
        pathOptions={{ color: "#2e5d4e", weight: 7, opacity: 0.9 }}
      />
      <Polyline
        positions={cautionRoute}
        pathOptions={{
          color: "#f0a92e",
          weight: 7,
          opacity: 0.9,
          dashArray: "8 10",
        }}
      />
      <Polyline
        positions={impassableRoute}
        pathOptions={{ color: "#c7362a", weight: 7, opacity: 0.9 }}
      />
      <CircleMarker
        center={center}
        radius={9}
        pathOptions={{
          color: "#ffffff",
          fillColor: "#3f7edb",
          fillOpacity: 1,
          weight: 4,
        }}
      >
        <Popup>現在地（デモ）</Popup>
      </CircleMarker>
      <CircleMarker
        center={[43.6986, 142.5139]}
        radius={11}
        pathOptions={{
          color: "#ffffff",
          fillColor: "#c7362a",
          fillOpacity: 1,
          weight: 3,
        }}
      >
        <Popup>白川橋付近：通行不可の報告があります</Popup>
      </CircleMarker>
    </MapContainer>
  );
}
