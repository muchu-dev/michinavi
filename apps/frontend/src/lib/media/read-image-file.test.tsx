import { describe, expect, it } from "vitest";
import {
  MAX_PHOTO_BYTES,
  readImageFile,
  validatePhotoFile,
} from "./read-image-file";

function fileOf(type: string, sizeBytes: number, content = "hello"): File {
  const file = new File([content], "photo", { type });

  Object.defineProperty(file, "size", { value: sizeBytes });

  return file;
}

describe("validatePhotoFile", () => {
  it("JPEG と PNG を受け取る", () => {
    expect(validatePhotoFile(fileOf("image/jpeg", 100)).ok).toBe(true);
    expect(validatePhotoFile(fileOf("image/png", 100)).ok).toBe(true);
  });

  it("サーバ側が Exif を落とせない形式は断る", () => {
    const result = validatePhotoFile(fileOf("image/heic", 100));

    expect(result.ok).toBe(false);
  });

  it("上限を超える大きさは断る", () => {
    const result = validatePhotoFile(fileOf("image/jpeg", MAX_PHOTO_BYTES + 1));

    expect(result.ok).toBe(false);
  });

  it("中身が空のファイルは断る", () => {
    expect(validatePhotoFile(fileOf("image/jpeg", 0)).ok).toBe(false);
  });
});

describe("readImageFile", () => {
  it("data URL の接頭辞を落とした base64 を返す", async () => {
    const result = await readImageFile(fileOf("image/png", 5, "hello"));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mimeType).toBe("image/png");
      expect(Buffer.from(result.base64, "base64").toString()).toBe("hello");
      expect(result.base64.startsWith("data:")).toBe(false);
    }
  });

  it("送れないファイルは読まずに断る", async () => {
    const result = await readImageFile(fileOf("application/pdf", 10));

    expect(result.ok).toBe(false);
  });
});
