import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { demoScenario } from "@/config/demo-scenario";
import DemoWalkthroughPage from "./page";

const STORAGE_KEY = "michinavi.demo-walkthrough.v1";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("DemoWalkthroughPage", () => {
  it("lists every step of the scenario in order", () => {
    render(<DemoWalkthroughPage />);

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);

    expect(headings).toEqual(demoScenario.map((step) => step.title));
  });

  it("links each step to the screen it shows", () => {
    render(<DemoWalkthroughPage />);

    const links = screen.getAllByRole("link", { name: "この画面を開く" });

    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      demoScenario.map((step) => step.route),
    );
  });

  it("counts the steps that made it through without a stumble", () => {
    render(<DemoWalkthroughPage />);

    expect(
      screen.getByText(`確認できた手順：0 / ${demoScenario.length}`),
    ).toBeTruthy();

    fireEvent.click(screen.getAllByRole("checkbox")[0] as HTMLInputElement);

    expect(
      screen.getByText(`確認できた手順：1 / ${demoScenario.length}`),
    ).toBeTruthy();
  });

  it("keeps the record so the check can continue after leaving the screen", async () => {
    render(<DemoWalkthroughPage />);
    fireEvent.click(screen.getAllByRole("checkbox")[0] as HTMLInputElement);

    expect(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]"),
    ).toEqual([demoScenario[0]?.id]);

    cleanup();
    render(<DemoWalkthroughPage />);

    expect(
      await screen.findByText(`確認できた手順：1 / ${demoScenario.length}`),
    ).toBeTruthy();
  });

  it("can start the walkthrough over", () => {
    render(<DemoWalkthroughPage />);
    fireEvent.click(screen.getAllByRole("checkbox")[0] as HTMLInputElement);

    fireEvent.click(screen.getByRole("button", { name: "確認の記録を消す" }));

    expect(
      screen.getByText(`確認できた手順：0 / ${demoScenario.length}`),
    ).toBeTruthy();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("[]");
  });

  it("shows what to fall back on when a step does not work", () => {
    render(<DemoWalkthroughPage />);

    const withFallback = demoScenario.filter((step) => step.fallback !== null);

    for (const step of withFallback) {
      expect(screen.getByText(`詰まったとき：${step.fallback}`)).toBeTruthy();
    }
  });
});
