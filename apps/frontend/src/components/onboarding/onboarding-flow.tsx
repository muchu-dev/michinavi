"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  INITIAL_ONBOARDING_DRAFT,
  type PermissionResult,
  type PermissionState,
} from "./onboarding-types";
import { CompletionStep } from "./steps/completion-step";
import { FamilyIntroStep } from "./steps/family-intro-step";
import { HouseholdStep } from "./steps/household-step";
import { LocationStep } from "./steps/location-step";
import { NeedsStep } from "./steps/needs-step";
import { PermissionsStep } from "./steps/permissions-step";
import { ProfileStep } from "./steps/profile-step";

type OnboardingFlowProps = {
  onFinish?: () => void;
  requestPermissions?: () => Promise<PermissionResult> | undefined;
};

const progressSteps = [1, 2, 3, 4, 5, 6];

async function defaultRequestPermissions(): Promise<PermissionResult> {
  const geolocationRequest = new Promise<PermissionState>((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve("unsupported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => resolve("granted"),
      () => resolve("denied"),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 8_000 },
    );
  });

  const notificationRequest: Promise<PermissionState> =
    "Notification" in window
      ? Notification.requestPermission().then((permission) =>
          permission === "granted" ? "granted" : "denied",
        )
      : Promise.resolve("unsupported");

  const [geolocation, notifications] = await Promise.all([
    geolocationRequest,
    notificationRequest,
  ]);

  return { geolocation, notifications };
}

export function OnboardingFlow({
  onFinish,
  requestPermissions = defaultRequestPermissions,
}: OnboardingFlowProps) {
  const router = useRouter();
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(INITIAL_ONBOARDING_DRAFT);
  const [errors, setErrors] = useState<string[]>([]);
  const [permissionResult, setPermissionResult] =
    useState<PermissionResult | null>(null);
  const [isRequestingPermissions, setIsRequestingPermissions] = useState(false);

  useEffect(() => {
    if (errors.length > 0) errorSummaryRef.current?.focus();
  }, [errors]);

  const updateDraft = <Key extends keyof typeof draft>(
    key: Key,
    value: (typeof draft)[Key],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors([]);
  };

  const validateStep = () => {
    const nextErrors: string[] = [];

    if (step === 2) {
      if (!draft.age) nextErrors.push("年代を選択してください。");
      if (!draft.gender) nextErrors.push("性別を選択してください。");
    }
    if (step === 3) {
      if (!draft.pet) nextErrors.push("ペットの有無を選択してください。");
      if (!draft.car) nextErrors.push("自動車の有無を選択してください。");
    }
    if (step === 4) {
      const count = Number(draft.householdCount);
      if (!Number.isInteger(count) || count < 1 || count > 20) {
        nextErrors.push("世帯人数を1〜20人で入力してください。");
      }
      if (draft.careNeeds.length === 0) {
        nextErrors.push("要配慮者について選択してください。");
      }
    }
    if (step === 5) {
      if (!draft.placeMethod) {
        nextErrors.push("場所の設定方法を選択してください。");
      } else if (
        draft.placeMethod === "postal" &&
        !/^\d{3}-?\d{4}$/.test(draft.postalCode)
      ) {
        nextErrors.push("郵便番号を7桁で入力してください。");
      } else if (
        draft.placeMethod === "region" &&
        (!draft.prefecture || !draft.city.trim())
      ) {
        nextErrors.push("都道府県と市区町村を入力してください。");
      } else if (
        draft.placeMethod === "current" &&
        permissionResult?.geolocation !== "granted"
      ) {
        nextErrors.push(
          "現在地を取得できません。郵便番号または都道府県から入力してください。",
        );
      }
    }

    setErrors(nextErrors);
    return nextErrors.length === 0;
  };

  const goNext = async () => {
    if (step === 0) {
      setIsRequestingPermissions(true);
      try {
        const result = await Promise.resolve(requestPermissions());
        if (result) setPermissionResult(result);
      } finally {
        setIsRequestingPermissions(false);
        setStep(1);
      }
      return;
    }

    if (validateStep()) setStep((current) => current + 1);
  };

  const toggleCareNeed = (need: string) => {
    if (need === "なし") {
      updateDraft(
        "careNeeds",
        draft.careNeeds.includes("なし") ? [] : ["なし"],
      );
      return;
    }

    const withoutNone = draft.careNeeds.filter((item) => item !== "なし");
    updateDraft(
      "careNeeds",
      withoutNone.includes(need)
        ? withoutNone.filter((item) => item !== need)
        : [...withoutNone, need],
    );
  };

  const finish = () => {
    if (onFinish) {
      onFinish();
      return;
    }
    router.replace("/");
  };

  return (
    <main className="min-h-dvh bg-app-canvas px-0 sm:px-4 sm:py-8">
      <section className="mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-hidden bg-surface shadow-app sm:min-h-[calc(100dvh-4rem)] sm:rounded-[2rem]">
        <header className="bg-brand px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-center text-white">
          <p className="text-base font-black tracking-[0.12em]">みちナビ</p>
        </header>

        {step < 6 ? (
          <div className="border-b border-outline px-5 py-3">
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-muted">
              <span>初回設定</span>
              <span>ステップ {step + 1} / 6</span>
            </div>
            <div
              aria-label={`初回設定の進捗 ${step + 1}/6`}
              aria-valuemax={6}
              aria-valuemin={1}
              aria-valuenow={step + 1}
              className="flex gap-2"
              role="progressbar"
            >
              {progressSteps.map((progressStep) => (
                <span
                  className={`h-1.5 flex-1 rounded-full ${progressStep <= step + 1 ? "bg-brand" : "bg-outline"}`}
                  key={progressStep}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-1 flex-col px-5 py-8 sm:px-7">
          <div className="flex-1">
            {step === 0 ? <PermissionsStep /> : null}
            {step === 1 ? <FamilyIntroStep /> : null}
            {step === 2 ? (
              <ProfileStep draft={draft} updateDraft={updateDraft} />
            ) : null}
            {step === 3 ? (
              <NeedsStep draft={draft} updateDraft={updateDraft} />
            ) : null}
            {step === 4 ? (
              <HouseholdStep
                draft={draft}
                onToggleCareNeed={toggleCareNeed}
                updateDraft={updateDraft}
              />
            ) : null}
            {step === 5 ? (
              <LocationStep draft={draft} updateDraft={updateDraft} />
            ) : null}
            {step === 6 ? <CompletionStep /> : null}
          </div>

          {errors.length > 0 ? (
            <div
              className="mt-6 rounded-xl bg-impassable-soft px-4 py-3 text-sm font-bold leading-6 text-impassable"
              ref={errorSummaryRef}
              role="alert"
              tabIndex={-1}
            >
              {errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}

          <div className="mt-8 flex gap-3 pb-[max(0rem,env(safe-area-inset-bottom))]">
            {step > 0 && step < 6 ? (
              <button
                className="min-h-12 w-28 rounded-xl border-2 border-brand bg-white px-4 font-black text-brand focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
                onClick={() => {
                  setErrors([]);
                  setStep((current) => current - 1);
                }}
                type="button"
              >
                戻る
              </button>
            ) : null}
            <button
              className="min-h-12 flex-1 rounded-xl bg-brand px-5 font-black text-white shadow-card transition-colors hover:bg-brand/90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-wait disabled:bg-muted"
              disabled={isRequestingPermissions}
              onClick={step === 6 ? finish : () => void goNext()}
              type="button"
            >
              {step === 6
                ? "はじめる"
                : isRequestingPermissions
                  ? "確認中…"
                  : "次へ"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
