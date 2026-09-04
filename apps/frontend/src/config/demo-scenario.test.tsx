import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { demoScenario, demoTimeboxMinutes } from "./demo-scenario";

/** ルートに対応する page.tsx の場所。すべて (app) の下にある */
function pagePathFor(route: string): string {
  const segment = route === "/" ? "" : route;

  return resolve(process.cwd(), `src/app/(app)${segment}/page.tsx`);
}

/**
 * 投稿が地図に出ることを見せる手順。
 *
 * 投稿を取得して地図へ描くのは、いまは投稿タブだけである。
 * 投稿を読まない画面へこれらの手順を向けると、発表でその場で詰まる。
 */
const stepIdsThatShowPosts = ["map-overview", "post-report", "map-after-post"];

describe("demo scenario (FE-21)", () => {
  it("keeps the steps in an unbroken order", () => {
    expect(demoScenario.map((step) => step.order)).toEqual(
      demoScenario.map((_, index) => index + 1),
    );
  });

  it("keeps every step id unique so the walkthrough record stays correct", () => {
    const ids = demoScenario.map((step) => step.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("points every step at a screen that exists", () => {
    for (const step of demoScenario) {
      expect(
        existsSync(pagePathFor(step.route)),
        `${step.id} の行き先 ${step.route} に画面がありません`,
      ).toBe(true);
    }
  });

  it("points the steps about posts at a screen that really loads them", () => {
    for (const id of stepIdsThatShowPosts) {
      const step = demoScenario.find((candidate) => candidate.id === id);

      expect(step, `${id} の手順が台本にありません`).toBeDefined();

      const source = readFileSync(pagePathFor(step?.route ?? "/"), "utf8");

      expect(
        source.includes("fieldReport"),
        `${id} の行き先 ${step?.route} は投稿を読んでいないため、発表で詰まります`,
      ).toBe(true);
    }
  });

  it("tells the presenter what to do, what to say, and what data is needed", () => {
    for (const step of demoScenario) {
      expect(step.operation.length).toBeGreaterThan(0);
      expect(step.talkingPoint.length).toBeGreaterThan(0);
      expect(step.requires.length).toBeGreaterThan(0);
    }
  });

  it("fits a walkthrough into the presentation timebox", () => {
    expect(demoTimeboxMinutes).toBeGreaterThan(0);
    // 1 手順あたり 1 分を切れないと 5 分に収まらない
    expect(demoScenario.length).toBeLessThanOrEqual(demoTimeboxMinutes);
  });
});
