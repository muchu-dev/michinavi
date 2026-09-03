import { ChoiceGroup, StepHeading } from "../onboarding-controls";
import type {
  OnboardingDraft,
  UpdateOnboardingDraft,
} from "../onboarding-types";

const yesNo = ["あり", "なし"];

export function NeedsStep({
  draft,
  updateDraft,
}: {
  draft: OnboardingDraft;
  updateDraft: UpdateOnboardingDraft;
}) {
  return (
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
  );
}
