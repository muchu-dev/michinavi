/**
 * 災害時に使えるかどうかの基準値（FE-19）。
 *
 * 判断の根拠は docs/design/disaster-ui-checklist.md に置く。
 * 「大きめにする」といった言葉ではなく数値で持ち、テストから参照する。
 */
export const disasterUi = {
  /** タップ領域の最小の一辺（px）。手袋や濡れた指でも押せる大きさ */
  minTapTargetPx: 44,
  /** 本文の最小の文字サイズ（px） */
  minBodyFontPx: 16,
  /** 補助的な文字（日時、凡例など）の最小の文字サイズ（px） */
  minSupportingFontPx: 14,
  /** 文字と背景のコントラスト比の下限（WCAG 2.1 AA） */
  minContrastRatio: 4.5,
  /** 18.66px 以上の太字、または 24px 以上の文字に許される下限 */
  minLargeTextContrastRatio: 3,
} as const;

/**
 * 実際に画面で重ねている「文字の色 / 背景の色」の組。
 * globals.css のトークン名で書き、値そのものは持たない。
 * 二重に値を書くと、CSS だけ直してテストが古いまま通ってしまう。
 */
export const contrastPairs = [
  { foreground: "foreground", background: "surface", usage: "本文" },
  {
    foreground: "foreground",
    background: "app-surface",
    usage: "カードの本文",
  },
  { foreground: "foreground", background: "brand-soft", usage: "選択中の項目" },
  { foreground: "muted", background: "surface", usage: "補助的な文字" },
  { foreground: "muted", background: "app-surface", usage: "カードの補助文字" },
  {
    foreground: "muted",
    background: "app-canvas",
    usage: "画面外側の補助文字",
  },
  { foreground: "brand", background: "surface", usage: "見出しの強調" },
  { foreground: "brand", background: "app-surface", usage: "カードの強調" },
  { foreground: "surface", background: "brand", usage: "ヘッダーと主要ボタン" },
  {
    foreground: "surface",
    background: "impassable",
    usage: "通行不可のバッジ",
  },
  { foreground: "caution-ink", background: "caution-soft", usage: "警戒の帯" },
  {
    // 黄色の面に白文字は 2.02:1 で、地図の吹き出しのバッジが基準を割っていた。
    // 面の色は地図の凡例と揃える必要があるので、前景側を濃くして合わせる
    foreground: "caution-contrast",
    background: "caution",
    usage: "注意のバッジ",
  },
  { foreground: "passable", background: "surface", usage: "通行可の文字" },
  { foreground: "impassable", background: "surface", usage: "通行不可の文字" },
] as const;

/**
 * 文字サイズの下限を機械的に確かめる対象。
 *
 * 画面が増えたらここに足す。全ファイルを対象にしないのは、
 * 検査の対象がどこまでかを一覧で分かるようにしておくためである。
 *
 * 「地図を組み立てている側（map-view.tsx）だけを見て、実際に描いている側
 * （map-canvas.tsx）を見ない」と、検査は通るのに画面は基準を満たさない、
 * という状態になる。描画するファイルも必ず入れる。
 */
export const disasterUiCheckedFiles = [
  "src/app/(app)/page.tsx",
  "src/components/app-shell/app-navigation.tsx",
  "src/components/app-shell/app-shell.tsx",
  "src/components/app-shell/feature-placeholder.tsx",
  "src/components/app-shell/quick-post-action.tsx",
  "src/components/map/map-canvas.tsx",
  "src/components/map/map-view.tsx",
] as const;

/**
 * Leaflet が leaflet.css で持ち込む、基準を下回る既定値。
 * globals.css で上書きし続ける必要があるので、セレクタと必要な下限を持つ。
 *
 * ライブラリの CSS はアプリのコードを読んでも見えない。ここに書き出して
 * テストから検査しないと、地図の実UIだけが基準から外れたままになる。
 */
export const leafletOverrides = [
  {
    /** 既定 12px。吹き出し本文は em 指定なのでこの値に追従する */
    selectors: [".leaflet-container"],
    properties: ["font-size"],
    minPx: disasterUi.minSupportingFontPx,
    usage: "地図と吹き出しの本文",
  },
  {
    /** 既定 11px。地図右下の出典表示 */
    selectors: [".leaflet-control-attribution"],
    properties: ["font-size"],
    minPx: disasterUi.minSupportingFontPx,
    usage: "地図の出典表示",
  },
  {
    /** ズーム操作。既定 26px、タッチ端末向けの指定でも 30px */
    selectors: [".leaflet-bar a", ".leaflet-touch .leaflet-bar a"],
    properties: ["width", "height", "line-height"],
    minPx: disasterUi.minTapTargetPx,
    usage: "ズーム操作",
  },
  {
    /** 吹き出しを閉じるボタン。既定 24px */
    selectors: [".leaflet-container a.leaflet-popup-close-button"],
    properties: ["width", "height", "line-height"],
    minPx: disasterUi.minTapTargetPx,
    usage: "吹き出しを閉じるボタン",
  },
] as const;
