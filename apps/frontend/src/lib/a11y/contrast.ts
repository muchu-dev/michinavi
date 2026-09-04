/**
 * 文字と背景のコントラスト比（WCAG 2.1 の定義）。
 *
 * 災害時は屋外の明るい場所や、電池を節約して輝度を下げた画面で読むことになる。
 * 「見た目で十分そう」ではなく比率で確かめられるよう、計算をここに置き、
 * 実際に使っている配色の組み合わせをテストで検査する（FE-19）。
 */

export type Rgb = { r: number; g: number; b: number };

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** `#rrggbb` と `#rgb` を受け取る。それ以外は誤りとして例外を投げる */
export function parseHexColor(value: string): Rgb {
  const matched = value.trim().match(HEX_PATTERN);

  if (!matched?.[1]) {
    throw new Error(`色として読めません: ${value}`);
  }

  const hex =
    matched[1].length === 3
      ? matched[1]
          .split("")
          .map((char) => char + char)
          .join("")
      : matched[1];

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

/** 相対輝度（WCAG 2.1） */
export function relativeLuminance(color: Rgb): number {
  const [r, g, b] = [color.r, color.g, color.b].map((channel) => {
    const ratio = channel / 255;

    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 2 色のコントラスト比。1（同じ色）から 21（黒と白）までの値になる */
export function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(parseHexColor(foreground));
  const second = relativeLuminance(parseHexColor(background));
  const [lighter, darker] = first > second ? [first, second] : [second, first];

  return (lighter + 0.05) / (darker + 0.05);
}
