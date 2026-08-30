const familyMembers = [
  {
    name: "母",
    status: "避難済み",
    statusClassName: "bg-[#d9d9d9] text-ink",
  },
  {
    name: "父",
    status: "支援が必要",
    statusClassName: "bg-caution text-[#faf0de]",
  },
] as const;

export default function FamilyPage() {
  return (
    <section className="flex flex-1 flex-col bg-surface px-7 py-14 sm:px-9">
      <h1 className="sr-only">家族の状況</h1>

      <ul aria-label="家族の避難状況" className="space-y-10">
        {familyMembers.map((member) => (
          <li
            key={member.name}
            className="flex min-h-[3.25rem] items-center justify-between gap-5"
          >
            <span className="text-[1.5625rem] leading-tight font-normal text-muted">
              {member.name}
            </span>
            <span
              className={`flex min-h-[3.25rem] w-[min(15rem,64vw)] items-center justify-center rounded-full px-5 text-center text-[1.5625rem] leading-tight font-bold ${member.statusClassName}`}
            >
              {member.status}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-14 flex min-h-12 items-center justify-between gap-5">
        <span className="text-[1.5625rem] leading-tight font-normal text-muted">
          設定
        </span>
        <span
          aria-hidden="true"
          className="mr-1 size-4 rotate-45 border-t-[0.1875rem] border-r-[0.1875rem] border-muted"
        />
      </div>
    </section>
  );
}
