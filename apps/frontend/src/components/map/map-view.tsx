"use client";

import dynamic from "next/dynamic";

const MapCanvas = dynamic(
  () => import("./map-canvas").then((module) => module.MapCanvas),
  {
    ssr: false,
    loading: () => (
      <output
        aria-live="polite"
        className="grid h-full min-h-[30rem] place-items-center bg-app-canvas text-sm font-bold text-muted"
      >
        地図を読み込んでいます
      </output>
    ),
  },
);

type MapViewProps = {
  currentLocation?: { latitude: number; longitude: number } | null;
  locationLabel?: string;
  showDemoLocation?: boolean;
  showLocationControl?: boolean;
  fillContainer?: boolean;
};

export function MapView({
  currentLocation = null,
  locationLabel,
  showDemoLocation = false,
  showLocationControl = true,
  fillContainer = false,
}: MapViewProps = {}) {
  return (
    <section
      aria-label="倉敷市真備町周辺の地図"
      className={`relative flex-1 overflow-hidden bg-app-canvas ${
        fillContainer ? "h-full min-h-0" : "min-h-[30rem]"
      }`}
    >
      <MapCanvas
        currentLocation={currentLocation}
        locationLabel={locationLabel}
        showDemoLocation={showDemoLocation}
        showLocationControl={showLocationControl}
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
