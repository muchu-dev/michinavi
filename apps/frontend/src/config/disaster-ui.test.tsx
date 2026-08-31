import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { disasterUi, disasterUiCheckedFiles } from "./disaster-ui";

/** Tailwind の文字サイズクラスと px の対応（v4 の既定値） */
const FONT_SIZE_PX: Record<string, number> = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
};

const FONT_SIZE_CLASS = /\btext-(xs|sm|base|lg|[2-9]?xl|\[[^\]\s]+\])/g;

/** クラス名から px を求める。文字サイズでないもの（色など）は null を返す */
function toPx(token: string): number | null {
  if (!token.startsWith("[")) {
    return FONT_SIZE_PX[token] ?? null;
  }

  const matched = token.slice(1, -1).match(/^([\d.]+)(rem|px)$/);
  if (!matched?.[1]) {
    return null;
  }

  return matched[2] === "rem" ? Number(matched[1]) * 16 : Number(matched[1]);
}

/** vitest は apps/frontend で動くので、そこからの相対で読む */
function readCheckedFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("disaster UI typography (FE-19)", () => {
  it.each(
    disasterUiCheckedFiles.map((path) => [path]),
  )("%s keeps every text size readable without zooming", (relativePath) => {
    const source = readCheckedFile(relativePath);
    const tooSmall: string[] = [];

    for (const [, token] of source.matchAll(FONT_SIZE_CLASS)) {
      if (!token) {
        continue;
      }

      const px = toPx(token);
      if (px !== null && px < disasterUi.minSupportingFontPx) {
        tooSmall.push(`text-${token}（${px}px）`);
      }
    }

    expect(tooSmall).toEqual([]);
  });

  it("keeps the checked file list pointing at files that exist", () => {
    for (const relativePath of disasterUiCheckedFiles) {
      expect(readCheckedFile(relativePath).length).toBeGreaterThan(0);
    }
  });
});
