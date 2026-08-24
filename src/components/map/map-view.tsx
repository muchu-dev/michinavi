"use client";

import dynamic from "next/dynamic";

const MapCanvas = dynamic(
  () => import("./map-canvas").then((module) => module.MapCanvas),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        aria-live="polite"
        className="grid h-full min-h-[30rem] place-items-center bg-[#e8eeec] text-sm font-bold text-muted"
      >
        地図を読み込んでいます
      </div>
    ),
  },
);

export function MapView() {
  return (
    <section
      aria-label="東川町周辺の地図"
      className="relative min-h-[30rem] flex-1 overflow-hidden bg-[#e8eeec]"
    >
      <MapCanvas />
      <div className="pointer-events-none absolute bottom-4 left-4 z-[500] flex flex-wrap gap-2 rounded-2xl border border-outline bg-white/95 px-3 py-2 text-[0.6875rem] font-black text-ink shadow-card backdrop-blur">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-1 w-5 rounded-full bg-passable" />
          通行可
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-1 w-5 rounded-full bg-caution" />
          注意
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-1 w-5 rounded-full bg-impassable" />
          通行不可
        </span>
      </div>
    </section>
  );
}
