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

  it("--caution の面に白文字を載せている className がソースに無い", () => {
    // 地図の吹き出しのバッジ（road-status-summary）が
    // `bg-caution text-white`（2.02:1）のままだった回帰を防ぐ。
    // 面の色は地図の凡例と揃えるので、直すのは前景側だけにする
    const literals = collectSourceFiles(srcDir).flatMap((file) =>
      classLiterals(readFileSync(file, "utf8")).map((literal) => ({
        file: path.relative(srcDir, file),
        literal,
      })),
    );
    const onCaution = literals.filter((entry) =>
      /bg-caution(?![-\w])/.test(entry.literal),
    );
    const offenders = onCaution
      .filter((entry) => /text-white(?![-\w/])/.test(entry.literal))
      .map((entry) => `${entry.file}: ${entry.literal}`);

    // 一件も拾えていないと、この検査自体が空振りになる
    expect(onCaution.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
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

/**
 * ソースから className に書かれうる文字列リテラルを取り出す。
 * `"bg-caution text-white"` のように、同じリテラルへ並べて書かれた
 * 面の色と前景色の組み合わせを見るために使う。
 */
function classLiterals(source: string): string[] {
  return [...source.matchAll(/(["`])((?:\\.|[^\\])*?)\1/g)].map(
    (match) => match[2] ?? "",
  );
}

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

/**
 * 半透明ユーティリティ（`text-white/80`、`hover:bg-brand/90` など）を
 * 下地に合成して、実際に画面へ出る色を求める。
 * 不透明なトークン同士だけを測っていると、半透明で薄まった結果 AA を割る状態を
 * 見逃してしまうため、利用箇所の重ね順どおりに合成してから比を取る。
 */
function blend(foreground: string, alpha: number, background: string): string {
  const channel = (hex: string, offset: number) =>
    Number.parseInt(hex.replace("#", "").slice(offset, offset + 2), 16);

  return `#${[0, 2, 4]
    .map((offset) =>
      Math.round(
        alpha * channel(foreground, offset) +
          (1 - alpha) * channel(background, offset),
      )
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

type Layer = {
  /** 実際に className に書かれているユーティリティ */
  readonly utility: string;
  readonly color: string;
  /** `/90` のような不透明度。付いていなければ 1 */
  readonly alpha: number;
};

/** 下地の上に層を順に重ねて、一番上に見える色を返す */
function flatten(base: string, layers: readonly Layer[]): string {
  return layers.reduce(
    (under, layer) => blend(layer.color, layer.alpha, under),
    base,
  );
}

function readSource(relative: string): string {
  return readFileSync(path.join(srcDir, relative), "utf8");
}

/**
 * 白文字を載せている面を、利用箇所・状態ごとに並べたもの。
 * 「その className が本当に書かれているか」と「合成後の比が AA を満たすか」を
 * 両方見るので、半透明クラスへ戻すと落ちる。
 */
const COMPOSED_CASES = [
  {
    label: "ヘッダーと「デモ」バッジ（app-shell）",
    file: "components/app-shell/app-shell.tsx",
    base: token("surface"),
    background: [{ utility: "bg-brand", color: token("brand"), alpha: 1 }],
    foreground: { utility: "text-white", color: WHITE, alpha: 1 },
    others: ["text-current", "border-current"],
  },
  {
    label: "初回設定の主要ボタン・通常時（onboarding）",
    file: "components/onboarding/onboarding-flow.tsx",
    base: token("surface"),
    background: [{ utility: "bg-brand", color: token("brand"), alpha: 1 }],
    foreground: { utility: "text-white", color: WHITE, alpha: 1 },
    others: [],
  },
  {
    label: "初回設定の主要ボタン・hover 時（onboarding）",
    file: "components/onboarding/onboarding-flow.tsx",
    base: token("surface"),
    background: [
      {
        utility: "hover:bg-brand-strong",
        color: token("brand-strong"),
        alpha: 1,
      },
    ],
    foreground: { utility: "text-white", color: WHITE, alpha: 1 },
    others: [],
  },
  {
    label: "初回設定の主要ボタン・無効時（onboarding）",
    file: "components/onboarding/onboarding-flow.tsx",
    base: token("surface"),
    background: [
      { utility: "disabled:bg-muted", color: token("muted"), alpha: 1 },
    ],
    foreground: { utility: "text-white", color: WHITE, alpha: 1 },
    others: [],
  },
  {
    label: "ログインボタン・hover 時（半透明だが合成後も足りている例）",
    file: "components/auth/login-form.tsx",
    base: token("surface"),
    background: [
      {
        utility: "hover:bg-foreground/90",
        color: token("foreground"),
        alpha: 0.9,
      },
    ],
    foreground: { utility: "text-white", color: WHITE, alpha: 1 },
    others: [],
  },
] as const;

describe("半透明を合成したあとの実表示色", () => {
  it.each(
    COMPOSED_CASES.map((testCase) => [testCase.label, testCase] as const),
  )("%s が AA を満たす", (_label, testCase) => {
    const source = readSource(testCase.file);

    for (const utility of [
      ...testCase.background.map((layer) => layer.utility),
      testCase.foreground.utility,
      ...testCase.others,
    ]) {
      expect(source).toContain(utility);
    }

    const background = flatten(testCase.base, testCase.background);
    const foreground = blend(
      testCase.foreground.color,
      testCase.foreground.alpha,
      background,
    );

    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
  });

  it("以前使っていた半透明の組み合わせは、合成すると AA を割る", () => {
    // app-shell のヘッダー補足文にあった text-white/80 → 実表示 #dbe3f0 で 3.70:1
    expect(
      contrastRatio(blend(WHITE, 0.8, token("brand")), token("brand")),
    ).toBeLessThan(AA_NORMAL_TEXT);
    // 主要ボタンの hover:bg-brand/90 → 実表示 #5f80bc で 3.96:1
    expect(
      contrastRatio(WHITE, blend(token("brand"), 0.9, token("surface"))),
    ).toBeLessThan(AA_NORMAL_TEXT);
    // 「デモ」バッジの bg-white/12 → 実表示 #6283be で 3.81:1
    expect(
      contrastRatio(WHITE, blend(WHITE, 0.12, token("brand"))),
    ).toBeLessThan(AA_NORMAL_TEXT);
  });

  it("その半透明クラスがソースに残っていない", () => {
    const banned = ["text-white/80", "bg-brand/90", "bg-white/12"];
    const offenders = collectSourceFiles(srcDir).flatMap((file) => {
      const source = readFileSync(file, "utf8");

      return banned
        .filter((utility) => source.includes(utility))
        .map((utility) => `${path.relative(srcDir, file)}: ${utility}`);
    });

    expect(offenders).toEqual([]);
  });

  it("文字色そのものには半透明ユーティリティを使わない", () => {
    const offenders = collectSourceFiles(srcDir).flatMap((file) =>
      readFileSync(file, "utf8")
        .split(/[\s"'`{}()]+/)
        // `hover:text-white/80` のようなバリアント付きは基底だけを見る
        .map((word) => word.split(":").at(-1) ?? "")
        .filter((base) => /^text-[a-z-]+\/\d+$/.test(base))
        .map((base) => `${path.relative(srcDir, file)}: ${base}`),
    );

    expect(offenders).toEqual([]);
  });
});
