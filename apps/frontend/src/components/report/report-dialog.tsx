"use client";

import { useEffect, useId, useRef, useState } from "react";
import { type ReportReason, reportReasons } from "@/lib/report/report-reasons";

type ReportDialogProps = {
  /** 通報する対象が何かを一言で示す。誤操作で別の投稿を通報しないため */
  targetSummary: string;
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: (input: { reason: ReportReason; note: string }) => void;
  onClose: () => void;
};

/** Tab で止まりうる要素。無効化されたものと tabindex="-1" は除く */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * ラジオのうち、Tab が飛ばして通り過ぎるもの。
 *
 * ブラウザはラジオのグループを 1 つの止まる場所として扱い、選ばれている
 * ラジオ（どれも選ばれていなければ先頭）にだけ Tab で入る。同じ数え方を
 * しないと端の判定がずれ、グループの途中から背面へ抜けてしまう。
 */
function isSkippedRadio(element: HTMLElement, root: HTMLElement): boolean {
  if (
    !(element instanceof HTMLInputElement) ||
    element.type !== "radio" ||
    element.name === ""
  ) {
    return false;
  }

  const group = Array.from(
    root.querySelectorAll<HTMLInputElement>(
      `input[type="radio"][name="${CSS.escape(element.name)}"]`,
    ),
  );
  const checked = group.find((radio) => radio.checked);

  return (checked ?? group[0]) !== element;
}

/** ダイアログの中で Tab が止まる場所を、上から順に返す */
function tabbableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (element) => element.tabIndex >= 0 && !isSkippedRadio(element, root),
  );
}

/**
 * 通報の理由を選んで送るダイアログ（FE-18）。
 *
 * ネイティブの `<dialog>` を使わないのは、`showModal` が jsdom に無く、
 * 閉じ込めが効いていることをテストで確かめられないためである。代わりに
 * role="dialog" と Escape、背面のクリック、そして Tab の閉じ込めを自前で扱い、
 * それぞれをキーボード操作のテストで押さえている。
 * 開いた起点へフォーカスを戻すのは、ダイアログを出し入れする側（ReportButton）。
 */
export function ReportDialog({
  targetSummary,
  isSubmitting,
  errorMessage,
  onSubmit,
  onClose,
}: ReportDialogProps) {
  const titleId = useId();
  const noteId = useId();
  const [reason, setReason] = useState<ReportReason>("false_info");
  const [note, setNote] = useState("");
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const root = dialogRef.current;
      if (!root) {
        return;
      }

      const stops = tabbableWithin(root);
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (!(first && last)) {
        return;
      }

      // 背面へ出ようとしたときだけ横取りする。中の移動はブラウザに任せる
      const active = document.activeElement;
      const isOutside = !(active instanceof Node) || !root.contains(active);
      const edge = event.shiftKey ? first : last;
      if (active !== edge && !isOutside) {
        return;
      }

      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/45 p-4 sm:items-center">
      {/* 背面を押して閉じる。キーボードからは Escape とやめるボタンで閉じられる */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-[26rem] rounded-3xl bg-surface p-5 shadow-app"
      >
        <h2 id={titleId} className="text-lg font-black text-ink">
          この投稿を通報する
        </h2>
        <p className="mt-2 rounded-2xl bg-app-surface px-4 py-3 text-sm font-bold leading-6 text-ink">
          {targetSummary}
        </p>

        <fieldset className="mt-4">
          <legend className="text-sm font-black text-ink">
            当てはまる理由を選んでください
          </legend>
          <div className="mt-3 space-y-2">
            {reportReasons.map((entry, index) => (
              <label
                key={entry.value}
                className="flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl border border-outline bg-surface px-4 py-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft/40 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand"
              >
                <input
                  ref={index === 0 ? firstFieldRef : undefined}
                  type="radio"
                  name="report-reason"
                  value={entry.value}
                  checked={reason === entry.value}
                  onChange={() => setReason(entry.value)}
                  className="mt-1 size-5 accent-brand"
                />
                <span>
                  <span className="block text-sm font-black text-ink">
                    {entry.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted">
                    {entry.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label
          htmlFor={noteId}
          className="mt-4 block text-sm font-black text-ink"
        >
          補足（任意）
        </label>
        <textarea
          id={noteId}
          value={note}
          maxLength={200}
          rows={2}
          onChange={(event) => setNote(event.target.value)}
          placeholder="分かる範囲で構いません"
          className="mt-2 w-full rounded-2xl border border-outline bg-surface px-4 py-3 text-sm leading-6 text-ink focus-visible:outline-3 focus-visible:outline-brand"
        />

        {errorMessage ? (
          <p
            role="alert"
            className="mt-3 rounded-2xl bg-impassable/10 px-4 py-3 text-sm font-bold text-impassable"
          >
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 flex-1 rounded-2xl border border-outline bg-surface px-4 text-sm font-black text-ink focus-visible:outline-3 focus-visible:outline-brand"
          >
            やめる
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onSubmit({ reason, note: note.trim() })}
            className="min-h-12 flex-1 rounded-2xl bg-brand px-4 text-sm font-black text-white disabled:opacity-60 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {isSubmitting ? "送信中…" : "通報を送る"}
          </button>
        </div>

        <p className="mt-3 text-xs leading-5 text-muted">
          通報した内容は運営だけが見ます。投稿した人には誰が通報したか分かりません。
        </p>
      </div>
    </div>
  );
}
