"use client";

import { useEffect, useState } from "react";
import { MapView } from "@/components/map/map-view";

const routeLegend = [
  { label: "通行可", color: "bg-passable", dashed: false },
  { label: "注意", color: "bg-caution", dashed: true },
  { label: "通行不可", color: "bg-impassable", dashed: false },
] as const;

// 仮置きのデータ、デザインの参考用
const nearbyShelters = [
  {
    id: "midori-elementary",
    name: "みどりが丘小学校",
    location: { latitude: 43.7023, longitude: 142.5104 },
    accepts: { pets: true, infants: false, wheelchair: false },
  },
  {
    id: "midori-junior-high",
    name: "みどりが丘中学校",
    location: { latitude: 43.7104, longitude: 142.5104 },
    accepts: { pets: false, infants: false, wheelchair: true },
  },
  {
    id: "community-center",
    name: "公民館",
    location: { latitude: 43.7194, longitude: 142.5104 },
    accepts: { pets: true, infants: true, wheelchair: false },
  },
] as const;

type ShelterWithDistance = (typeof nearbyShelters)[number] & {
  distanceKm: number | null;
};

//場所の緯度・経度を保持する
type Location = {
  latitude: number;
  longitude: number;
};

// 受け入れ条件アイコン
type AcceptanceIconProps = {
  type: "pets" | "infants" | "wheelchair";
  available: boolean;
};

// OSRMのレスポンス型
type OsrmTableResponse = {
  code: string;
  distances?: (number | null)[][];
};
//OSRM、経路取得関数
async function getRouteDistances(
  currentLocation: Location,
  shelters: typeof nearbyShelters,
  signal?: AbortSignal,
) {
  const coordinates = [
    currentLocation,
    ...shelters.map((shelter) => shelter.location),
  ]
    .map(
      (location) =>
        `${location.longitude},${location.latitude}`,
    )
    .join(";");

  const destinations = shelters
    .map((_, index) => index + 1)
    .join(";");

  const url =
    `https://router.project-osrm.org/table/v1/driving/${coordinates}` +
    `?sources=0&destinations=${destinations}&annotations=distance`;

  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error("OSRMから距離を取得できませんでした。");
  }

  const data: OsrmTableResponse =
    await response.json();

  if (
    data.code !== "Ok" ||
    !data.distances?.[0]
  ) {
    throw new Error("OSRMで経路を計算できませんでした。");
  }

  return data.distances[0].map(
    (distance) =>
      distance === null
        ? null
        : distance / 1000,
  );
}

