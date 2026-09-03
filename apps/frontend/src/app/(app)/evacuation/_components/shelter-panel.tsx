"use client";

import type { AppRouter } from "@michinavi/backend";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useMemo, useState } from "react";
import { MapView } from "@/components/map/map-view";
import { api } from "@/lib/trpc/client";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type NearbyShelter = RouterOutputs["shelter"]["nearby"][number];

type ShelterWithDistance = NearbyShelter & {
  distanceKm: number | null;
};

// 現在地とデモ位置を同じ形式で扱う。
type Location = {
  latitude: number;
  longitude: number;
};

const demoLocation: Location = {
  latitude: 34.6383,
  longitude: 133.6903,
};

// 受け入れ条件アイコンへ渡す種別と可否を定義する。
type AcceptanceIconProps = {
  type: "pets" | "infants" | "wheelchair";
  available: boolean;
};

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
          : "border-outline bg-white text-muted"
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

// APIが返すコード値を避難所詳細で読みやすい日本語へ変換する。
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
export function ShelterPanel() {
  // 位置情報・一覧更新時刻・詳細選択をパネル内の状態として管理する。
  const [sheltersUpdatedAt, setSheltersUpdatedAt] = useState("--:--");
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [locationMode, setLocationMode] = useState<"actual" | "demo" | null>(
    null,
  );
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedShelterId, setSelectedShelterId] = useState<string | null>(
    null,
  );
  // 位置取得後だけ近隣一覧を取得し、選択時だけ該当避難所の詳細を取得する。
  const nearbyQuery = api.shelter.nearby.useQuery(
    {
      latitude: currentLocation?.latitude ?? 0,
      longitude: currentLocation?.longitude ?? 0,
      radiusM: 50_000,
      limit: 10,
    },
    { enabled: currentLocation !== null },
  );
  const detailQuery = api.shelter.byId.useQuery(
    { id: selectedShelterId ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: selectedShelterId !== null },
  );

  // APIの距離を基準に並べ直し、表示用データを元のレスポンスから分離する。
  const sortedShelters = useMemo<ShelterWithDistance[]>(
    () =>
      [...(nearbyQuery.data ?? [])]
        .map((shelter) => ({ ...shelter, distanceKm: null }))
        .sort((a, b) => a.distanceM - b.distanceM),
    [nearbyQuery.data],
  );

  // 避難所データの取得完了時刻だけを更新時刻として表示する。
  useEffect(() => {
    if (nearbyQuery.data) setSheltersUpdatedAt(getCurrentTime());
  }, [nearbyQuery.data]);

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
        setLocationMode("actual");
        setIsUpdatingLocation(false);
      },
      () => {
        setLocationError("現在地を取得できませんでした。");
        setIsUpdatingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  // シード避難所を確認できる真備町箭田の代表点へ、明示的にデモ位置を切り替える。
  const useDemoLocation = () => {
    setCurrentLocation(demoLocation);
    setLocationMode("demo");
    setLocationError(null);
    setSelectedShelterId(null);
  };

  return (
    <>
      {/* 避難所画面の上半分に地図 */}
      <div className="relative h-[19rem] shrink-0 overflow-hidden border-b border-outline">
        <MapView
          currentLocation={currentLocation}
          locationLabel={
            locationMode === "demo" ? "デモ位置（真備町箭田）" : undefined
          }
          showLocationControl={false}
          fillContainer
        />
      </div>

      {/* 下半分に位置更新操作、近隣一覧、選択した避難所の詳細を表示する。 */}
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
              onClick={useDemoLocation}
              disabled={isUpdatingLocation || nearbyQuery.isFetching}
              className="inline-flex min-h-11 items-center rounded-full border border-brand bg-brand/10 px-3 text-[0.625rem] font-bold text-brand disabled:opacity-60"
            >
              デモ位置
            </button>
            <button
              type="button"
              onClick={updateCurrentLocation}
              disabled={isUpdatingLocation || nearbyQuery.isFetching}
              className="inline-flex min-h-11 items-center gap-1 rounded-full border border-outline bg-white px-3 text-[0.625rem] font-bold text-muted disabled:opacity-60"
              aria-label="近隣の避難所を更新"
            >
              <span aria-hidden="true">↻</span>
              {isUpdatingLocation
                ? "現在地取得中"
                : nearbyQuery.isFetching
                  ? "避難所取得中"
                  : "更新"}
            </button>
            {/* APIから取得できた避難所件数と、最後に取得が完了した時刻を表示する。 */}
            <span className="whitespace-nowrap text-[0.625rem] font-bold text-muted">
              {currentLocation === null ? "--" : sortedShelters.length}件/
              {sheltersUpdatedAt}時点
            </span>
          </div>
        </div>

        {/* 位置情報と避難所APIのエラーを別々に表示し、失敗箇所を明確にする。 */}
        {locationError && (
          <p
            role="alert"
            className="mb-2 px-1 text-[0.6875rem] font-bold text-impassable"
          >
            {locationError}
          </p>
        )}

        {locationMode === "demo" && (
          <p className="mb-2 px-1 text-[0.6875rem] font-bold text-brand">
            デモ位置：岡山県倉敷市真備町箭田
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

        {/* 未選択時は近隣一覧を、選択後はbyId APIの詳細を表示する。 */}
        {selectedShelterId === null ? (
          <div className="space-y-2">
            {nearbyQuery.isLoading && (
              <p className="rounded-xl border border-outline bg-white px-3 py-5 text-center text-xs font-bold text-muted">
                避難所情報を読み込んでいます
              </p>
            )}
            {currentLocation === null && (
              <p className="rounded-xl border border-outline bg-white px-3 py-5 text-center text-xs font-bold text-muted">
                「更新」から現在地を取得すると、近い順に避難所を表示します
              </p>
            )}
            {currentLocation !== null &&
              !nearbyQuery.isLoading &&
              sortedShelters.length === 0 && (
                <p className="rounded-xl border border-outline bg-white px-3 py-5 text-center text-xs font-bold text-muted">
                  周辺に避難所が見つかりませんでした
                </p>
              )}
            {sortedShelters.map((shelter) => (
              <button
                type="button"
                key={shelter.id}
                onClick={() => setSelectedShelterId(shelter.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-outline bg-white px-3 py-2.5 text-left shadow-card transition-colors hover:bg-brand/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                aria-label={`${shelter.name}の詳細を表示`}
              >
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-black text-ink">
                    {shelter.name}
                  </h3>
                  <p className="mt-0.5 text-[0.6875rem] font-bold text-muted">
                    直線距離約{(shelter.distanceM / 1000).toFixed(1)}km
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
              className="mb-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-black text-brand"
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
              <article className="rounded-2xl border border-outline bg-white p-4 shadow-card">
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
