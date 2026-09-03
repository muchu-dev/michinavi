import { describe, expect, test } from "vitest";
import { stripImageMetadata, UnsupportedImageError } from "../strip-exif";

function ascii(text: string): number[] {
  return [...text].map((char) => char.charCodeAt(0));
}

/** マーカーと長さを付けた JPEG のセグメントを作る */
function segment(marker: number, payload: number[]): number[] {
  const length = payload.length + 2;

  return [0xff, marker, (length >> 8) & 0xff, length & 0xff, ...payload];
}

/**
 * GPS 情報を含む Exif（APP1）を持つ JPEG を組み立てる。
 *
 * 実際の Exif は TIFF 構造だが、ここでは「APP1 の中に座標が入っている」ことと
 * 「それが落ちる」ことを確かめられればよい。
 */
function jpegWithExifGps(): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8,
    // APP0（JFIF）。落とさない
    ...segment(0xe0, [...ascii("JFIF"), 0x00, 0x01, 0x02]),
    // APP1（Exif と GPS）。落とす
    ...segment(0xe1, [
      ...ascii("Exif"),
      0x00,
      0x00,
      ...ascii("GPSLatitude 34.6383 GPSLongitude 133.6903"),
    ]),
    // COM（コメント）。落とす
    ...segment(0xfe, ascii("secret comment")),
    // SOF0。縦 480 と横 640
    ...segment(0xc0, [0x08, 0x01, 0xe0, 0x02, 0x80, 0x03]),
    // SOS 以降は圧縮された画像データ
    0xff,
    0xda,
    0x00,
    0x08,
    0x01,
    0x01,
    0x00,
    0x00,
    0x3f,
    0x00,
    0x12,
    0x34,
    0x56,
    0xff,
    0xd9,
  ]);
}

function pngChunk(type: string, payload: number[]): number[] {
  const length = payload.length;

  return [
    (length >>> 24) & 0xff,
    (length >>> 16) & 0xff,
    (length >>> 8) & 0xff,
    length & 0xff,
    ...ascii(type),
    ...payload,
    // CRC は検証しないのでダミーを置く
    0x00,
    0x00,
    0x00,
    0x00,
  ];
}

function pngWithExif(): Uint8Array {
  return new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...pngChunk(
      "IHDR",
      [
        0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x80, 0x08, 0x06, 0x00, 0x00,
        0x00,
      ],
    ),
    ...pngChunk("eXIf", ascii("GPSLatitude 34.6383")),
    ...pngChunk("tEXt", ascii("Comment shooting place")),
    ...pngChunk("IDAT", [0x01, 0x02, 0x03]),
    ...pngChunk("IEND", []),
  ]);
}

function includesText(data: Uint8Array, text: string): boolean {
  return Buffer.from(data).includes(Buffer.from(text, "utf8"));
}

describe("stripImageMetadata（JPEG）", () => {
  test("Exif（APP1）を落とし、GPS の値が残らない", () => {
    const original = jpegWithExifGps();
    expect(includesText(original, "GPSLatitude")).toBe(true);

    const stripped = stripImageMetadata(original);

    // 完了の定義: アップロード後の画像に GPS 情報が残っていない
    expect(includesText(stripped.data, "GPSLatitude")).toBe(false);
    expect(includesText(stripped.data, "Exif")).toBe(false);
    expect(stripped.removed).toContain("APP1");
  });

  test("コメント（COM）も落とす", () => {
    const stripped = stripImageMetadata(jpegWithExifGps());

    expect(includesText(stripped.data, "secret comment")).toBe(false);
    expect(stripped.removed).toContain("COM");
  });

  test("画素の解釈に関わる APP0（JFIF）は残す", () => {
    const stripped = stripImageMetadata(jpegWithExifGps());

    expect(includesText(stripped.data, "JFIF")).toBe(true);
    expect(stripped.removed).not.toContain("APP0");
  });

  test("画像データはそのまま残る", () => {
    const stripped = stripImageMetadata(jpegWithExifGps());
    const tail = [...stripped.data.subarray(stripped.data.length - 5)];

    expect(tail).toEqual([0x12, 0x34, 0x56, 0xff, 0xd9]);
  });

  test("縦横を読み取る", () => {
    const stripped = stripImageMetadata(jpegWithExifGps());

    expect(stripped.width).toBe(640);
    expect(stripped.height).toBe(480);
    expect(stripped.mimeType).toBe("image/jpeg");
  });

  test("落とした結果は元より小さい", () => {
    const original = jpegWithExifGps();
    const stripped = stripImageMetadata(original);

    expect(stripped.data.length).toBeLessThan(original.length);
  });
});

describe("stripImageMetadata（PNG）", () => {
  test("eXIf と tEXt を落とす", () => {
    const original = pngWithExif();
    expect(includesText(original, "GPSLatitude")).toBe(true);

    const stripped = stripImageMetadata(original);

    expect(includesText(stripped.data, "GPSLatitude")).toBe(false);
    expect(includesText(stripped.data, "shooting place")).toBe(false);
    expect(stripped.removed).toEqual(["eXIf", "tEXt"]);
  });

  test("画像のチャンクは残し、縦横を読み取る", () => {
    const stripped = stripImageMetadata(pngWithExif());

    expect(includesText(stripped.data, "IDAT")).toBe(true);
    expect(includesText(stripped.data, "IEND")).toBe(true);
    expect(stripped.width).toBe(256);
    expect(stripped.height).toBe(128);
  });
});

describe("対応していない形式", () => {
  test("JPEG でも PNG でもないものは受け取らない", () => {
    // 「知らない形式はそのまま保存する」にすると、Exif を落とせないまま
    // 公開される経路が残る
    expect(() => stripImageMetadata(new Uint8Array(ascii("GIF89a")))).toThrow(
      UnsupportedImageError,
    );
  });

  test("途中で切れた JPEG は受け取らない", () => {
    expect(() =>
      stripImageMetadata(new Uint8Array([0xff, 0xd8, 0xff, 0xe1])),
    ).toThrow(UnsupportedImageError);
  });
});
