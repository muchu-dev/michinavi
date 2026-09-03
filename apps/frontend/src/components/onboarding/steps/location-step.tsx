import { PREFECTURES } from "@/lib/address/prefectures";
import { onboardingInputClass, StepHeading } from "../onboarding-controls";
import type {
  OnboardingDraft,
  UpdateOnboardingDraft,
} from "../onboarding-types";

const placeMethods = [
  ["current", "現在地から自動で設定する"],
  ["postal", "郵便番号から入力"],
  ["region", "都道府県から入力"],
] as const;

export function LocationStep({
  draft,
  updateDraft,
}: {
  draft: OnboardingDraft;
  updateDraft: UpdateOnboardingDraft;
}) {
  return (
    <div>
      <StepHeading>よく過ごす場所（ご自宅など）</StepHeading>
      <p className="mt-3 text-sm leading-6 text-muted">
        地域の避難情報を表示するために使います。
      </p>
      <fieldset className="mt-6 space-y-3">
        <legend className="sr-only">場所の設定方法</legend>
        {placeMethods.map(([value, label]) => (
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
            className={onboardingInputClass}
            id="postal-code"
            inputMode="numeric"
            onChange={(event) => updateDraft("postalCode", event.target.value)}
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
              className={onboardingInputClass}
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
            <label className="mb-2 block text-sm font-black" htmlFor="city">
              市区町村
            </label>
            <input
              autoComplete="address-level2"
              className={onboardingInputClass}
              id="city"
              onChange={(event) => updateDraft("city", event.target.value)}
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
              className={onboardingInputClass}
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
  );
}
