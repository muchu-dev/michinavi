"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PREFECTURES } from "@/lib/address/prefectures";

type PermissionState = "granted" | "denied" | "unsupported";
type PermissionResult = {
  geolocation: PermissionState;
  notifications: PermissionState;
};

type OnboardingFlowProps = {
  onFinish?: () => void;
  requestPermissions?: () => Promise<PermissionResult> | undefined;
};

type Draft = {
  age: string;
  gender: string;
  pet: string;
  car: string;
  householdCount: string;
  careNeeds: string[];
  placeMethod: string;
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine: string;
};

const initialDraft: Draft = {
  age: "",
  gender: "",
  pet: "",
  car: "",
  householdCount: "",
  careNeeds: [],
  placeMethod: "",
  postalCode: "",
  prefecture: "",
  city: "",
  addressLine: "",
};

const ages = ["-10代", "20代", "30代", "40代", "50代", "60代", "70代-"];
const genders = ["男性", "女性", "その他"];
const yesNo = ["あり", "なし"];
const progressSteps = [1, 2, 3, 4, 5, 6];
const chipClass =
  "relative flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-sm font-bold transition-colors has-checked:border-brand has-checked:bg-brand has-checked:text-white hover:border-brand focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-brand";
const inputClass =
  "min-h-12 w-full rounded-xl border border-outline bg-white px-4 text-base outline-none focus:border-brand focus:ring-3 focus:ring-brand/20";

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

