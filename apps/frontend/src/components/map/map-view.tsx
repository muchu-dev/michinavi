"use client";

import dynamic from "next/dynamic";

export type MapReport = {
  id: string;
  meshCode: string;
  roadCondition: "passable" | "caution" | "impassable";
  createdAt: string;
};

// Leafletはwindowを利用するため、地図本体だけをクライアント側で読み込む。
const MapCanvas = dynamic(
  () => import("./map-canvas").then((module) => module.MapCanvas),
  {
    ssr: false,
    loading: () => (
      <output
        aria-live="polite"
        className="grid h-full min-h-[30rem] place-items-center bg-[#e8eeec] text-sm font-bold text-muted"
      >
        地図を読み込んでいます
      </output>
    ),
  },
);

export function MapView({
  reports = [],
  regionName = "東川町周辺",
  center = [43.6969, 142.5104],
}: {
  reports?: MapReport[];
  regionName?: string;
  center?: [number, number];
}) {
  return (
    <section
      aria-label={`${regionName}の地図`}
      className="relative min-h-[30rem] flex-1 overflow-hidden bg-[#e8eeec]"
    >
      <MapCanvas center={center} reports={reports} />
      <div className="pointer-events-none absolute bottom-4 left-4 z-[500] flex flex-wrap gap-2 rounded-2xl border border-outline bg-white/95 px-3 py-2 text-[0.6875rem] font-black text-ink shadow-card backdrop-blur">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-1 w-5 rounded-full bg-passable"
          />
          通行可
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-1 w-5 rounded-full bg-caution"
          />
          注意
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-1 w-5 rounded-full bg-impassable"
          />
          通行不可
        </span>
      </div>
    </section>
  );
}
