"use client";

import { useEffect, useId, useState } from "react";
import {
  ACCEPTED_PHOTO_TYPES,
  type AcceptedPhotoType,
  validatePhotoFile,
} from "@/lib/media/read-image-file";

export type AttachedPhoto = {
  file: File;
  mimeType: AcceptedPhotoType;
};

type PhotoAttachmentProps = {
  /** 選ばれた写真。外す操作では null が渡る */
  onChange: (photo: AttachedPhoto | null) => void;
  disabled?: boolean;
};

/**
 * 投稿に添える写真を撮る／選ぶ（FE-10、機能 C3）。
 *
 * `capture="environment"` を付けた file 入力にする。対応した端末では
 * 背面カメラが直接開き、対応していない端末や PC ではファイル選択になる。
 * カメラ専用の実装（getUserMedia）にしないのは、権限の扱いが端末ごとに
 * 割れるうえ、すでに撮ってある写真を選べなくなるためである。
 *
 * Exif の除去はサーバ側が行う（BE-13）。ここでは形式と大きさだけを見る。
 */
export function PhotoAttachment({ onChange, disabled }: PhotoAttachmentProps) {
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleSelect(selected: File | undefined) {
    if (!selected) {
      return;
    }

    const validation = validatePhotoFile(selected);

    if (!validation.ok) {
      setErrorMessage(validation.message);
      setFile(null);
      onChange(null);
      return;
    }

    setErrorMessage(null);
    setFile(selected);
    onChange({ file: selected, mimeType: selected.type as AcceptedPhotoType });
  }

  function handleRemove() {
    setFile(null);
    setErrorMessage(null);
    onChange(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-black text-ink">写真（任意）</p>

      {file && previewUrl ? (
        <div className="flex flex-col gap-3">
          {/* next/image を使わないのは、object URL が最適化の対象にならないためである */}
          {/* biome-ignore lint/performance/noImgElement: 端末内の object URL を表示するため */}
          <img
            src={previewUrl}
            alt={`選んだ写真（${file.name}）`}
            className="max-h-64 w-full rounded-2xl border border-outline object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            className="min-h-12 rounded-2xl border border-outline bg-surface px-4 text-sm font-black text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            写真を外す
          </button>
        </div>
      ) : (
        // sr-only の入力は label の中に置く。兄弟に置くと、キーボードで
        // 入力に focus が当たってもラベル側に可視のフォーカスリングが出ない
        <label
          htmlFor={inputId}
          className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-outline bg-surface px-4 text-sm font-black text-ink has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand"
        >
          <input
            id={inputId}
            type="file"
            accept={ACCEPTED_PHOTO_TYPES.join(",")}
            // 対応した端末では背面カメラが直接開く
            capture="environment"
            disabled={disabled}
            onChange={(event) => handleSelect(event.target.files?.[0])}
            className="sr-only"
          />
          <span aria-hidden="true">📷</span>
          写真を撮る／選ぶ
        </label>
      )}

      {errorMessage ? (
        <p role="alert" className="text-sm font-bold text-impassable">
          {errorMessage}
        </p>
      ) : (
        <p className="text-xs leading-5 text-muted">
          写真に含まれる位置情報は、送信後にサーバ側で削除されます。
        </p>
      )}
    </div>
  );
}
