"use client";

import { divIcon } from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import { quarterMeshCodeToCenter } from "@/lib/location/mesh-code";
import type { MapReport } from "./map-view";

type LocationStatus = "idle" | "loading" | "success" | "error";
type RoadCondition = "passable" | "caution" | "impassable";
type ReportFeedback = "confirmed" | "inappropriate";
type RoadRoute = {
  condition: RoadCondition;
  meshCode: string;
  positions: [number, number][];
};
const EMPTY_REPORTS: MapReport[] = [];

export function MapCanvas({
  reports = EMPTY_REPORTS,
  center = [35.6938, 139.753],
}: {
  reports?: MapReport[];
  center?: [number, number];
}) {
  const [currentPosition, setCurrentPosition] = useState<
    [number, number] | null
  >(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [locationMessage, setLocationMessage] = useState(
    "現在地を表示するには位置情報を許可してください",
  );
  const locationWatchId = useRef<number | null>(null);
  const reportGroups = useMemo(() => groupReportsByMesh(reports), [reports]);
  const [roadRoutes, setRoadRoutes] = useState<RoadRoute[]>([]);
  const [feedbackByReportId, setFeedbackByReportId] = useState<
    Record<string, ReportFeedback>
  >({});
  // GPSの細かな揺れでOSRMへ連続問い合わせしないよう、約100m単位で再計算する。
  const routeOriginKey = currentPosition
    ? `${currentPosition[0].toFixed(3)},${currentPosition[1].toFixed(3)}`
    : null;

  const watchCurrentPosition = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocationStatus("error");
      setLocationMessage("このブラウザでは位置情報を利用できません");
      return;
    }

    if (locationWatchId.current !== null) return;

    setLocationStatus("loading");
    setLocationMessage("現在地を取得しています");

    // 位置が更新されるたびにピンと地図中心を追従させる。
    locationWatchId.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setCurrentPosition([coords.latitude, coords.longitude]);
        setLocationStatus("success");
        setLocationMessage("現在地を追跡しています");
      },
      (error) => {
        locationWatchId.current = null;
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
  }, []);

  useEffect(() => {
    if (!("permissions" in navigator)) return;

    // オンボーディングなどですでに許可済みなら、追加操作なしで追跡を始める。
    let permissionStatus: PermissionStatus | null = null;
    const startWhenGranted = () => {
      if (permissionStatus?.state === "granted") watchCurrentPosition();
    };

    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        permissionStatus = status;
        startWhenGranted();
        status.addEventListener("change", startWhenGranted);
      })
      .catch(() => {
        // Some browsers expose Permissions API without supporting geolocation queries.
      });

    return () => {
      permissionStatus?.removeEventListener("change", startWhenGranted);
    };
  }, [watchCurrentPosition]);

  useEffect(
    () => () => {
      // 画面を離れた後にブラウザの位置監視を残さない。
      if (locationWatchId.current !== null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(locationWatchId.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!routeOriginKey || reportGroups.length === 0) {
      setRoadRoutes([]);
      return;
    }

    const controller = new AbortController();
    const routeOrigin = routeOriginKey.split(",").map(Number) as [
      number,
      number,
    ];
    // 一部の経路取得だけが失敗しても、取得できた経路は地図へ表示する。
    Promise.allSettled(
      reportGroups.map(async (group) => ({
        meshCode: group.meshCode,
        condition: getGroupCondition(group.reports),
        positions: await getRoadRoute(
          routeOrigin,
          quarterMeshCodeToCenter(group.meshCode),
          controller.signal,
        ),
      })),
    ).then((results) => {
      if (controller.signal.aborted) return;
      setRoadRoutes(
        results.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : [],
        ),
      );
    });

    return () => controller.abort();
  }, [routeOriginKey, reportGroups]);

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
        {reportGroups.map((group) => (
          <Marker
            key={group.meshCode}
            position={quarterMeshCodeToCenter(group.meshCode)}
            icon={createReportIcon(group.reports.length)}
          >
            <Popup>
              <ReportGroupDetails
                reports={group.reports}
                feedbackByReportId={feedbackByReportId}
                onFeedback={(reportId, feedback) =>
                  setFeedbackByReportId((current) => ({
                    ...current,
                    [reportId]: feedback,
                  }))
                }
              />
            </Popup>
            <Tooltip direction="top" offset={[0, -44]}>
              <ReportGroupDetails reports={group.reports} compact />
            </Tooltip>
          </Marker>
        ))}
        {roadRoutes.map((route) => (
          <Polyline
            key={`route-${route.meshCode}`}
            positions={route.positions}
            pathOptions={getRouteStyle(route.condition)}
          >
            <Tooltip sticky>
              現在地から投稿地点への推定経路：
              {getReportLabel(route.condition)}
            </Tooltip>
          </Polyline>
        ))}
        {currentPosition ? (
          <>
            <MoveMapToCurrentPosition position={currentPosition} />
            <CircleMarker
              center={currentPosition}
              radius={9}
              pathOptions={{
                color: "#ffffff",
                fillColor: "#3f7edb",
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
          onClick={watchCurrentPosition}
          disabled={locationStatus === "loading"}
          className="rounded-full border border-outline bg-white px-3 py-2 text-xs font-black text-ink shadow-card disabled:cursor-wait disabled:opacity-70"
        >
          {locationStatus === "loading" ? "取得中…" : "現在地を追跡"}
        </button>
        <output
          className={`rounded-lg bg-white/95 px-2 py-1 text-right text-[0.625rem] font-bold shadow-card ${
            locationStatus === "error" ? "text-impassable" : "text-muted"
          }`}
        >
          {locationMessage}
        </output>
      </div>
    </>
  );
}

function getReportLabel(condition: RoadCondition) {
  if (condition === "passable") return "通行可";
  if (condition === "impassable") return "通行不可";
  return "注意";
}

function getGroupCondition(reports: MapReport[]): RoadCondition {
  // 基本は最新投稿を採用するが、過去に通行不可なら解除直後も注意として扱う。
  const [latest, ...history] = [...reports].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
  if (!latest) return "caution";
  if (latest.roadCondition !== "passable") return latest.roadCondition;

  return history.some((report) => report.roadCondition === "impassable")
    ? "caution"
    : "passable";
}

function getRouteStyle(condition: RoadCondition) {
  if (condition === "impassable") {
    return { color: "#c7362a", opacity: 0.95, weight: 6 };
  }
  if (condition === "caution") {
    return {
      color: "#f0a92e",
      dashArray: "4 9",
      lineCap: "round" as const,
      opacity: 0.95,
      weight: 6,
    };
  }
  return { color: "#2e5d4e", opacity: 0.95, weight: 6 };
}

async function getRoadRoute(
  origin: [number, number],
  destination: [number, number],
  signal: AbortSignal,
) {
  // OSRMは「経度,緯度」、Leafletは「緯度,経度」なので入出力時に順序を変える。
  const coordinates = `${origin[1]},${origin[0]};${destination[1]},${destination[0]}`;
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`,
    { signal },
  );
  if (!response.ok) throw new Error("道路経路を取得できませんでした");

  const data: {
    code: string;
    routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
  } = await response.json();
  const coordinatesOnRoad = data.routes?.[0]?.geometry?.coordinates;
  if (data.code !== "Ok" || !coordinatesOnRoad?.length) {
    throw new Error("道路経路を計算できませんでした");
  }

  return coordinatesOnRoad.map(
    ([longitude, latitude]) => [latitude, longitude] as [number, number],
  );
}

function createReportIcon(count: number) {
  // 同一メッシュの投稿を1本の吹き出しピンにまとめ、右上へ件数を表示する。
  const countLabel = count > 99 ? "99+" : String(count);
  return divIcon({
    className: "bg-transparent border-0",
    html: `<svg aria-label="${count}件の投稿" role="img" viewBox="0 0 64 64" width="52" height="52"><path d="M9 9h39a6 6 0 0 1 6 6v27a6 6 0 0 1-6 6H25L13 58V48H9a6 6 0 0 1-6-6V15a6 6 0 0 1 6-6Z" fill="white" stroke="#597ebf" stroke-width="3" stroke-linejoin="round"/><path d="M15 22h27M15 30h27M15 38h18" fill="none" stroke="#597ebf" stroke-width="3" stroke-linecap="round"/><circle cx="51" cy="12" r="11" fill="#597ebf" stroke="white" stroke-width="2"/><text x="51" y="15.5" fill="white" font-family="system-ui,sans-serif" font-size="10" font-weight="800" text-anchor="middle">${countLabel}</text></svg>`,
    iconSize: [52, 52],
    iconAnchor: [13, 50],
    popupAnchor: [13, -46],
  });
}

function ReportGroupDetails({
  reports,
  compact = false,
  feedbackByReportId = {},
  onFeedback,
}: {
  reports: MapReport[];
  compact?: boolean;
  feedbackByReportId?: Record<string, ReportFeedback>;
  onFeedback?: (reportId: string, feedback: ReportFeedback) => void;
}) {
  // 確認・不適切の選択はDB未対応のため、この画面を開いている間だけ保持される。
  return (
    <div className="grid min-w-48 gap-2">
      <strong>{reports.length}件の投稿</strong>
      <ul className="grid divide-y divide-outline">
        {reports.slice(0, 5).map((report) => (
          <li className="grid gap-1.5 py-2 text-xs first:pt-0" key={report.id}>
            <span className="font-bold">
              {getReportLabel(report.roadCondition)}
            </span>
            <time className="text-muted" dateTime={report.createdAt}>
              {new Intl.DateTimeFormat("ja-JP", {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(report.createdAt))}
            </time>
            {!compact && onFeedback ? (
              <div className="mt-1 flex items-center justify-between gap-2">
                <button
                  type="button"
                  aria-pressed={feedbackByReportId[report.id] === "confirmed"}
                  onClick={() => onFeedback(report.id, "confirmed")}
                  className="min-h-7 rounded-md bg-[#dce9ff] px-2 text-[0.6875rem] font-bold text-[#416cad] aria-pressed:bg-[#8eb5f5] aria-pressed:text-white"
                >
                  ✓ 確認済み
                </button>
                <button
                  type="button"
                  aria-pressed={
                    feedbackByReportId[report.id] === "inappropriate"
                  }
                  onClick={() => onFeedback(report.id, "inappropriate")}
                  className="min-h-7 rounded-md bg-[#eceeef] px-2 text-[0.6875rem] font-bold text-[#8b9298] aria-pressed:bg-[#c7362a] aria-pressed:text-white"
                >
                  不適切な投稿
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {reports.length > 5 ? (
        <span className="text-xs text-muted">ほか{reports.length - 5}件</span>
      ) : null}
    </div>
  );
}

function groupReportsByMesh(reports: MapReport[]) {
  // 同じ250mメッシュの投稿をまとめ、詳細では新しい投稿から表示する。
  const groups = new Map<string, MapReport[]>();
  for (const report of reports) {
    const group = groups.get(report.meshCode) ?? [];
    group.push(report);
    groups.set(report.meshCode, group);
  }

  return [...groups].map(([meshCode, groupedReports]) => ({
    meshCode,
    reports: groupedReports.sort(
      (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
    ),
  }));
}

function MoveMapToCurrentPosition({
  position,
}: {
  position: [number, number];
}) {
  const map = useMap();

  useEffect(() => {
    // watchPositionで受け取った最新座標を常に地図の中心へ移す。
    map.setView(position, 16);
  }, [map, position]);

  return null;
}
