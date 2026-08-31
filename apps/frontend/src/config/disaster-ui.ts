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
  { foreground: "passable", background: "surface", usage: "通行可の文字" },
  { foreground: "impassable", background: "surface", usage: "通行不可の文字" },
] as const;

/**
 * 文字サイズの下限を機械的に確かめる対象。
 *
 * 画面が増えたらここに足す。全ファイルを対象にしないのは、
 * 検査の対象がどこまでかを一覧で分かるようにしておくためである。
 */
export const disasterUiCheckedFiles = [
  "src/app/(app)/page.tsx",
  "src/components/app-shell/app-navigation.tsx",
  "src/components/app-shell/app-shell.tsx",
  "src/components/app-shell/feature-placeholder.tsx",
  "src/components/app-shell/quick-post-action.tsx",
  "src/components/map/map-view.tsx",
] as const;
