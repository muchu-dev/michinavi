import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 配色の回帰テスト。
 *
 * 画面の見た目そのものはテストで押さえられないが、「どの色の上にどの色の文字を
 * 置くか」は globals.css のトークンだけで決まる。ここでは WCAG 2.1 の
 * コントラスト比を実際に計算し、AA（通常の文字で 4.5:1）を割る組み合わせが
 * 入り込んだら落ちるようにする。
 *
 * あわせて、className に書いた色ユーティリティが本当に CSS を生成するかも見る。
 * Tailwind v4 は未定義のトークン（例: `bg-disabled`）に対して何も出さず、
 * エラーにもならないため、書いたつもりのスタイルが黙って効かない事故が起きる。
 */

// vitest は apps/frontend を作業ディレクトリにして動く（vitest.config.mts）
const frontendDir = process.cwd();
const srcDir = path.join(frontendDir, "src");
const appDir = path.join(srcDir, "app");
const globalsCss = readFileSync(path.join(appDir, "globals.css"), "utf8");

/** :root に書いたカスタムプロパティを 1 つ読む */
function token(name: string): string {
  const matched = globalsCss.match(
    new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8});`),
  );

  if (!matched?.[1]) {
    throw new Error(`--${name} が globals.css に見つかりません`);
  }

  return matched[1];
}

/** WCAG 2.1 の相対輝度 */
function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => {
    const raw = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [
    relativeLuminance(foreground),
    relativeLuminance(background),
  ].sort((left, right) => right - left) as [number, number];

  return (lighter + 0.05) / (darker + 0.05);
}

const WHITE = "#ffffff";
/** WCAG 2.1 AA。通常の大きさの文字 */
const AA_NORMAL_TEXT = 4.5;

describe("globals.css の配色", () => {
  it.each([
    ["--brand（ヘッダー・主要ボタン）", "brand"],
    ["--passable（通れる）", "passable"],
    ["--impassable（通れない）", "impassable"],
    ["--muted（無効状態のボタン）", "muted"],
  ])("%s の上の白文字が AA を満たす", (_label, name) => {
    expect(contrastRatio(WHITE, token(name))).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
  });

  it("--caution の面には白ではなく --caution-contrast を載せる想定になっている", () => {
    // 黄色に白文字（2.02:1）を載せていた回帰を防ぐ。
    // caution は地図の凡例と同じ色なので、変えるのは前景側だけにする
    expect(contrastRatio(WHITE, token("caution"))).toBeLessThan(AA_NORMAL_TEXT);
    expect(
      contrastRatio(token("caution-contrast"), token("caution")),
    ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it("--caution-soft の上の --caution-ink が AA を満たす", () => {
    expect(
      contrastRatio(token("caution-ink"), token("caution-soft")),
    ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it.each([
    "background",
    "surface",
    "app-surface",
    "app-canvas",
  ])("--%s の上の本文色が AA を満たす", (name) => {
    expect(
      contrastRatio(token("foreground"), token(name)),
    ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});

/** className に書かれうる色・装飾のユーティリティだけを拾う */
const UTILITY_PATTERN =
  /^(bg|text|border|outline|ring|fill|stroke|divide|accent|decoration|placeholder|caret|shadow|from|via|to)-[a-z]+(-[a-z]+)*$/;

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectSourceFiles(full);
    }
    if (entry.name.endsWith(".test.tsx") || entry.name.endsWith(".test.ts")) {
      return [];
    }

    return entry.name.endsWith(".tsx") ? [full] : [];
  });
}

function collectUtilityCandidates(): string[] {
  const found = new Set<string>();

  for (const file of collectSourceFiles(srcDir)) {
    for (const word of readFileSync(file, "utf8").split(/[\s"'`{}()]+/)) {
      // `disabled:bg-disabled` のようなバリアント付きは基底だけを見る
      const base = word.split(":").at(-1) ?? "";

      if (UTILITY_PATTERN.test(base)) {
        found.add(base);
      }
    }
  }

  return [...found].sort();
}

describe("Tailwind のユーティリティ", () => {
  it("className に書いた色・装飾のユーティリティがすべて CSS を生成する", async () => {
    const { compile } = await import("tailwindcss");
    const tailwindRoot = path.join(frontendDir, "node_modules/tailwindcss");

    const compiler = await compile(globalsCss, {
      base: appDir,
      loadStylesheet: async (id, base) => {
        const resolved = id.startsWith(".")
          ? path.resolve(base, id)
          : path.resolve(
              tailwindRoot,
              id === "tailwindcss"
                ? "index.css"
                : id.replace(/^tailwindcss\//, ""),
            );

        return {
          path: resolved,
          base: path.dirname(resolved),
          content: readFileSync(resolved, "utf8"),
        };
      },
    });

    const candidates = collectUtilityCandidates();
    const css = compiler.build(candidates);
    const missing = candidates.filter(
      (candidate) => !css.includes(`.${candidate}`),
    );

    // 一件も拾えていないと、この検査自体が空振りになる
    expect(candidates.length).toBeGreaterThan(20);
    expect(missing).toEqual([]);
  });
});
