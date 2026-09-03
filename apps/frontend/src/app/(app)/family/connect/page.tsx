import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "家族と連携",
  description: "QRコードを使って家族と連携します。",
};

export default function FamilyConnectPage() {
  return (
    <section className="flex flex-1 flex-col bg-surface px-6 py-8 sm:px-9">
      <h1 className="text-center text-2xl leading-tight font-bold text-muted">
        家族と連携
      </h1>

      <div
        aria-label="家族連携用QRコード"
        className="mx-auto mt-12 flex aspect-square w-full max-w-80 items-center justify-center bg-neutral-soft text-xl font-bold text-ink"
        role="img"
      >
        QRコード
      </div>

      <button
        type="button"
        aria-disabled="true"
        className="mt-auto flex min-h-14 w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-muted px-6 text-xl font-bold text-white outline-none focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-brand"
      >
        <span>読み取る</span>
        <span className="text-sm">（準備中）</span>
      </button>
    </section>
  );
}
