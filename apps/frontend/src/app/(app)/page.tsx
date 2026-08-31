import { MapView } from "@/components/map/map-view";

export default function MapPage() {
  return (
    <section
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      aria-labelledby="map-title"
    >
      <header className="relative z-[600] shrink-0 border-b border-outline bg-surface shadow-sm">
        <div className="flex min-h-11 items-center justify-between gap-3 px-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <svg
              aria-hidden="true"
              className="size-5 shrink-0 text-brand"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 21h18M5 21V9l7-4v16M12 9h7v12M8 12h1M8 16h1M15 12h1M15 16h1" />
            </svg>
            <h1
              id="map-title"
              className="truncate text-base font-black tracking-[0.02em] text-ink"
            >
              倉敷市真備町&nbsp;&nbsp;周辺（デモ）
            </h1>
          </div>

          <p className="shrink-0 text-sm font-bold text-muted">
            サンプル：9:41更新・投稿24件
          </p>
        </div>

        <div className="flex min-h-11 items-center border-t border-outline/60 px-3">
          <p className="inline-flex items-center gap-1.5 rounded-lg bg-caution-soft px-2.5 py-1 text-sm font-black text-caution-ink">
            <span>サンプル表示</span>
            <span aria-hidden="true">｜</span>
            <span>警戒レベル4・避難指示</span>
          </p>
        </div>
      </header>
      <MapView />
    </section>
  );
}
