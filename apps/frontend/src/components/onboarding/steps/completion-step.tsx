import Image from "next/image";
import { StepHeading } from "../onboarding-controls";

export function CompletionStep() {
  return (
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
  );
}
