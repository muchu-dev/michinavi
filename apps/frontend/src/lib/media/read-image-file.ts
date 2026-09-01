/**
 * 撮った写真をサーバへ渡せる形にする（FE-10）。
 *
 * Exif の除去はサーバ側が行う（BE-13）。ここで落とそうとしないのは、
 * 端末とブラウザによって結果が変わり、落ちたつもりで落ちていない状態を
 * 作りやすいためである。ここは形式と大きさの門番だけを務める。
 */

/** サーバ側（BE-13）とバケットの上限に合わせる */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** サーバ側が Exif を落とせる形式だけを受け取る */
export const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png"] as const;

export type AcceptedPhotoType = (typeof ACCEPTED_PHOTO_TYPES)[number];

export type ReadImageResult =
  | { ok: true; base64: string; mimeType: AcceptedPhotoType }
  | { ok: false; message: string };

function isAcceptedType(type: string): type is AcceptedPhotoType {
  return (ACCEPTED_PHOTO_TYPES as readonly string[]).includes(type);
}

/** 選ばれたファイルが送れるものかを確かめる。送る前に画面で伝えるために使う */
export function validatePhotoFile(
  file: File,
): { ok: true } | { ok: false; message: string } {
  if (!isAcceptedType(file.type)) {
    return {
      ok: false,
      message: "写真は JPEG か PNG を選んでください",
    };
  }

  if (file.size > MAX_PHOTO_BYTES) {
    return {
      ok: false,
      message: "写真は 5MB までです。もう一度撮り直してください",
    };
  }

  if (file.size === 0) {
    return { ok: false, message: "写真を読み取れませんでした" };
  }

  return { ok: true };
}

/**
 * ファイルを base64 にする。
 * data URL の接頭辞（`data:image/jpeg;base64,`）は落として返す。
 * サーバ側の入力は中身だけを受け取る形にしてあるためである。
 */
export async function readImageFile(file: File): Promise<ReadImageResult> {
  const validation = validatePhotoFile(file);

  if (!validation.ok) {
    return validation;
  }

  const dataUrl = await new Promise<string | null>((resolve) => {
    const reader = new FileReader();

    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });

  const base64 = dataUrl?.split(",")[1];

  if (!base64) {
    return { ok: false, message: "写真を読み取れませんでした" };
  }

  return { ok: true, base64, mimeType: file.type as AcceptedPhotoType };
}
