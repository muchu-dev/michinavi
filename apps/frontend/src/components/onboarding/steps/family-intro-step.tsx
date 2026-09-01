import Image from "next/image";
import { StepHeading } from "../onboarding-controls";

export function FamilyIntroStep() {
  return (
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
      <p className="mt-4 text-sm text-muted">いつでも設定から変更できます。</p>
    </div>
  );
}
