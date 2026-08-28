import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const metadata: Metadata = {
  title: "初回設定",
  description: "みちナビを利用するための初回設定を行います。",
};

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
