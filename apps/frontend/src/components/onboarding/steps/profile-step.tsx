import { ChoiceGroup, StepHeading } from "../onboarding-controls";
import type {
  OnboardingDraft,
  UpdateOnboardingDraft,
} from "../onboarding-types";

const ages = ["-10代", "20代", "30代", "40代", "50代", "60代", "70代-"];
const genders = ["男性", "女性", "その他"];

export function ProfileStep({
  draft,
  updateDraft,
}: {
  draft: OnboardingDraft;
  updateDraft: UpdateOnboardingDraft;
}) {
  return (
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
  );
}
