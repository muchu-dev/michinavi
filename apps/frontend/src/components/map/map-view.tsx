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
        className="grid h-full min-h-full place-items-center bg-app-canvas text-sm font-bold text-muted"
      >
        地図を読み込んでいます
      </output>
    ),
  },
);

export function MapView({
  reports = [],
  regionName = "倉敷市真備町周辺",
  center = [34.6383, 133.6903],
  compact = false,
  previewPosition = null,
  onPositionChange,
}: {
  reports?: MapReport[];
  regionName?: string;
  center?: [number, number];
  compact?: boolean;
  previewPosition?: [number, number] | null;
  onPositionChange?: (position: [number, number]) => void;
}) {
  return (
    <section
      aria-label={`${regionName}の地図`}
      className={`relative flex-1 overflow-hidden bg-app-canvas ${compact ? "min-h-52" : "min-h-[30rem]"}`}
    >
      <MapCanvas
        center={center}
        compact={compact}
        reports={reports}
        previewPosition={previewPosition}
        onPositionChange={onPositionChange}
      />
      <div className="pointer-events-none absolute bottom-4 left-4 z-[500] flex flex-wrap gap-2 rounded-2xl border border-outline bg-surface/95 px-3 py-2 text-[0.6875rem] font-black text-ink shadow-card backdrop-blur">
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