function ChoiceGroup({
  label,
  name,
  options,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-black">{label}</legend>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <label className={chipClass} key={option}>
            <input
              aria-label={`${label} ${option}`}
              checked={value === option}
              className="sr-only"
              name={name}
              onChange={() => onChange(option)}
              type="radio"
              value={option}
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function StepHeading({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-balance text-2xl font-black leading-tight text-foreground">
      {children}
    </h1>
  );
}

export function OnboardingFlow({
  onFinish,
  requestPermissions = defaultRequestPermissions,
}: OnboardingFlowProps) {
  const router = useRouter();
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(initialDraft);
  const [errors, setErrors] = useState<string[]>([]);
  const [permissionResult, setPermissionResult] =
    useState<PermissionResult | null>(null);
  const [isRequestingPermissions, setIsRequestingPermissions] = useState(false);

  useEffect(() => {
    if (errors.length > 0) errorSummaryRef.current?.focus();
  }, [errors]);

  const updateDraft = <Key extends keyof Draft>(
    key: Key,
    value: Draft[Key],
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
              className="flex gap-2"
              role="progressbar"
              aria-valuemax={6}
              aria-valuemin={1}
              aria-valuenow={step + 1}
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
            {step === 0 ? (
              <div className="text-center">
                <Image
                  alt=""
                  aria-hidden="true"
                  className="mx-auto mb-6 h-[57px] w-[116px]"
                  height={172}
                  src="/icons/onboarding-permissions.svg"
                  width={348}
                />
                <StepHeading>現在地の危険をお知らせ</StepHeading>
                <p className="mx-auto mt-5 max-w-xs text-base font-bold leading-8">
                  位置情報と通知を
                  <br />
                  許可してください。
                </p>
                <p className="mx-auto mt-4 max-w-sm text-sm leading-7 text-muted">
                  現在地周辺の道路状況や避難情報をお知らせします。許可しなくても、設定は続けられます。
                </p>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="text-center">
                <Image
                  alt=""
                  aria-hidden="true"
                  className="mx-auto mb-6 size-20"
                  height={80}
                  src="/icons/nav-family.svg"
                  width={80}
                />
                <StepHeading>家族とつながる</StepHeading>
                <p className="mt-5 text-base font-bold leading-8">
                  あなたとご家族について
                  <br />
                  教えてください。
                </p>
                <p className="mt-4 text-sm text-muted">
                  いつでも設定から変更できます。
                </p>
              </div>
            ) : null}

            {step === 2 ? (
              <div>
                <StepHeading>あなたについて</StepHeading>
                <div className="mt-7 space-y-8">
                  <ChoiceGroup
                    label="年代"
                    name="age"
                    onChange={(value) => updateDraft("age", value)}
                    options={ages}
                    value={draft.age}
                  />
                  <ChoiceGroup
                    label="性別"
                    name="gender"
                    onChange={(value) => updateDraft("gender", value)}
                    options={genders}
                    value={draft.gender}
                  />
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div>
                <StepHeading>特別な配慮・準備は必要ですか？</StepHeading>
                <div className="mt-7 space-y-8">
                  <ChoiceGroup
                    label="ペット"
                    name="pet"
                    onChange={(value) => updateDraft("pet", value)}
                    options={yesNo}
                    value={draft.pet}
                  />
                  <ChoiceGroup
                    label="自動車"
                    name="car"
                    onChange={(value) => updateDraft("car", value)}
                    options={yesNo}
                    value={draft.car}
                  />
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div>
                <StepHeading>ご家族について</StepHeading>
                <p className="mt-3 text-sm font-bold leading-6">
                  一緒に避難される方は何人ですか？
                </p>
                <div className="mt-6">
                  <label
                    className="mb-2 block text-sm font-black"
                    htmlFor="household-count"
                  >
                    世帯人数
                  </label>
                  <div className="relative">
                    <input
                      className={`${inputClass} pr-12`}
                      id="household-count"
                      inputMode="numeric"
                      max={20}
                      min={1}
                      onChange={(event) =>
                        updateDraft("householdCount", event.target.value)
                      }
                      type="number"
                      value={draft.householdCount}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-bold text-muted">
                      人
                    </span>
                  </div>
                </div>
                <fieldset className="mt-8">
                  <legend className="mb-3 text-sm font-black">要配慮者</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {["乳幼児", "障がい者", "なし"].map((need) => (
                      <label className={chipClass} key={need}>
                        <input
                          checked={draft.careNeeds.includes(need)}
                          className="sr-only"
                          onChange={() => toggleCareNeed(need)}
                          type="checkbox"
                        />
                        {need}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            ) : null}

            {step === 5 ? (
              <div>
                <StepHeading>よく過ごす場所（ご自宅など）</StepHeading>
                <p className="mt-3 text-sm leading-6 text-muted">
                  地域の避難情報を表示するために使います。
                </p>
                <fieldset className="mt-6 space-y-3">
                  <legend className="sr-only">場所の設定方法</legend>
                  {[
                    ["current", "現在地から自動で設定する"],
                    ["postal", "郵便番号から入力"],
                    ["region", "都道府県から入力"],
                  ].map(([value, label]) => (
                    <label
                      className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-outline px-4 font-bold has-checked:border-brand has-checked:bg-brand-soft/35 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-brand"
                      key={value}
                    >
                      <input
                        checked={draft.placeMethod === value}
                        className="size-5 accent-brand"
                        name="place-method"
                        onChange={() => updateDraft("placeMethod", value)}
                        type="radio"
                        value={value}
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>

                {draft.placeMethod === "postal" ? (
                  <div className="mt-6">
                    <label
                      className="mb-2 block text-sm font-black"
                      htmlFor="postal-code"
                    >
                      郵便番号
                    </label>
                    <input
                      autoComplete="postal-code"
                      className={inputClass}
                      id="postal-code"
                      inputMode="numeric"
                      onChange={(event) =>
                        updateDraft("postalCode", event.target.value)
                      }
                      placeholder="000-0000"
                      value={draft.postalCode}
                    />
                  </div>
                ) : null}

                {draft.placeMethod === "region" ? (
                  <div className="mt-6 space-y-5">
                    <div>
                      <label
                        className="mb-2 block text-sm font-black"
                        htmlFor="prefecture"
                      >
                        都道府県
                      </label>
                      <select
                        className={inputClass}
                        id="prefecture"
                        onChange={(event) =>
                          updateDraft("prefecture", event.target.value)
                        }
                        value={draft.prefecture}
                      >
                        <option value="">選択してください</option>
                        {PREFECTURES.map((prefecture) => (
                          <option key={prefecture}>{prefecture}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        className="mb-2 block text-sm font-black"
                        htmlFor="city"
                      >
                        市区町村
                      </label>
                      <input
                        autoComplete="address-level2"
                        className={inputClass}
                        id="city"
                        onChange={(event) =>
                          updateDraft("city", event.target.value)
                        }
                        placeholder="例：倉敷市"
                        value={draft.city}
                      />
                    </div>
                    <div>
                      <label
                        className="mb-2 block text-sm font-black"
                        htmlFor="address-line"
                      >
                        丁目・番地・建物名（任意）
                      </label>
                      <input
                        autoComplete="street-address"
                        className={inputClass}
                        id="address-line"
                        onChange={(event) =>
                          updateDraft("addressLine", event.target.value)
                        }
                        value={draft.addressLine}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === 6 ? (
              <div className="pt-6 text-center">
                <Image
                  alt="みちナビ"
                  className="mx-auto size-36"
                  height={144}
                  src="/michinavi-logo.svg"
                  width={144}
                />
                <StepHeading>設定が完了しました。</StepHeading>
                <p className="mt-4 text-sm leading-7 text-muted">
                  いつでも設定から変更できます。
                </p>
                <p className="mt-6 rounded-xl bg-caution-soft px-4 py-3 text-left text-sm font-bold leading-6 text-caution-ink">
                  現在は画面確認用です。入力内容はまだサーバーに保存されません。
                </p>
              </div>
            ) : null}
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
