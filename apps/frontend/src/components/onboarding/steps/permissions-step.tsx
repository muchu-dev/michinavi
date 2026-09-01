import Image from "next/image";
import { StepHeading } from "../onboarding-controls";

export function PermissionsStep() {
  return (
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
  );
}
