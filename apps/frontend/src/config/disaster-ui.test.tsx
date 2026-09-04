import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  disasterUi,
  disasterUiCheckedFiles,
  leafletOverrides,
} from "./disaster-ui";

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

/**
 * Tailwind のクラスを通らない文字サイズ。
 * SVG の font-size 属性やインラインの style がここに入る。
 * クラスだけを見ていると、地図のピンに書いた 10px を見落とす。
 */
const RAW_FONT_SIZE = /font-size\s*[:=]\s*"?([\d.]+)(px|rem)?/g;

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

function readGlobalsCss(): string {
  // コメントの中の数値を宣言と読み違えないよう、先に落とす
  return readCheckedFile("src/app/globals.css").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
}

type CssRule = { selector: string; declarations: Map<string, string> };

/**
 * globals.css を「セレクタ→宣言」に分ける。
 * 入れ子（@media など）の外側は取り出せないが、中の規則は個別に拾える。
 */
function parseCssRules(css: string): CssRule[] {
  const rules: CssRule[] = [];

  for (const [, rawSelector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!rawSelector || body === undefined) {
      continue;
    }

    const declarations = new Map<string, string>();
    for (const declaration of body.split(";")) {
      const separator = declaration.indexOf(":");
      if (separator === -1) {
        continue;
      }
      declarations.set(
        declaration.slice(0, separator).trim(),
        declaration.slice(separator + 1).trim(),
      );
    }

    // @import のような文が直前にあると、そこまでセレクタに含まれてしまう
    const selectorList = rawSelector.split(";").at(-1) ?? "";
    for (const selector of selectorList.split(",")) {
      rules.push({ selector: selector.trim(), declarations });
    }
  }

  return rules;
}

const cssRules = parseCssRules(readGlobalsCss());

/** :root のカスタムプロパティ。同名は先に書いたほうを採る */
const rootTokens = new Map<string, string>();
for (const rule of cssRules) {
  if (rule.selector !== ":root") {
    continue;
  }
  for (const [name, value] of rule.declarations) {
    if (name.startsWith("--") && !rootTokens.has(name)) {
      rootTokens.set(name, value);
    }
  }
}

/** CSS の長さを px にする。var() は :root のトークンを一段だけたどる */
function cssLengthToPx(value: string): number | null {
  const variable = value.match(/^var\(\s*(--[a-z-]+)\s*\)$/);
  if (variable?.[1]) {
    const token = rootTokens.get(variable[1]);
    return token ? cssLengthToPx(token) : null;
  }

  const matched = value.match(/^([\d.]+)(px|rem)$/);
  if (!matched?.[1]) {
    return null;
  }

  return matched[2] === "rem" ? Number(matched[1]) * 16 : Number(matched[1]);
}

function findDeclaration(selector: string, property: string): string | null {
  for (const rule of cssRules) {
    if (rule.selector === selector) {
      const value = rule.declarations.get(property);
      if (value !== undefined) {
        return value;
      }
    }
  }

  return null;
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

    for (const [, size, unit] of source.matchAll(RAW_FONT_SIZE)) {
      if (!size) {
        continue;
      }

      const px = unit === "rem" ? Number(size) * 16 : Number(size);
      if (px < disasterUi.minSupportingFontPx) {
        tooSmall.push(`font-size ${size}${unit ?? ""}（${px}px）`);
      }
    }

    expect(tooSmall).toEqual([]);
  });

  it("keeps the checked file list pointing at files that exist", () => {
    for (const relativePath of disasterUiCheckedFiles) {
      expect(readCheckedFile(relativePath).length).toBeGreaterThan(0);
    }
  });

  it("checks the file that actually draws the map, not only its wrapper", () => {
    // map-view.tsx だけを見ていると、地図の実UIが基準から外れても気づけない
    expect(disasterUiCheckedFiles).toContain(
      "src/components/map/map-canvas.tsx",
    );
  });
});

describe("disaster UI stylesheet (FE-19)", () => {
  it("declares the supporting text minimum as a token", () => {
    const declared = rootTokens.get("--font-supporting-min");

    expect(declared).toBeTruthy();
    expect(cssLengthToPx(declared ?? "")).toBeGreaterThanOrEqual(
      disasterUi.minSupportingFontPx,
    );
  });

  it("keeps the shared tap-target helper at the documented size", () => {
    for (const property of ["min-width", "min-height"]) {
      const value = findDeclaration(".tap-target", property);

      expect(value).not.toBeNull();
      expect(cssLengthToPx(value ?? "")).toBeGreaterThanOrEqual(
        disasterUi.minTapTargetPx,
      );
    }
  });

  it("never sets a font size below the supporting minimum", () => {
    const tooSmall: string[] = [];

    for (const rule of cssRules) {
      const value = rule.declarations.get("font-size");
      const px = value === undefined ? null : cssLengthToPx(value);
      if (px !== null && px < disasterUi.minSupportingFontPx) {
        tooSmall.push(`${rule.selector}（${px}px）`);
      }
    }

    expect(tooSmall).toEqual([]);
  });
});

/**
 * Leaflet の既定値はアプリのコードに現れないので、上書きが消えても
 * 画面を見るまで気づけない。セレクタごとに数値で押さえておく。
 */
describe("Leaflet defaults are overridden for disaster use (FE-19)", () => {
  it.each([...leafletOverrides])("$usage meets the standard", ({
    selectors,
    properties,
    minPx,
  }) => {
    for (const selector of selectors) {
      for (const property of properties) {
        const value = findDeclaration(selector, property);

        if (value === null) {
          throw new Error(
            `globals.css に ${selector} の ${property} がありません`,
          );
        }

        expect(cssLengthToPx(value)).toBeGreaterThanOrEqual(minPx);
      }
    }
  });

  it("keeps the attribution readable instead of Leaflet's small print", () => {
    // 指摘のあった 10px が戻っていないことを、値そのもので確かめる
    const value = findDeclaration(".leaflet-control-attribution", "font-size");

    expect(cssLengthToPx(value ?? "")).toBeGreaterThanOrEqual(
      disasterUi.minSupportingFontPx,
    );
  });
});
