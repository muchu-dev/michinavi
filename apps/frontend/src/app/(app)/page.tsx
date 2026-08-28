import { MapView } from "@/components/map/map-view";

// 参考画像にあるマーカーの表示内容。外形は共通にし、色と中央の記号だけを切り替える。
const mapMarkerSamples = [
  { label: "進入禁止", status: "impassable", symbol: "minus" },
  { label: "通行可", status: "passable", symbol: "turn" },
  { label: "通行不可・冠水", status: "impassable", symbol: "waves" },
  { label: "注意・冠水", status: "caution", symbol: "waves" },
  { label: "通行止め", status: "impassable", symbol: "cross" },
  { label: "注意", status: "caution", symbol: "alert" },
] as const;

type MarkerStatus = (typeof mapMarkerSamples)[number]["status"];
type MarkerSymbol = (typeof mapMarkerSamples)[number]["symbol"];

export default function MapPage() {
  return (
    <section
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      aria-labelledby="map-title"
    >
      {/*
        参考画像のように地図を広く見せるため、画面名・更新情報を一段にまとめたコンパクトなヘッダー。
        Leaflet の地図レイヤーより前面に残るよう、z-index は地図側より大きい値を指定する。
      */}
      <header className="relative z-[600] shrink-0 border-b border-outline bg-white shadow-sm">
        <div className="flex min-h-9 items-center justify-between gap-3 px-3">
          <div className="flex min-w-0 items-center gap-1.5">
            {/* 建物のアイコンで、表示名が自治体・地区を表すことを補足する。 */}
            <svg
              aria-hidden="true"
              className="size-3.5 shrink-0 text-brand"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 21h18M5 21V9l7-4v16M12 9h7v12M8 12h1M8 16h1M15 12h1M15 16h1" />
            </svg>

            {/* section のアクセシブルな名前として aria-labelledby から参照される画面見出し。 */}
            <h1
              id="map-title"
              className="truncate text-xs font-black tracking-[0.02em] text-ink"
            >
              千代田区&nbsp;&nbsp;周辺
            </h1>
          </div>

          {/* 地図へ反映済みの最新更新時刻と、表示対象の投稿件数。 */}
          <p className="shrink-0 text-[0.5625rem] font-bold text-muted">
            9:41更新・投稿24件
          </p>
        </div>

        {/* 発令中の避難情報を、参考画像と同じくヘッダー直下の細い注意表示にする。 */}
        <div className="flex min-h-7 items-center border-t border-outline/60 px-3">
          <p className="inline-flex items-center gap-1 rounded bg-caution-soft px-1.5 py-0.5 text-[0.5625rem] font-black text-caution-ink">
            <span>警戒レベル4</span>
            <span aria-hidden="true">｜</span>
            <span>避難指示発令中</span>
          </p>
        </div>
      </header>
      {/* 残りの表示領域を使って、現在地周辺の地図と地図上の情報を描画する。 */}
      <MapView />

      {/* マーカーの見た目を比較するための仮置き一覧。地図への組み込み後は削除できる。 */}
      <section
        aria-labelledby="marker-samples-title"
        className="relative z-[600] shrink-0 border-t border-outline bg-[#d9dddc] px-3 py-4"
      >
        <h2
          id="marker-samples-title"
          className="mb-3 text-xs font-black text-ink"
        >
          地図アイコン一覧（試作）
        </h2>
        <ul className="grid grid-cols-4 gap-x-2 gap-y-4">
          {mapMarkerSamples.map((marker) => (
            <li
              key={`${marker.status}-${marker.symbol}`}
              className="flex min-w-0 flex-col items-center gap-1.5"
            >
              <MapMarkerIcon status={marker.status} symbol={marker.symbol} />
              <span className="text-center text-[0.5625rem] font-bold leading-tight text-ink">
                {marker.label}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

/**
 * 白い縁取りと接地点の影を持つピン型SVG。
 * currentColor を塗り色に使うことで、状態ごとの色をクラスだけで切り替える。
 */
function MapMarkerIcon({
  status,
  symbol,
}: {
  status: MarkerStatus;
  symbol: MarkerSymbol;
}) {
  const statusColor = {
    impassable: "text-impassable",
    passable: "text-passable",
    caution: "text-caution",
  }[status];

  return (
    <svg
      role="img"
      aria-label={
        mapMarkerSamples.find(
          (marker) => marker.status === status && marker.symbol === symbol,
        )?.label
      }
      className={`h-[4.75rem] w-16 drop-shadow-sm ${statusColor}`}
      viewBox="0 0 72 88"
      fill="none"
    >
      {/* ピンが地面に接して見えるよう、先端の下へ薄い楕円形の影を置く。 */}
      <ellipse cx="36" cy="82" rx="15" ry="4" fill="#ffffff" opacity="0.8" />
      <path
        d="M36 3C18.3 3 4 17.3 4 35c0 23 25.1 40.7 30.5 44.3a2.7 2.7 0 0 0 3 0C42.9 75.7 68 58 68 35 68 17.3 53.7 3 36 3Z"
        fill="currentColor"
        stroke="#ffffff"
        strokeWidth="4"
      />
      <MarkerSymbolIcon symbol={symbol} />
    </svg>
  );
}

// ピン中央の白い記号。線の太さと端の丸みを揃え、縮小表示でも判別しやすくする。
function MarkerSymbolIcon({ symbol }: { symbol: MarkerSymbol }) {
  const commonProps = {
    stroke: "#ffffff",
    strokeWidth: 3,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (symbol === "minus") {
    return (
      <g {...commonProps}>
        <circle cx="36" cy="34" r="14" />
        <path d="M29 34h14" />
      </g>
    );
  }

  if (symbol === "cross") {
    return (
      <g {...commonProps}>
        <circle cx="36" cy="34" r="14" />
        <path d="m31 29 10 10m0-10L31 39" />
      </g>
    );
  }

  if (symbol === "waves") {
    return (
      <g {...commonProps}>
        <path d="M23 27c3-4 6 4 9 0s6 4 9 0 6 4 9 0" />
        <path d="M23 34c3-4 6 4 9 0s6 4 9 0 6 4 9 0" />
        <path d="M23 41c3-4 6 4 9 0s6 4 9 0 6 4 9 0" />
      </g>
    );
  }

  if (symbol === "turn") {
    return (
      <g {...commonProps}>
        <path d="M23 43V31a7 7 0 0 1 7-7h18" />
        <path d="m42 18 7 6-7 7" />
      </g>
    );
  }

  return (
    <g {...commonProps}>
      <path d="M36 25v11" />
      <circle cx="36" cy="42" r="1" fill="#ffffff" stroke="none" />
    </g>
  );
}
