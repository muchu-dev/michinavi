import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { hasCompletedOnboarding } from "@/lib/onboarding/completion";

export const metadata: Metadata = {
  title: "初回設定",
  description: "みちナビを利用するための初回設定を行います。",
};

export default async function OnboardingPage() {
  if (await hasCompletedOnboarding()) {
    redirect("/");
  }

  return <OnboardingFlow />;
}
