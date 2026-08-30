import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { hasCompletedOnboarding, redirect } = vi.hoisted(() => ({
  hasCompletedOnboarding: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/lib/onboarding/completion", () => ({ hasCompletedOnboarding }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/components/onboarding/onboarding-flow", () => ({
  OnboardingFlow: () => <div>onboarding flow</div>,
}));

import OnboardingPage from "./page";

beforeEach(() => {
  hasCompletedOnboarding.mockReset();
  redirect.mockClear();
});

describe("OnboardingPage", () => {
  it("renders onboarding when setup is incomplete", async () => {
    hasCompletedOnboarding.mockResolvedValue(false);

    render(await OnboardingPage());

    expect(screen.getByText("onboarding flow")).not.toBeNull();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects users with completed setup to the map", async () => {
    hasCompletedOnboarding.mockResolvedValue(true);

    await expect(
      Promise.resolve().then(() => OnboardingPage()),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/");
  });
});
