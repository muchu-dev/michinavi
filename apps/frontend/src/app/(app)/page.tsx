import { MapView } from "@/components/map/map-view";

export default function MapPage() {
  return (
    <section
      className="flex min-h-0 flex-1 flex-col"
      aria-labelledby="map-title"
    >
      <div className="relative z-[600] border-b border-outline bg-surface px-4 py-3 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-brand">現在地周辺</p>
            <h1 id="map-title" className="mt-0.5 text-xl font-black text-ink">
              東川町 周辺
            </h1>
          </div>
          <p className="pt-1 text-right text-[0.6875rem] font-bold text-muted">
            9:41更新
            <br />
            投稿24件
          </p>
        </div>
        <p className="mt-2 inline-flex min-h-8 items-center rounded-lg bg-caution-soft px-3 py-1 text-xs font-black text-caution-ink">
          警戒レベル4　避難指示発令中
        </p>
      </div>
      <MapView />
    </section>
  );
}
