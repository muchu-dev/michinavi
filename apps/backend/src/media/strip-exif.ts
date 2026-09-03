/**
 * 画像から Exif などのメタデータを取り除く（BE-13、機能 S2）。
 *
 * 写真の Exif には撮影地点の緯度経度が入る。投稿位置は 250m メッシュに丸めて
 * 保存する設計（S1）なのに、写真から正確な座標が復元できては意味がない。
 * そこで保存の前にサーバ側で落とす。クライアントの実装や設定に頼らない。
 *
 * 画像処理のライブラリを足さず、JPEG のセグメントと PNG のチャンクを
 * 直接読んで落とす。再エンコードしないので画質は変わらず、依存も増えない。
 */

export type StrippedImage = {
  data: Uint8Array;
  mimeType: "image/jpeg" | "image/png";
  width: number | null;
  height: number | null;
  /** 落としたセグメント／チャンクの種類。監査と検証のために返す */
  removed: string[];
};

export class UnsupportedImageError extends Error {}

const JPEG_SOI = [0xff, 0xd8];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(data: Uint8Array, prefix: readonly number[]): boolean {
  return prefix.every((byte, index) => data[index] === byte);
}

/**
 * JPEG から APPn（Exif や XMP などの付随情報）と COM を落とす。
 *
 * APP0（JFIF）だけは残す。画素の解釈に関わる情報しか持たず、
 * 位置情報を含まないためである。
 * SOS（画像データの開始）以降はそのまま写す。
 */
function stripJpeg(data: Uint8Array): StrippedImage {
  const output: number[] = [0xff, 0xd8];
  const removed: string[] = [];
  let width: number | null = null;
  let height: number | null = null;
  let offset = 2;

  while (offset < data.length) {
    if (data[offset] !== 0xff) {
      throw new UnsupportedImageError("JPEG の構造を読み取れません");
    }

    const marker = data[offset + 1];

    if (marker === undefined) {
      throw new UnsupportedImageError("JPEG が途中で終わっています");
    }

    // 画像データの開始。ここから先は圧縮データなのでそのまま写す
    if (marker === 0xda) {
      for (let index = offset; index < data.length; index += 1) {
        output.push(data[index] as number);
      }

      return {
        data: new Uint8Array(output),
        mimeType: "image/jpeg",
        width,
        height,
        removed,
      };
    }

    const lengthHigh = data[offset + 2];
    const lengthLow = data[offset + 3];

    if (lengthHigh === undefined || lengthLow === undefined) {
      throw new UnsupportedImageError("JPEG が途中で終わっています");
    }

    const segmentEnd = offset + 2 + ((lengthHigh << 8) + lengthLow);

    if (segmentEnd > data.length) {
      throw new UnsupportedImageError("JPEG が途中で終わっています");
    }

    // SOF（フレームヘッダ）から縦横を読む。DHT / DAC / DNL は SOF ではない
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      height = ((data[offset + 5] ?? 0) << 8) + (data[offset + 6] ?? 0);
      width = ((data[offset + 7] ?? 0) << 8) + (data[offset + 8] ?? 0);
    }

    // APP1 から APP15 と COM を落とす。Exif は APP1 に入る
    const isAppSegment = marker >= 0xe1 && marker <= 0xef;
    const isComment = marker === 0xfe;

    if (isAppSegment || isComment) {
      removed.push(isComment ? "COM" : `APP${marker - 0xe0}`);
    } else {
      for (let index = offset; index < segmentEnd; index += 1) {
        output.push(data[index] as number);
      }
    }

    offset = segmentEnd;
  }

  throw new UnsupportedImageError("JPEG に画像データが見つかりません");
}

/** PNG からメタデータのチャンクを落とす */
function stripPng(data: Uint8Array): StrippedImage {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const output: number[] = [...PNG_SIGNATURE];
  const removed: string[] = [];
  let width: number | null = null;
  let height: number | null = null;
  let offset = PNG_SIGNATURE.length;

  // 位置情報や撮影時刻を持ちうるチャンク
  const metadataChunks = new Set(["eXIf", "tEXt", "iTXt", "zTXt", "tIME"]);

  while (offset + 8 <= data.length) {
    const chunkLength = view.getUint32(offset);
    const type = String.fromCharCode(...data.subarray(offset + 4, offset + 8));
    const chunkEnd = offset + 12 + chunkLength;

    if (chunkEnd > data.length) {
      throw new UnsupportedImageError("PNG が途中で終わっています");
    }

    if (type === "IHDR") {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
    }

    if (metadataChunks.has(type)) {
      removed.push(type);
    } else {
      for (let index = offset; index < chunkEnd; index += 1) {
        output.push(data[index] as number);
      }
    }

    offset = chunkEnd;

    if (type === "IEND") {
      break;
    }
  }

  return {
    data: new Uint8Array(output),
    mimeType: "image/png",
    width,
    height,
    removed,
  };
}

/**
 * 対応するのは JPEG と PNG だけ。
 *
 * HEIC のような形式を素通しさせないため、判別できないものは受け取らない。
 * 「知らない形式はそのまま保存する」にすると、Exif を落とせないまま
 * 公開される経路が残る。
 */
export function stripImageMetadata(data: Uint8Array): StrippedImage {
  if (startsWith(data, JPEG_SOI)) {
    return stripJpeg(data);
  }

  if (startsWith(data, PNG_SIGNATURE)) {
    return stripPng(data);
  }

  throw new UnsupportedImageError(
    "対応していない画像形式です（JPEG と PNG のみ）",
  );
}
