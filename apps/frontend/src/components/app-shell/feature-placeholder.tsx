type FeaturePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  plannedFeatures: readonly string[];
  taskIds: string;
};

export function FeaturePlaceholder({
  eyebrow,
  title,
  description,
  plannedFeatures,
  taskIds,
}: FeaturePlaceholderProps) {
  return (
    <section
      aria-labelledby="page-title"
      className="flex flex-1 flex-col px-5 py-7 sm:px-7"
    >
      <p className="text-xs font-black tracking-[0.16em] text-brand uppercase">
        {eyebrow}
      </p>
      <h1 id="page-title" className="mt-2 text-2xl font-black text-ink">
        {title}
      </h1>
      <p className="mt-3 max-w-md text-sm leading-7 text-muted">
        {description}
      </p>

      <div className="mt-8 rounded-3xl border border-outline bg-surface p-5 shadow-card">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full bg-caution shadow-[0_0_0_5px_rgba(240,169,46,0.14)]"
          />
          <h2 className="text-base font-black text-ink">次の実装範囲</h2>
        </div>
        <ul className="mt-5 space-y-3">
          {plannedFeatures.map((feature) => (
            <li
              key={feature}
              className="flex min-h-11 items-center gap-3 rounded-2xl bg-app-surface px-4 py-3 text-sm font-bold text-ink"
            >
              <span aria-hidden="true" className="text-passable">
                ・
              </span>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-auto pt-8 text-xs leading-5 text-muted">
        この画面はページ遷移とレイアウトのみ実装済みです。対象タスク：
        {taskIds}
      </p>
    </section>
  );
}
