import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

import { OnboardingFlow } from "./onboarding-flow";

afterEach(() => {
  cleanup();
  routerPush.mockReset();
});

function chooseProfile() {
  fireEvent.click(screen.getByRole("radio", { name: "年代 30代" }));
  fireEvent.click(screen.getByRole("radio", { name: "性別 その他" }));
}

async function reachProfileStep() {
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
  await screen.findByRole("heading", { name: "家族とつながる" });
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
}

async function reachNeedsStep() {
  await reachProfileStep();
  chooseProfile();
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
}

describe("OnboardingFlow", () => {
  it("renders the Figma onboarding sequence after the login screen", async () => {
    render(<OnboardingFlow requestPermissions={vi.fn()} />);

    expect(
      screen.getByRole("heading", {
        name: "現在地の危険をお知らせ",
      }),
    ).toBeDefined();
    expect(document.querySelector("img")?.getAttribute("src")).toBe(
      "/icons/onboarding-permissions.svg",
    );
    expect(screen.getByText("ステップ 1 / 6")).toBeDefined();

    await reachProfileStep();
    expect(
      screen.getByRole("heading", { name: "あなたについて" }),
    ).toBeDefined();
  });

  it("requires age and gender with errors linked to their groups", async () => {
    render(<OnboardingFlow requestPermissions={vi.fn()} />);
    await reachProfileStep();

    fireEvent.click(screen.getByRole("button", { name: "次へ" }));

    expect(screen.getByRole("alert").textContent).toContain(
      "年代を選択してください。",
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "性別を選択してください。",
    );
  });

  it("preserves selected answers when moving back", async () => {
    render(<OnboardingFlow requestPermissions={vi.fn()} />);
    await reachNeedsStep();

    fireEvent.click(screen.getByRole("button", { name: "戻る" }));

    expect(
      (screen.getByRole("radio", { name: "年代 30代" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      (screen.getByRole("radio", { name: "性別 その他" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
  });

  it("continues after permission denial and never traps the user", async () => {
    const requestPermissions = vi.fn(async () => ({
      geolocation: "denied" as const,
      notifications: "denied" as const,
    }));
    render(<OnboardingFlow requestPermissions={requestPermissions} />);

    fireEvent.click(screen.getByRole("button", { name: "次へ" }));

    expect(
      await screen.findByRole("heading", { name: "家族とつながる" }),
    ).toBeDefined();
    expect(requestPermissions).toHaveBeenCalledOnce();
  });

  it("continues when browser permission APIs are unavailable", async () => {
    render(<OnboardingFlow />);

    fireEvent.click(screen.getByRole("button", { name: "次へ" }));

    expect(
      await screen.findByRole("heading", { name: "家族とつながる" }),
    ).toBeDefined();
  });

  it("reports missing special-needs, household, and place fields", async () => {
    render(<OnboardingFlow requestPermissions={vi.fn()} />);
    await reachNeedsStep();

    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByRole("alert").textContent).toContain(
      "ペットの有無を選択してください。",
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "自動車の有無を選択してください。",
    );

    fireEvent.click(screen.getByRole("radio", { name: "ペット なし" }));
    fireEvent.click(screen.getByRole("radio", { name: "自動車 あり" }));
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByRole("alert").textContent).toContain(
      "世帯人数を1〜20人で入力してください。",
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "要配慮者について選択してください。",
    );

    fireEvent.change(screen.getByLabelText("世帯人数"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "なし" }));
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByRole("alert").textContent).toContain(
      "場所の設定方法を選択してください。",
    );

    fireEvent.click(
      screen.getByRole("radio", { name: "現在地から自動で設定する" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByRole("alert").textContent).toContain(
      "現在地を取得できません。",
    );

    fireEvent.click(screen.getByRole("radio", { name: "郵便番号から入力" }));
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByRole("alert").textContent).toContain(
      "郵便番号を7桁で入力してください。",
    );
    fireEvent.change(screen.getByLabelText("郵便番号"), {
      target: { value: "710-0001" },
    });
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    fireEvent.click(screen.getByRole("button", { name: "はじめる" }));

    expect(routerPush).toHaveBeenCalledWith("/");
  });

  it("validates each remaining input step and finishes the preview flow", async () => {
    const onFinish = vi.fn();
    render(<OnboardingFlow onFinish={onFinish} requestPermissions={vi.fn()} />);
    await reachNeedsStep();

    fireEvent.click(screen.getByRole("radio", { name: "ペット あり" }));
    fireEvent.click(screen.getByRole("radio", { name: "自動車 なし" }));
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));

    expect(
      screen.getByRole("heading", { name: "ご家族について" }),
    ).toBeDefined();
    fireEvent.change(screen.getByLabelText("世帯人数"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "乳幼児" }));
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));

    expect(
      screen.getByRole("heading", {
        name: "よく過ごす場所（ご自宅など）",
      }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("radio", { name: "都道府県から入力" }));
    fireEvent.change(screen.getByLabelText("都道府県"), {
      target: { value: "岡山県" },
    });
    fireEvent.change(screen.getByLabelText("市区町村"), {
      target: { value: "倉敷市" },
    });
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));

    expect(
      screen.getByRole("heading", { name: "設定が完了しました。" }),
    ).toBeDefined();
    expect(
      screen.getByText(/入力内容はまだサーバーに保存されません/),
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "はじめる" }));
    expect(onFinish).toHaveBeenCalledOnce();
  });
});
