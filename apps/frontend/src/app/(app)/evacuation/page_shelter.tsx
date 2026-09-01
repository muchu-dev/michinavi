"use client";

import type { AppRouter } from "@michinavi/backend";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useState } from "react";
import { MapView } from "@/components/map/map-view";
import { api } from "@/lib/trpc/client";

const routeLegend = [
  { label: "通行可", color: "bg-passable", dashed: false },
  { label: "注意", color: "bg-caution", dashed: true },
  { label: "通行不可", color: "bg-impassable", dashed: false },
] as const;

type RouterOutputs = inferRouterOutputs<AppRouter>;
type NearbyShelter = RouterOutputs["shelter"]["nearby"][number];

type ShelterWithDistance = NearbyShelter & {
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
  shelters: readonly NearbyShelter[],
  signal?: AbortSignal,
) {
  const coordinates = [
    currentLocation,
    ...shelters.map((shelter) => ({
      latitude: shelter.latitude,
      longitude: shelter.longitude,
    })),
  ]
    .map((location) => `${location.longitude},${location.latitude}`)
    .join(";");

  const destinations = shelters.map((_, index) => index + 1).join(";");

  const url =
    `https://router.project-osrm.org/table/v1/driving/${coordinates}` +
    `?sources=0&destinations=${destinations}&annotations=distance`;

  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error("OSRMから距離を取得できませんでした。");
  }

  const data: OsrmTableResponse = await response.json();

  if (data.code !== "Ok" || !data.distances?.[0]) {
    throw new Error("OSRMで経路を計算できませんでした。");
  }

  return data.distances[0].map((distance) =>
    distance === null ? null : distance / 1000,
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
      role="img"
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

const shelterCategoryLabels = {
  emergency_site: "指定緊急避難場所",
  designated_shelter: "指定避難所",
  welfare_shelter: "福祉避難所",
  temporary: "一時避難場所",
  other: "その他",
} as const;

const hazardTypeLabels: Record<string, string> = {
  flood: "洪水",
  landslide: "土砂災害",
  earthquake: "地震",
  tsunami: "津波",
  fire: "火災",
  inland_flood: "内水氾濫",
  storm_surge: "高潮",
};

function acceptsCondition(
  acceptances: readonly { key: string; status: string }[],
  key: "pet" | "infant" | "wheelchair",
) {
  return acceptances.some(
    (acceptance) =>
      acceptance.key === key &&
      (acceptance.status === "available" || acceptance.status === "limited"),
  );
}

// 避難所タブの地図と現在地に近い避難所一覧を表示
export function PageShelter() {
  const [sheltersUpdatedAt, setSheltersUpdatedAt] = useState("--:--");
  const [currentLocation, setCurrentLocation] = useState<Location>({
    latitude: 34.6383,
    longitude: 133.6903,
  });
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [isLoadingDistances, setIsLoadingDistances] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [sortedShelters, setSortedShelters] = useState<ShelterWithDistance[]>(
    [],
  );
  const [selectedShelterId, setSelectedShelterId] = useState<string | null>(
    null,
  );
  const nearbyQuery = api.shelter.nearby.useQuery({
    latitude: currentLocation.latitude,
    longitude: currentLocation.longitude,
    radiusM: 50_000,
    limit: 10,
  });
  const detailQuery = api.shelter.byId.useQuery(
    { id: selectedShelterId ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: selectedShelterId !== null },
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
        void nearbyQuery.refetch();
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
    const shelters = nearbyQuery.data;

    if (!shelters || shelters.length === 0) {
      setSortedShelters([]);
      return;
    }

    const abortController = new AbortController();

    const loadDistances = async () => {
      try {
        setIsLoadingDistances(true);
        setLocationError(null);
        const distances = await getRouteDistances(
          currentLocation,
          shelters,
          abortController.signal,
        );
        const sheltersWithDistance = shelters
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
        if (error instanceof DOMException && error.name === "AbortError")
          return;

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
  }, [currentLocation, nearbyQuery.data]);

  return (
    <>
      {/* 避難所画面の上半分に地図 */}
      <div className="relative h-[19rem] shrink-0 overflow-hidden border-b border-outline">
        <MapView />

        <div
          role="img"
          aria-label="現在地"
          className="pointer-events-none absolute left-[13%] top-4 z-[550] grid size-9 place-items-center rounded-full border-[3px] border-white bg-[#ef625c] text-white shadow-card"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-4 fill-none stroke-current stroke-[2.2]"
          >
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
      <section
        className="px-3 pb-5 pt-3"
        aria-labelledby="nearby-shelters-title"
      >
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <h2
            id="nearby-shelters-title"
            className="text-sm font-black text-ink"
          >
            近隣の避難所
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={updateCurrentLocation}
              disabled={
                isUpdatingLocation ||
                isLoadingDistances ||
                nearbyQuery.isFetching
              }
              className="inline-flex min-h-6 items-center gap-1 rounded-full border border-outline bg-white px-2 text-[0.625rem] font-bold text-muted disabled:opacity-60"
              aria-label="近隣の避難所を更新"
            >
              <span aria-hidden="true">↻</span>
              {isUpdatingLocation
                ? "現在地取得中"
                : isLoadingDistances || nearbyQuery.isFetching
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
          <p
            role="alert"
            className="mb-2 px-1 text-[0.6875rem] font-bold text-impassable"
          >
            {locationError}
          </p>
        )}

        {nearbyQuery.error && (
          <p
            role="alert"
            className="mb-2 px-1 text-[0.6875rem] font-bold text-impassable"
          >
            避難所情報を取得できませんでした。
          </p>
        )}

        {selectedShelterId === null ? (
          <div className="space-y-2">
            {nearbyQuery.isLoading && (
              <p className="rounded-xl border border-outline bg-white px-3 py-5 text-center text-xs font-bold text-muted">
                避難所情報を読み込んでいます
              </p>
            )}
            {!nearbyQuery.isLoading && sortedShelters.length === 0 && (
              <p className="rounded-xl border border-outline bg-white px-3 py-5 text-center text-xs font-bold text-muted">
                周辺に避難所が見つかりませんでした
              </p>
            )}
            {sortedShelters.map((shelter) => (
              <button
                type="button"
                key={shelter.id}
                onClick={() => setSelectedShelterId(shelter.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-outline bg-white px-3 py-2.5 text-left shadow-[0_2px_8px_rgb(38_47_44/0.05)] transition-colors hover:bg-brand/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                aria-label={`${shelter.name}の詳細を表示`}
              >
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-black text-ink">
                    {shelter.name}
                  </h3>
                  <p className="mt-0.5 text-[0.6875rem] font-bold text-muted">
                    {shelter.distanceKm === null
                      ? `直線距離約${(shelter.distanceM / 1000).toFixed(1)}km`
                      : `道路距離約${
                          shelter.distanceKm < 10
                            ? shelter.distanceKm.toFixed(1)
                            : Math.round(shelter.distanceKm)
                        }km`}
                  </p>
                  <span className="mt-2 flex min-w-0 gap-1.5">
                    <AcceptanceIcon
                      type="pets"
                      available={acceptsCondition(shelter.acceptances, "pet")}
                    />
                    <AcceptanceIcon
                      type="infants"
                      available={acceptsCondition(
                        shelter.acceptances,
                        "infant",
                      )}
                    />
                    <AcceptanceIcon
                      type="wheelchair"
                      available={acceptsCondition(
                        shelter.acceptances,
                        "wheelchair",
                      )}
                    />
                  </span>
                </div>
                <span
                  className="text-xl font-light text-muted"
                  aria-hidden="true"
                >
                  ›
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setSelectedShelterId(null)}
              className="mb-2 inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-black text-brand"
            >
              <span aria-hidden="true">‹</span>
              一覧へ戻る
            </button>

            {detailQuery.isLoading && (
              <p className="rounded-xl border border-outline bg-white px-3 py-5 text-center text-xs font-bold text-muted">
                詳細情報を読み込んでいます
              </p>
            )}

            {detailQuery.error && (
              <p
                role="alert"
                className="rounded-xl border border-impassable/30 bg-white px-3 py-5 text-center text-xs font-bold text-impassable"
              >
                避難所の詳細を取得できませんでした
              </p>
            )}

            {detailQuery.data && (
              <article className="rounded-2xl border border-outline bg-white p-4 shadow-[0_2px_8px_rgb(38_47_44/0.05)]">
                <p className="text-[0.6875rem] font-bold text-brand">
                  {shelterCategoryLabels[detailQuery.data.category]}
                </p>
                <h3 className="mt-1 text-lg font-black text-ink">
                  {detailQuery.data.name}
                </h3>
                {detailQuery.data.nameKana && (
                  <p className="mt-0.5 text-[0.6875rem] font-bold text-muted">
                    {detailQuery.data.nameKana}
                  </p>
                )}
                <p className="mt-3 text-xs font-bold leading-relaxed text-ink">
                  {detailQuery.data.address}
                </p>

                <dl className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-app-surface p-2">
                    <dt className="text-[0.625rem] font-bold text-muted">
                      収容人数
                    </dt>
                    <dd className="mt-1 text-sm font-black text-ink">
                      {detailQuery.data.capacity === null
                        ? "不明"
                        : `${detailQuery.data.capacity}人`}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-app-surface p-2">
                    <dt className="text-[0.625rem] font-bold text-muted">
                      階数
                    </dt>
                    <dd className="mt-1 text-sm font-black text-ink">
                      {detailQuery.data.floors === null
                        ? "不明"
                        : `${detailQuery.data.floors}階`}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-app-surface p-2">
                    <dt className="text-[0.625rem] font-bold text-muted">
                      標高
                    </dt>
                    <dd className="mt-1 text-sm font-black text-ink">
                      {detailQuery.data.elevationM === null
                        ? "不明"
                        : `${detailQuery.data.elevationM}m`}
                    </dd>
                  </div>
                </dl>

                <section className="mt-4" aria-labelledby="acceptances-title">
                  <h4
                    id="acceptances-title"
                    className="text-sm font-black text-ink"
                  >
                    受け入れ条件
                  </h4>
                  <ul className="mt-2 space-y-1.5">
                    {detailQuery.data.acceptances.map((acceptance) => (
                      <li
                        key={acceptance.key}
                        className="flex items-start justify-between gap-3 rounded-lg bg-app-surface px-3 py-2 text-xs"
                      >
                        <span className="font-bold text-ink">
                          {acceptance.label}
                          {acceptance.note ? `（${acceptance.note}）` : ""}
                        </span>
                        <span className="shrink-0 font-black text-brand">
                          {acceptance.status === "available"
                            ? "受入可"
                            : acceptance.status === "limited"
                              ? "条件付き"
                              : "受入不可"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                {detailQuery.data.hazardSupports.length > 0 && (
                  <section className="mt-4" aria-labelledby="hazards-title">
                    <h4
                      id="hazards-title"
                      className="text-sm font-black text-ink"
                    >
                      対応する災害
                    </h4>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {detailQuery.data.hazardSupports.map((hazard) => (
                        <li
                          key={hazard.hazardType}
                          className={`rounded-full px-2.5 py-1 text-[0.6875rem] font-black ${
                            hazard.isSupported
                              ? "bg-brand/10 text-brand"
                              : "bg-impassable/10 text-impassable"
                          }`}
                        >
                          {hazardTypeLabels[hazard.hazardType] ??
                            hazard.hazardType}
                          {hazard.isSupported ? " 対応" : " 非対応"}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <dl className="mt-4 space-y-2 border-t border-outline pt-4 text-xs">
                  {detailQuery.data.operator && (
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 font-bold text-muted">
                        運営
                      </dt>
                      <dd className="font-bold text-ink">
                        {detailQuery.data.operator}
                      </dd>
                    </div>
                  )}
                  {detailQuery.data.phone && (
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 font-bold text-muted">
                        電話
                      </dt>
                      <dd>
                        <a
                          href={`tel:${detailQuery.data.phone}`}
                          className="font-black text-brand underline"
                        >
                          {detailQuery.data.phone}
                        </a>
                      </dd>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 font-bold text-muted">出典</dt>
                    <dd className="font-bold leading-relaxed text-ink">
                      {detailQuery.data.source}
                    </dd>
                  </div>
                </dl>
              </article>
            )}
          </div>
        )}
      </section>
    </>
  );
}
