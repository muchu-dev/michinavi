"use client";

import { divIcon } from "leaflet";
import { useEffect, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

// 避難所デモデータが投入される倉敷市真備町箭田周辺を初期表示位置にする。
const center: [number, number] = [34.6383, 133.6903];

const mapColors = {
  brand: "var(--brand)",
  caution: "var(--caution)",
  impassable: "var(--impassable)",
  passable: "var(--passable)",
  surface: "var(--surface)",
} as const;

type LocationStatus = "idle" | "loading" | "success" | "error";
type ReportKind = "road" | "flooding" | "other";
type RoadCondition = "passable" | "caution" | "impassable";

// 投稿APIが実装されるまで、DBから受け取る予定の形を画面内のサンプルで再現する。
const mapReportSamples: Array<{
  id: string;
  position: [number, number];
  kind: ReportKind;
  roadCondition: RoadCondition | null;
  floodDepthCm: number | null;
  body: string | null;
}> = [
  {
    id: "sample-flooding",
    position: [34.6395, 133.689],
    kind: "flooding",
    roadCondition: "impassable",
    floodDepthCm: 30,
    body: "道路が冠水しています",
  },
];

export function MapCanvas() {
  const [currentPosition, setCurrentPosition] = useState<
    [number, number] | null
  >(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [locationMessage, setLocationMessage] = useState(
    "現在地を表示するには位置情報を許可してください",
  );

  function requestCurrentPosition() {
    if (!("geolocation" in navigator)) {
      setLocationStatus("error");
      setLocationMessage("このブラウザでは位置情報を利用できません");
      return;
    }

    setLocationStatus("loading");
    setLocationMessage("現在地を取得しています");

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCurrentPosition([coords.latitude, coords.longitude]);
        setLocationStatus("success");
        setLocationMessage("現在地を表示しています");
      },
      (error) => {
        setLocationStatus("error");
        setLocationMessage(
          error.code === error.PERMISSION_DENIED
            ? "位置情報の利用が許可されませんでした"
            : "現在地を取得できませんでした。もう一度お試しください",
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
      },
    );
  }

  return (
    <>
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
        {mapReportSamples.map((report) => (
          <Marker
            key={report.id}
            position={report.position}
            icon={createReportIcon(report.kind, report.roadCondition)}
          >
            <Popup>
              <strong>
                {getReportLabel(report.kind, report.roadCondition)}（サンプル）
              </strong>
              {report.floodDepthCm === null ? null : (
                <span>（水深 {report.floodDepthCm}cm）</span>
              )}
              {report.body ? <p>{report.body}</p> : null}
            </Popup>
          </Marker>
        ))}
        {currentPosition ? (
          <>
            <MoveMapToCurrentPosition position={currentPosition} />
            <CircleMarker
              center={currentPosition}
              radius={9}
              pathOptions={{
                color: mapColors.surface,
                fillColor: mapColors.brand,
                fillOpacity: 1,
                weight: 4,
              }}
            >
              <Popup>現在地</Popup>
            </CircleMarker>
          </>
        ) : null}
      </MapContainer>
      <div className="absolute top-3 right-3 z-[500] flex max-w-[min(17rem,calc(100%-1.5rem))] flex-col items-end gap-1.5">
        <button
          type="button"
          onClick={requestCurrentPosition}
          disabled={locationStatus === "loading"}
          className="rounded-full border border-outline bg-surface px-3 py-2 text-xs font-black text-ink shadow-card disabled:cursor-wait disabled:opacity-70"
        >
          {locationStatus === "loading" ? "取得中…" : "現在地を表示"}
        </button>
        <output
          className={`rounded-lg bg-surface/95 px-2 py-1 text-right text-[0.625rem] font-bold shadow-card ${
            locationStatus === "error" ? "text-impassable" : "text-muted"
          }`}
        >
          {locationMessage}
        </output>
      </div>
    </>
  );
}

function getReportLabel(kind: ReportKind, condition: RoadCondition | null) {
  if (kind === "flooding") {
    if (condition === "impassable") return "通行不可・冠水";
    return "注意・冠水";
  }
  if (condition === "passable") return "通行可";
  if (condition === "impassable") return "通行不可";
  if (condition === "caution") return "注意";
  return "現地情報";
}

function createReportIcon(kind: ReportKind, condition: RoadCondition | null) {
  const color =
    condition === "passable"
      ? mapColors.passable
      : condition === "impassable"
        ? mapColors.impassable
        : mapColors.caution;
  const symbol =
    kind === "flooding"
      ? '<path d="M18 19c3-4 6 4 9 0s6 4 9 0"/><path d="M18 26c3-4 6 4 9 0s6 4 9 0"/><path d="M18 33c3-4 6 4 9 0s6 4 9 0"/>'
      : condition === "passable"
        ? '<path d="M17 34V24a6 6 0 0 1 6-6h14"/><path d="m32 13 6 5-6 6"/>'
        : condition === "impassable"
          ? '<path d="m22 19 12 12m0-12L22 31"/>'
          : `<path d="M28 18v10"/><circle cx="28" cy="34" r="1.5" fill="${mapColors.surface}" stroke="none"/>`;

  // Leaflet の divIcon は HTML 文字列を直接描画するため、ここには列挙型から
  // 組み立てた静的値だけを渡す。投稿本文などのユーザー入力は挿入しない。
  return divIcon({
    className: "bg-transparent border-0",
    html: `<svg aria-label="${getReportLabel(kind, condition)}" role="img" viewBox="0 0 56 68" width="44" height="54" fill="none"><path d="M28 2C13.6 2 2 13.6 2 28c0 18.7 20.4 33.1 24.8 36a2.2 2.2 0 0 0 2.4 0C33.6 61.1 54 46.7 54 28 54 13.6 42.4 2 28 2Z" fill="${color}" stroke="${mapColors.surface}" stroke-width="3"/><g stroke="${mapColors.surface}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${symbol}</g></svg>`,
    iconSize: [44, 54],
    iconAnchor: [22, 52],
    popupAnchor: [0, -48],
  });
}

function MoveMapToCurrentPosition({
  position,
}: {
  position: [number, number];
}) {
  const map = useMap();

  useEffect(() => {
    map.setView(position, 16);
  }, [map, position]);

  return null;
}
