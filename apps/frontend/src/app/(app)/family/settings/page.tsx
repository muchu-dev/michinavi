import Link from "next/link";

function Chevron() {
  return (
    <span
      aria-hidden="true"
      className="mr-1 size-4 rotate-45 border-t-[0.1875rem] border-r-[0.1875rem] border-current"
    />
  );
}

export default function FamilySettingsPage() {
  return (
    <section className="flex flex-1 flex-col bg-surface px-7 py-8 sm:px-9">
      <h1 className="sr-only">家族の設定</h1>

      <nav aria-label="家族の設定メニュー">
        <ul className="space-y-2">
          <li>
            <button
              type="button"
              disabled
              className="flex min-h-16 w-full items-center justify-between gap-5 text-left text-[1.5625rem] leading-tight font-normal text-muted disabled:cursor-not-allowed"
            >
              <span>家族構成の登録・更新</span>
              <Chevron />
            </button>
          </li>
          <li>
            <button
              type="button"
              disabled
              className="flex min-h-16 w-full items-center justify-between gap-5 text-left text-[1.5625rem] leading-tight font-normal text-muted disabled:cursor-not-allowed"
            >
              <span>個人情報の編集</span>
              <Chevron />
            </button>
          </li>
          <li>
            <Link
              href="/family/connect"
              className="flex min-h-16 items-center justify-between gap-5 rounded-lg text-[1.5625rem] leading-tight font-normal text-muted outline-none transition-colors hover:text-brand focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-brand"
            >
              <span>連携</span>
              <Chevron />
            </Link>
          </li>
        </ul>
      </nav>
    </section>
  );
}
