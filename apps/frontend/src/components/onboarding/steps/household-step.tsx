import {
  CareNeedChoice,
  onboardingInputClass,
  StepHeading,
} from "../onboarding-controls";
import type {
  OnboardingDraft,
  UpdateOnboardingDraft,
} from "../onboarding-types";

const careNeeds = ["乳幼児", "障がい者", "なし"];

export function HouseholdStep({
  draft,
  onToggleCareNeed,
  updateDraft,
}: {
  draft: OnboardingDraft;
  onToggleCareNeed: (need: string) => void;
  updateDraft: UpdateOnboardingDraft;
}) {
  return (
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
            className={`${onboardingInputClass} pr-12`}
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
          {careNeeds.map((need) => (
            <CareNeedChoice
              checked={draft.careNeeds.includes(need)}
              key={need}
              label={need}
              onChange={() => onToggleCareNeed(need)}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}