// 端末の現在時刻を時分だけの日本語表示へ
function getCurrentTime() {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

// 受け入れ可能な項目を青色で表示
function AcceptanceIcon({ type, available }: AcceptanceIconProps) {
  const label = {
    pets: "ペット",
    infants: "乳幼児",
    wheelchair: "車いす",
  }[type];

  return (
    <span
      className={`grid size-8 place-items-center rounded-md border ${
        available
          ? "border-brand/25 bg-brand/10 text-brand"
          : "border-outline bg-white text-[#aeb5bc]"
      }`}
      title={`${label}：${available ? "受け入れ可" : "受け入れ不可"}`}
      aria-label={`${label}は${available ? "受け入れ可能" : "受け入れ不可"}`}
    >
      {type === "pets" && (
        <svg
          viewBox="0 0 24 24"
          className="size-5 fill-current"
          aria-hidden="true"
        >
          <path d="M3 7.5 9 4l1.5 6.5L5 11.5 3 7.5Z" />
          <path d="M7 11h10v7H7z" />
          <path d="M7 17h3v4H7zM14 17h3v4h-3z" />
          <path d="M17 11 20 6.5l1.5 1-2.5 6Z" />
        </svg>
      )}
      {type === "infants" && (
        <svg
          viewBox="0 0 24 24"
          className="size-5 fill-none stroke-current stroke-2"
          aria-hidden="true"
        >
          <path d="M9 6c0-2 1.2-3.5 3-4 1.8.5 3 2 3 4" />
          <path d="M8 6h8v3H8z" />
          <rect x="7" y="9" width="10" height="13" rx="1.5" />
          <path d="M12 12h4M12 15h4M12 18h4" />
        </svg>
      )}
      {type === "wheelchair" && (
        <svg
          viewBox="0 0 24 24"
          className="size-5 fill-none stroke-current stroke-2"
          aria-hidden="true"
        >
          <circle cx="10" cy="3.5" r="1.5" fill="currentColor" stroke="none" />
          <path d="M10 6v8h6" />
          <path d="m16 14 3 3 2-2" />
          <path d="M9 10.5a6 6 0 1 0 6.5 7.5" />
        </svg>
      )}
    </span>
  );
}

// 避難所タブの地図と現在地に近い避難所一覧を表示
export function PageShelter() {
  const [sheltersUpdatedAt, setSheltersUpdatedAt] = useState("--:--");
  const [currentLocation, setCurrentLocation] = useState<Location>({
    latitude: 43.6969,
    longitude: 142.5104,
  });
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [isLoadingDistances, setIsLoadingDistances] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [sortedShelters, setSortedShelters] = useState<ShelterWithDistance[]>(
    [],
  );

  // 画面を表示した時点の端末時刻を初回更新時刻として設定
  useEffect(() => {
    setSheltersUpdatedAt(getCurrentTime());
  }, []);

  // ブラウザから現在地を再取得して距離計算を更新
  const updateCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocationError("この端末では位置情報を利用できません。");
      return;
    }

    // 現在地の取得開始に合わせて取得中状態とエラーを更新
    setIsUpdatingLocation(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCurrentLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        setSheltersUpdatedAt(getCurrentTime());
        setIsUpdatingLocation(false);
      },
      () => {
        setLocationError("現在地を取得できませんでした。");
        setIsUpdatingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  // 現在地が変わるたびにOSRMで道路経路距離を取得して並べ替え
  useEffect(() => {
    const abortController = new AbortController();

    const loadDistances = async () => {
      try {
        setIsLoadingDistances(true);
        setLocationError(null);
        const distances = await getRouteDistances(
          currentLocation,
          nearbyShelters,
          abortController.signal,
        );
        const sheltersWithDistance = nearbyShelters
          .map((shelter, index) => ({
            ...shelter,
            distanceKm: distances[index] ?? null,
          }))
          .sort(
            (a, b) =>
              (a.distanceKm ?? Number.POSITIVE_INFINITY) -
              (b.distanceKm ?? Number.POSITIVE_INFINITY),
          );

        setSortedShelters(sheltersWithDistance);
        setSheltersUpdatedAt(getCurrentTime());
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;

        setLocationError(
          error instanceof Error
            ? error.message
            : "OSRMで経路を計算できませんでした。",
        );
      } finally {
        if (!abortController.signal.aborted) setIsLoadingDistances(false);
      }
    };

    void loadDistances();
    return () => abortController.abort();
  }, [currentLocation]);

  return (
    <>
      {/* 避難所画面の上半分に地図 */}
      <div className="relative h-[19rem] shrink-0 overflow-hidden border-b border-outline">
        <MapView />

        <div
          aria-label="現在地"
          className="pointer-events-none absolute left-[13%] top-4 z-[550] grid size-9 place-items-center rounded-full border-[3px] border-white bg-[#ef625c] text-white shadow-card"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[2.2]">
            <path d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z" />
            <circle cx="12" cy="10" r="2" />
          </svg>
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 z-[550] flex items-center gap-3 rounded-xl border border-outline bg-white/95 px-3 py-2 text-[0.6875rem] font-bold text-ink shadow-card backdrop-blur">
          {routeLegend.map((item) => (
            <span key={item.label} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`h-1 w-5 rounded-full ${item.color} ${
                  item.dashed
                    ? "bg-[repeating-linear-gradient(90deg,currentColor_0_5px,transparent_5px_8px)] text-caution"
                    : ""
                }`}
              />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {/*下半分の近隣の避難所一覧を表示*/}
      <section className="px-3 pb-5 pt-3" aria-labelledby="nearby-shelters-title">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <h2 id="nearby-shelters-title" className="text-sm font-black text-ink">
            近隣の避難所
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={updateCurrentLocation}
              disabled={isUpdatingLocation || isLoadingDistances}
              className="inline-flex min-h-6 items-center gap-1 rounded-full border border-outline bg-white px-2 text-[0.625rem] font-bold text-muted disabled:opacity-60"
              aria-label="近隣の避難所を更新"
            >
              <span aria-hidden="true">↻</span>
              {isUpdatingLocation
                ? "現在地取得中"
                : isLoadingDistances
                  ? "経路計算中"
                  : "更新"}
            </button>
            {/* DB接続後はAPIの配列件数と取得時刻を表示する予定 */}
            <span className="whitespace-nowrap text-[0.625rem] font-bold text-muted">
              {sortedShelters.length}件/{sheltersUpdatedAt}時点
            </span>
          </div>
        </div>

        {locationError && (
          <p role="alert" className="mb-2 px-1 text-[0.6875rem] font-bold text-impassable">
            {locationError}
          </p>
        )}

        <div className="space-y-2">
          {sortedShelters.map((shelter) => (
            <article
              key={shelter.id}
              className="flex items-center gap-3 rounded-xl border border-outline bg-white px-3 py-2.5 shadow-[0_2px_8px_rgb(38_47_44/0.05)]"
            >
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-black text-ink">{shelter.name}</h3>
                <p className="mt-0.5 text-[0.6875rem] font-bold text-muted">
                  {shelter.distanceKm === null
                    ? "道路経路なし"
                    : `約${
                        shelter.distanceKm < 10
                          ? shelter.distanceKm.toFixed(1)
                          : Math.round(shelter.distanceKm)
                      }km`}
                </p>
                <div className="mt-2 flex gap-1.5" aria-label="受け入れ条件">
                  <AcceptanceIcon type="pets" available={shelter.accepts.pets} />
                  <AcceptanceIcon type="infants" available={shelter.accepts.infants} />
                  <AcceptanceIcon
                    type="wheelchair"
                    available={shelter.accepts.wheelchair}
                  />
                </div>
              </div>
              {/* 将来の詳細画面への遷移を示す矢印を表示 */}
              <span className="text-xl font-light text-muted" aria-hidden="true">
                ›
              </span>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
