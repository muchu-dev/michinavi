import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastPairs, disasterUi } from "@/config/disaster-ui";
import { contrastRatio, parseHexColor, relativeLuminance } from "./contrast";

/**
 * 配色は globals.css の :root だけを正とし、テストへ値を書き写さない。
 * 二重に持つと、CSS だけ直したときにテストが古い値のまま通ってしまう。
 */
/** vitest は apps/frontend で動くので、そこからの相対で読む */
function readGlobalsCss(): string {
  return readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
}

function readCssTokens(): Record<string, string> {
  const css = readGlobalsCss();
  const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf("}"));
  const tokens: Record<string, string> = {};

  for (const [, name, value] of rootBlock.matchAll(
    /--([a-z-]+):\s*(#[0-9a-fA-F]{3,8});/g,
  )) {
    if (name && value) {
      tokens[name] = value;
    }
  }

  return tokens;
}

describe("contrast helpers", () => {
  it("reads both hex forms", () => {
    expect(parseHexColor("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHexColor("1d1b20")).toEqual({ r: 29, g: 27, b: 32 });
  });

  it("rejects a value that is not a colour", () => {
    expect(() => parseHexColor("var(--brand)")).toThrow();
  });

  it("computes the documented luminance boundaries", () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
  });

  it("computes the known contrast boundaries", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 2);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });
});

describe("disaster UI palette (FE-19)", () => {
  const tokens = readCssTokens();

  it("exposes every token the screens combine", () => {
    for (const pair of contrastPairs) {
      expect(tokens[pair.foreground]).toBeTruthy();
      expect(tokens[pair.background]).toBeTruthy();
    }
  });

  it.each([
    ...contrastPairs,
  ])("keeps $usage（$foreground / $background）readable", ({
    foreground,
    background,
  }) => {
    const foregroundHex = tokens[foreground];
    const backgroundHex = tokens[background];

    if (!foregroundHex || !backgroundHex) {
      throw new Error(
        `globals.css に色が足りません: ${foreground} / ${background}`,
      );
    }

    expect(contrastRatio(foregroundHex, backgroundHex)).toBeGreaterThanOrEqual(
      disasterUi.minContrastRatio,
    );
  });

  it("declares the minimum tap target as a token", () => {
    const matched = readGlobalsCss().match(/--tap-min:\s*([\d.]+)rem;/);

    expect(matched).not.toBeNull();
    expect(Number(matched?.[1]) * 16).toBeGreaterThanOrEqual(
      disasterUi.minTapTargetPx,
    );
  });
});
