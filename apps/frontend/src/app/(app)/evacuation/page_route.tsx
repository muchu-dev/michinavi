import { MapView } from "@/components/map/map-view";

const routeLegend = [
  { label: "通行可", color: "bg-passable", dashed: false },
  { label: "注意", color: "bg-caution", dashed: true },
  { label: "通行不可", color: "bg-impassable", dashed: false },
] as const;

type RouteStatus = "passable" | "caution" | "impassable";

// 投稿DBと経路APIの完成後に取得結果へ置き換える仮の避難選択肢
const routeOptions = [
  {
    id: "walk-elementary",
    travelMode: "walk",
    title: "徒歩でみどりが丘小学校へ",
    durationMinutes: 12,
    distanceKm: 0.9,
    destination: "みどりが丘小学校",
    reportStatus: "passable",
    reportCount: 12,
    recommended: true,
  },
  {
    id: "drive-junior-high",
    travelMode: "car",
    title: "車でみどりが丘中学校へ",
    durationMinutes: 18,
    distanceKm: 2.4,
    destination: "みどりが丘中学校",
    reportStatus: "caution",
    reportCount: 4,
    recommended: false,
  },
  {
    id: "stay-home-upstairs",
    travelMode: "home",
    title: "自宅で2階へ",
    durationMinutes: null,
    distanceKm: null,
    destination: "自宅",
    reportStatus: "impassable",
    reportCount: 2,
    recommended: false,
  },
] as const satisfies ReadonlyArray<{
  id: string;
  travelMode: "walk" | "car" | "home";
  title: string;
  durationMinutes: number | null;
  distanceKm: number | null;
  destination: string;
  reportStatus: RouteStatus;
  reportCount: number;
  recommended: boolean;
}>;

const reportStatusDetails = {
  passable: { label: "通行可", color: "bg-passable" },
  caution: { label: "注意", color: "bg-caution" },
  impassable: { label: "通行不可", color: "bg-impassable" },
} as const;

// 避難方法に応じて徒歩と車と自宅のアイコンを表示
function TravelModeIcon({
  travelMode,
}: {
  travelMode: "walk" | "car" | "home";
}) {
  return (
    <span
      className={`grid size-14 shrink-0 place-items-center rounded-xl ${
        travelMode === "walk"
          ? "bg-[#e7f2ed] text-passable"
          : "bg-[#edf1f3] text-muted"
      }`}
    >
      {/* ここの見た目がすごく汚い */}
      {travelMode === "walk" ? (
        <svg
          viewBox="0 0 24 24"
          className="size-6 fill-current"
          aria-hidden="true"
        >
          <circle cx="12.4" cy="4.3" r="1.6" />
          {/* ↓一番の原因である胴体 */}
          <path d="M10.8 6.5 H13.4 V12.8 H10.8 Z" />
          <path d="m10.8 7-3.2 1.7v4H6.2V8l4.3-2.2Z" />
          <path d="m13.1 6.6 2.2 2.3 3.4 1.2v1.5l-4.1-1.1-2.7-2.4Z" />
          <path d="m10.2 11.7-1.7 7.6H6.6l2.2-8.6Z" />
          <path d="m11.8 12.2 2.8 2.3v4.8h-1.8v-3.9l-2.5-1.9Z" />
        </svg>
      ) : travelMode === "car" ? (
        <svg viewBox="0 0 24 24" className="size-7 fill-none stroke-current stroke-2" aria-hidden="true">
          <path d="m5 11 2-5h10l2 5M4 11h16v7H4zM7 18v2M17 18v2" />
          <circle cx="7.5" cy="14.5" r="1" fill="currentColor" />
          <circle cx="16.5" cy="14.5" r="1" fill="currentColor" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-7 fill-none stroke-current stroke-2" aria-hidden="true">
          <path d="m4 11 8-7 8 7v9H4z" />
          <path d="M9 20v-7h6v7" />
        </svg>
      )}
    </span>
  );
}

// 避難経路タブで使用する地図と経路凡例を表示
export function PageRoute() {
  return (
    <>
      <div className="relative h-[19rem] shrink-0 overflow-hidden border-b border-outline">
        <MapView />

        <div
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

      <section className="px-3 pb-5 pt-3" aria-labelledby="route-options-title">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <h2 id="route-options-title" className="text-sm font-black text-ink">
            AIが提案する避難の選択肢
          </h2>
          <span className="whitespace-nowrap text-[0.625rem] font-bold text-muted">
            {routeOptions.length}件
          </span>
        </div>

        <div className="space-y-2.5">
          {routeOptions.map((option) => {
            const reportStatus = reportStatusDetails[option.reportStatus];

            return (
              <article
                key={option.id}
                className={`flex items-center gap-3 rounded-2xl border bg-white px-3 py-3 shadow-[0_2px_8px_rgb(38_47_44/0.05)] ${
                  option.recommended ? "border-passable" : "border-outline"
                }`}
              >
                <TravelModeIcon travelMode={option.travelMode} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-black text-ink">{option.title}</h3>
                    {option.recommended && (
                      <span className="rounded-md bg-passable px-2 py-1 text-[0.6875rem] font-black text-white">
                        推奨
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs font-bold text-muted">
                    {option.travelMode === "home" ? (
                      <>即時 / {option.destination}</>
                    ) : (
                      <>
                        約{option.durationMinutes}分・{option.distanceKm?.toFixed(1)}km / {option.destination}
                      </>
                    )}
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-muted">
                    <span
                      aria-hidden="true"
                      className={`size-2.5 rounded-full ${reportStatus.color}`}
                    />
                    {reportStatus.label}・投稿{option.reportCount}件
                  </p>
                </div>

                <span className="text-2xl font-light text-muted" aria-hidden="true">
                  ›
                </span>
              </article>
            );
          })}
        </div>

        <p className="mt-3 flex items-start gap-2 rounded-xl border border-outline bg-white px-3 py-3 text-[0.6875rem] font-bold leading-relaxed text-muted">
          <span
            aria-hidden="true"
            className="grid size-4 shrink-0 place-items-center rounded-full border border-current text-[0.625rem]"
          >
            i
          </span>
          決めるのはあなたです。状況が変わった場合は、再度確認してください。
        </p>
      </section>
    </>
  );
}
