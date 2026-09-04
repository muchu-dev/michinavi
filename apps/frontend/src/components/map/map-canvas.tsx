"use client";

import { divIcon } from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { ReportButton } from "@/components/report/report-button";
import {
  quarterMeshCodeToCenter,
  toQuarterMeshCode,
} from "@/lib/location/mesh-code";
import type { MapReport } from "./map-view";

type LocationStatus = "idle" | "loading" | "success" | "error";
type RoadCondition = "passable" | "caution" | "impassable";
const EMPTY_REPORTS: MapReport[] = [];
const REPORT_VALIDITY_MS = 6 * 60 * 60 * 1000;
const MAP_COLORS = {
  brand: "var(--brand)",
  caution: "var(--caution)",
  impassable: "var(--impassable)",
  passable: "var(--passable)",
  surface: "var(--surface)",
} as const;

export function MapCanvas({
  reports = EMPTY_REPORTS,
  center = [34.6383, 133.6903],
  previewPosition,
  onPositionChange,
  compact = false,
  currentLocation = null,
  isVisible = true,
  locationLabel,
  showDemoLocation = false,
  showLocationControl = true,
}: {
  reports?: MapReport[];
  center?: [number, number];
  previewPosition?: [number, number] | null;
  onPositionChange?: (position: [number, number]) => void;
  compact?: boolean;
  currentLocation?: { latitude: number; longitude: number } | null;
  isVisible?: boolean;
  locationLabel?: string;
  showDemoLocation?: boolean;
  showLocationControl?: boolean;
}) {
  const [currentPosition, setCurrentPosition] = useState<
    [number, number] | null
  >(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [locationMessage, setLocationMessage] = useState(
    "現在地を表示するには位置情報を許可してください",
  );
  const locationWatchId = useRef<number | null>(null);
  const currentLatitude = currentLocation?.latitude;
  const currentLongitude = currentLocation?.longitude;
  const [centerLatitude, centerLongitude] = center;
  const controlledPosition = useMemo<[number, number] | null>(() => {
    if (currentLatitude !== undefined && currentLongitude !== undefined) {
      return [currentLatitude, currentLongitude];
    }
    return showDemoLocation ? [centerLatitude, centerLongitude] : null;
  }, [
    centerLatitude,
    centerLongitude,
    currentLatitude,
    currentLongitude,
    showDemoLocation,
  ]);
  const displayedLocation = controlledPosition ?? currentPosition;
  const reportGroups = useMemo(() => groupReportsByMesh(reports), [reports]);
  const selectedReportPreview = useMemo(() => {
    if (!previewPosition) return null;
    const meshCode = toQuarterMeshCode(...previewPosition);
    const existingGroup = reportGroups.find(
      (group) => group.meshCode === meshCode,
    );
    return {
      count: (existingGroup?.reports.length ?? 0) + 1,
      meshCode,
      position: quarterMeshCodeToCenter(meshCode),
    };
  }, [previewPosition, reportGroups]);

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
    let watchId: number | null = null;
    let failedBeforeRegistration = false;
    watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const position: [number, number] = [coords.latitude, coords.longitude];
        setCurrentPosition(position);
        onPositionChange?.(position);
        setLocationStatus("success");
        setLocationMessage("現在地を追跡しています");
      },
      (error) => {
        if (watchId === null) {
          failedBeforeRegistration = true;
        } else {
          navigator.geolocation.clearWatch(watchId);
          if (locationWatchId.current === watchId) {
            locationWatchId.current = null;
          }
        }
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
    if (failedBeforeRegistration) {
      navigator.geolocation.clearWatch(watchId);
      return;
    }
    locationWatchId.current = watchId;
  }, [onPositionChange]);

  useEffect(() => {
    if (!("permissions" in navigator)) return;

    // オンボーディングなどですでに許可済みなら、追加操作なしで追跡を始める。
    let isActive = true;
    let permissionStatus: PermissionStatus | null = null;
    const startWhenGranted = () => {
      if (permissionStatus?.state === "granted") watchCurrentPosition();
    };

    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        // 解決前にアンマウントされていたら、監視も change の購読も始めない。
        // 始めてしまうと後片付けはすでに済んでいて、誰も解放できなくなる
        if (!isActive) return;

        permissionStatus = status;
        startWhenGranted();
        status.addEventListener("change", startWhenGranted);
      })
      .catch(() => {
        // Some browsers expose Permissions API without supporting geolocation queries.
      });

    return () => {
      isActive = false;
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

  return (
    <>
      <MapContainer
        center={center}
        zoom={15}
        scrollWheelZoom={false}
        className={`absolute inset-0 h-full w-full ${compact ? "min-h-full" : "min-h-[30rem]"}`}
      >
        <InvalidateMapSize isVisible={isVisible} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {reportGroups
          .filter((group) => group.meshCode !== selectedReportPreview?.meshCode)
          .map((group) => (
            <Marker
              key={group.meshCode}
              position={group.center}
              icon={createReportIcon(
                group.reports.length,
                getGroupCondition(group.reports),
              )}
            >
              <Popup>
                <ReportGroupDetails reports={group.reports} />
              </Popup>
            </Marker>
          ))}
        {selectedReportPreview ? (
          <>
            <MoveMapToPosition position={selectedReportPreview.position} />
            <Marker
              position={selectedReportPreview.position}
              icon={createReportIcon(
                selectedReportPreview.count,
                null,
                "投稿後の吹き出し表示位置",
              )}
            >
              <Popup>投稿後の吹き出し表示位置</Popup>
            </Marker>
          </>
        ) : null}
        {displayedLocation ? (
          <>
            <MoveMapToPosition position={displayedLocation} />
            <CircleMarker
              center={displayedLocation}
              radius={9}
              pathOptions={{
                color: MAP_COLORS.surface,
                fillColor: MAP_COLORS.brand,
                fillOpacity: 1,
                weight: 4,
              }}
            >
              <Popup>
                {locationLabel ??
                  (controlledPosition && showDemoLocation
                    ? "デモ位置"
                    : "現在地")}
              </Popup>
            </CircleMarker>
          </>
        ) : null}
      </MapContainer>
      {showLocationControl ? (
        <div className="absolute top-3 right-3 z-[500] flex max-w-[min(17rem,calc(100%-1.5rem))] flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={watchCurrentPosition}
            disabled={locationStatus === "loading"}
            className="tap-target inline-flex items-center justify-center rounded-full border border-outline bg-surface px-4 py-2 text-sm font-black text-ink shadow-card disabled:cursor-wait disabled:opacity-70"
          >
            {locationStatus === "loading" ? "取得中…" : "現在地を追跡"}
          </button>
          <output
            className={`rounded-lg bg-surface/95 px-2 py-1 text-right text-sm font-bold shadow-card ${
              locationStatus === "error" ? "text-impassable" : "text-muted"
            }`}
          >
            {locationMessage}
          </output>
        </div>
      ) : null}
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

function createReportIcon(
  count: number,
  condition: RoadCondition | null,
  ariaLabel = `${count}件の投稿`,
) {
  // 同一メッシュの投稿を1本の吹き出しピンにまとめ、右上へ件数を表示する。
  const countLabel = count > 99 ? "99+" : String(count);
  const color =
    condition === "passable"
      ? MAP_COLORS.passable
      : condition === "caution"
        ? MAP_COLORS.caution
        : condition === "impassable"
          ? MAP_COLORS.impassable
          : MAP_COLORS.brand;
  return divIcon({
    className: "bg-transparent border-0",
    html: `<svg aria-label="${ariaLabel}" role="img" viewBox="0 0 64 64" width="64" height="64"><path d="M9 9h39a6 6 0 0 1 6 6v27a6 6 0 0 1-6 6H25L13 58V48H9a6 6 0 0 1-6-6V15a6 6 0 0 1 6-6Z" fill="${MAP_COLORS.surface}" stroke="${color}" stroke-width="3" stroke-linejoin="round"/><path d="M15 22h27M15 30h27M15 38h18" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/><circle cx="49" cy="15" r="14" fill="${color}" stroke="${MAP_COLORS.surface}" stroke-width="2"/><text x="49" y="20" fill="${MAP_COLORS.surface}" font-family="system-ui,sans-serif" font-size="14" font-weight="800" text-anchor="middle">${countLabel}</text></svg>`,
    iconSize: [64, 64],
    iconAnchor: [16, 62],
    popupAnchor: [16, -57],
  });
}

function ReportGroupDetails({ reports }: { reports: MapReport[] }) {
  return (
    <div className="grid min-w-48 gap-2">
      <strong>{reports.length}件の投稿</strong>
      <ul className="grid divide-y divide-outline">
        {reports.slice(0, 5).map((report) => (
          <li className="grid gap-1.5 py-2 text-sm first:pt-0" key={report.id}>
            <span className="font-bold">
              {getReportLabel(report.roadCondition)}
            </span>
            <time className="text-muted" dateTime={report.createdAt}>
              {new Intl.DateTimeFormat("ja-JP", {
                dateStyle: "short",
                timeStyle: "short",
                // CIや端末のタイムゾーンに左右されず、日本時間で投稿日時を表示する。
                timeZone: "Asia/Tokyo",
              }).format(new Date(report.createdAt))}
            </time>
            {/* 通報は、投稿の中身が見えている場所からしか押せないようにする（FE-18） */}
            <ReportButton
              fieldReportId={report.id}
              targetSummary={getReportLabel(report.roadCondition)}
            />
          </li>
        ))}
      </ul>
      {reports.length > 5 ? (
        <span className="text-sm text-muted">ほか{reports.length - 5}件</span>
      ) : null}
    </div>
  );
}

function groupReportsByMesh(reports: MapReport[]) {
  // 有効期限内の投稿だけを同じ250mメッシュごとにまとめる。
  const groups = new Map<string, MapReport[]>();
  const oldestValidTime = Date.now() - REPORT_VALIDITY_MS;
  for (const report of reports) {
    if (Date.parse(report.createdAt) < oldestValidTime) continue;
    const group = groups.get(report.meshCode) ?? [];
    group.push(report);
    groups.set(report.meshCode, group);
  }

  return [...groups].flatMap(([meshCode, groupedReports]) => {
    try {
      return [
        {
          center: quarterMeshCodeToCenter(meshCode),
          meshCode,
          reports: groupedReports.sort(
            (left, right) =>
              Date.parse(right.createdAt) - Date.parse(left.createdAt),
          ),
        },
      ];
    } catch {
      // APIデータに不正なメッシュが混ざっても、地図全体を壊さず該当投稿だけ除外する。
      return [];
    }
  });
}

function MoveMapToPosition({ position }: { position: [number, number] }) {
  const map = useMap();
  const [latitude, longitude] = position;

  useEffect(() => {
    // 座標が実際に変わったときだけ中心へ移し、利用者が選んだズームは維持する。
    map.setView([latitude, longitude], map.getZoom());
  }, [latitude, longitude, map]);

  return null;
}

function InvalidateMapSize({ isVisible }: { isVisible: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!isVisible) return;

    // 非表示中に初期化されたLeafletへ表示後の寸法だけを再取得させる。
    map.invalidateSize({ animate: false, pan: false });
  }, [isVisible, map]);

  return null;
}
