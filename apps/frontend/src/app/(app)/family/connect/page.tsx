export default function FamilyConnectPage() {
  return (
    <section className="flex flex-1 flex-col bg-surface px-6 py-8 sm:px-9">
      <h1 className="text-center text-2xl leading-tight font-bold text-muted">
        家族と連携
      </h1>

      <div
        aria-label="家族連携用QRコード"
        className="mx-auto mt-12 flex aspect-square w-full max-w-80 items-center justify-center bg-[#d9d9d9] text-xl font-bold text-ink"
        role="img"
      >
        QRコード
      </div>

      <button
        type="button"
        className="mt-auto min-h-14 w-full rounded-2xl bg-brand px-6 text-xl font-bold text-white outline-none transition-colors hover:bg-[#4d70ad] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-brand active:bg-[#45669f]"
      >
        読み取る
      </button>
    </section>
  );
}
