"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { demoScenario, demoTimeboxMinutes } from "@/config/demo-scenario";

const STORAGE_KEY = "michinavi.demo-walkthrough.v1";

function readCheckedIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "[]",
    );

    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function writeCheckedIds(ids: readonly string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // 保存できなくても、その場の通し確認は続けられる
  }
}

/**
 * 発表前の通し確認に使う画面（FE-21）。
 *
 * 台本を読みながら 1 つずつ画面を開き、詰まらずに一周できたかを記録する。
 * 記録を端末に残すのは、確認の途中で画面を移動しても続きから戻れるようにするためである。
 *
 * ナビゲーションには載せない。発表の準備に使う画面で、利用者向けではない。
 */
export default function DemoWalkthroughPage() {
  const [checkedIds, setCheckedIds] = useState<string[]>([]);

  useEffect(() => {
    setCheckedIds(readCheckedIds());
  }, []);

  function toggle(id: string) {
    setCheckedIds((current) => {
      const next = current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id];

      writeCheckedIds(next);
      return next;
    });
  }

  function reset() {
    setCheckedIds([]);
    writeCheckedIds([]);
  }

  return (
    <section
      aria-labelledby="demo-title"
      className="flex flex-1 flex-col gap-4 px-5 py-6"
    >
      <div>
        <p className="text-sm font-black tracking-[0.16em] text-brand uppercase">
          Demo walkthrough
        </p>
        <h1 id="demo-title" className="mt-1 text-2xl font-black text-ink">
          デモの通し確認
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          発表で見せる順に画面を開き、詰まらずに一周できるか確かめます。
          持ち時間は{demoTimeboxMinutes}分です。
        </p>
      </div>

      <p className="rounded-2xl bg-app-surface px-4 py-3 text-sm font-black text-ink">
        確認できた手順：{checkedIds.length} / {demoScenario.length}
      </p>

      <ol className="flex flex-col gap-3">
        {demoScenario.map((step) => {
          const isChecked = checkedIds.includes(step.id);

          return (
            <li
              key={step.id}
              className="rounded-3xl border border-outline bg-surface p-4 shadow-card"
            >
              <p className="text-sm font-black text-muted">手順{step.order}</p>
              <h2 className="mt-1 text-base font-black text-ink">
                {step.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink">
                操作：{step.operation}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted">
                話すこと：{step.talkingPoint}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted">
                必要な準備：{step.requires}
              </p>
              {step.avoid ? (
                <p className="mt-2 rounded-2xl bg-app-surface px-3 py-2 text-sm leading-6 font-bold text-ink">
                  今日は触れない：{step.avoid}
                </p>
              ) : null}
              {step.fallback ? (
                <p className="mt-2 rounded-2xl bg-caution-soft px-3 py-2 text-sm leading-6 font-bold text-caution-ink">
                  詰まったとき：{step.fallback}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Link
                  href={step.route}
                  className="inline-flex min-h-11 items-center rounded-2xl bg-brand px-4 text-sm font-black text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  この画面を開く
                </Link>
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-black text-ink">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(step.id)}
                    className="size-5 accent-brand"
                  />
                  詰まらずに通れた
                </label>
              </div>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={reset}
        className="min-h-11 self-start rounded-2xl border border-outline bg-surface px-4 text-sm font-black text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        確認の記録を消す
      </button>
    </section>
  );
}
