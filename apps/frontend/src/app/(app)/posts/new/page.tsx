"use client";

import { useState } from "react";
import {
  type AttachedPhoto,
  PhotoAttachment,
} from "@/components/post/photo-attachment";
import { readImageFile } from "@/lib/media/read-image-file";
import { api } from "@/lib/trpc/client";

/**
 * 写真つきの投稿を送る画面（FE-10、機能 C3）。
 *
 * この画面が持つのは「3 つの状態から選ぶ」「写真を添える」「送る」だけである。
 * 投稿画面そのもの（FE-09、FE-11）は別のブランチで作業中のため、ここでは
 * 写真の導線が端から端まで動くことを確かめられる最小の形にしてある。
 * 投稿画面が入ったら PhotoAttachment をそちらへ移し、この画面は消す。
 *
 * 位置は世帯に登録した自宅のメッシュを使う。現在地からの取得は FE-12 と
 * BE-12 の範囲で、ここで別の変換を書くと二重に持つことになる。
 */

const CONDITIONS = [
  { value: "passable", label: "通れる", symbol: "○" },
  { value: "caution", label: "注意", symbol: "△" },
  { value: "impassable", label: "通れない", symbol: "×" },
] as const;

type RoadCondition = (typeof CONDITIONS)[number]["value"];

export default function NewPostPage() {
  const [condition, setCondition] = useState<RoadCondition | null>(null);
  const [photo, setPhoto] = useState<AttachedPhoto | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [postedId, setPostedId] = useState<string | null>(null);

  const household = api.household.get.useQuery();
  const createReport = api.fieldReport.create.useMutation();
  const attachPhoto = api.fieldReportPhoto.attach.useMutation();

  const homeMeshCode = household.data?.household.homeMeshCode ?? null;
  const isSending = createReport.isPending || attachPhoto.isPending;
  const canSend = condition !== null && homeMeshCode !== null && !isSending;

  async function handleSubmit() {
    if (!condition || !homeMeshCode) {
      return;
    }

    setErrorMessage(null);
    setPostedId(null);

    try {
      const report = await createReport.mutateAsync({
        meshCode: homeMeshCode,
        roadCondition: condition,
      });

      if (photo) {
        const read = await readImageFile(photo.file);

        if (!read.ok) {
          // 投稿そのものは保存できているので、写真だけを落とした旨を伝える
          setPostedId(report.id);
          setErrorMessage(`投稿は送れましたが、${read.message}`);
          return;
        }

        await attachPhoto.mutateAsync({
          fieldReportId: report.id,
          contentBase64: read.base64,
        });
      }

      setPostedId(report.id);
      setCondition(null);
      setPhoto(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "投稿を送れませんでした。通信の状態を確かめてください",
      );
    }
  }

  return (
    <section
      aria-labelledby="new-post-title"
      className="flex flex-1 flex-col gap-5 px-5 py-6"
    >
      <div>
        <h1 id="new-post-title" className="text-2xl font-black text-ink">
          いまの状況を投稿
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          目の前の道が通れるかどうかを選んで送ります。写真は任意です。
        </p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-black text-ink">道の状況</legend>
        <div className="grid grid-cols-3 gap-3">
          {CONDITIONS.map((entry) => (
            <button
              key={entry.value}
              type="button"
              aria-pressed={condition === entry.value}
              onClick={() => setCondition(entry.value)}
              className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border border-outline bg-surface text-base font-black text-ink aria-pressed:border-brand aria-pressed:bg-brand-soft focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {/* 色だけに頼らず記号と文字の両方で示す */}
              <span aria-hidden="true" className="text-2xl">
                {entry.symbol}
              </span>
              {entry.label}
            </button>
          ))}
        </div>
      </fieldset>

      <PhotoAttachment onChange={setPhoto} disabled={isSending} />

      {homeMeshCode === null && !household.isPending ? (
        <p role="alert" className="text-sm font-bold text-impassable">
          投稿するには、先に家族と自宅の登録が必要です。
        </p>
      ) : null}

      <button
        type="button"
        disabled={!canSend}
        onClick={handleSubmit}
        className="min-h-14 rounded-2xl bg-brand px-5 text-base font-black text-white disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {isSending ? "送信中…" : "送る"}
      </button>

      {errorMessage ? (
        <p role="alert" className="text-sm font-bold text-impassable">
          {errorMessage}
        </p>
      ) : null}

      {postedId && !errorMessage ? (
        // <output> の暗黙のロールが status なので、role を書かずに読み上げられる
        <output className="text-sm font-bold text-passable">
          投稿を送りました。ありがとうございます。
        </output>
      ) : null}
    </section>
  );
}
