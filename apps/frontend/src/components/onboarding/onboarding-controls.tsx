const chipClass =
  "relative flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-sm font-bold transition-colors has-checked:border-brand has-checked:bg-brand has-checked:text-white hover:border-brand focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-brand";

export const onboardingInputClass =
  "min-h-12 w-full rounded-xl border border-outline bg-white px-4 text-base outline-none focus:border-brand focus:ring-3 focus:ring-brand/20";

export function ChoiceGroup({
  label,
  name,
  options,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-black">{label}</legend>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <label className={chipClass} key={option}>
            <input
              aria-label={`${label} ${option}`}
              checked={value === option}
              className="sr-only"
              name={name}
              onChange={() => onChange(option)}
              type="radio"
              value={option}
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CareNeedChoice({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className={chipClass}>
      <input
        checked={checked}
        className="sr-only"
        onChange={onChange}
        type="checkbox"
      />
      {label}
    </label>
  );
}

export function StepHeading({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-balance text-2xl font-black leading-tight text-foreground">
      {children}
    </h1>
  );
}
