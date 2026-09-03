import {
  createTestUser,
  deleteTestUser,
  SEED_AREA_IDS,
} from "@michinavi/testing";
import { describe, expect, test } from "vitest";
import { createCallerFor } from "../../__tests__/helpers";

function ascii(text: string): number[] {
  return [...text].map((char) => char.charCodeAt(0));
}

function segment(marker: number, payload: number[]): number[] {
  const length = payload.length + 2;

  return [0xff, marker, (length >> 8) & 0xff, length & 0xff, ...payload];
}

function jpegWithGps(): Buffer {
  return Buffer.from([
    0xff,
    0xd8,
    ...segment(0xe1, [
      ...ascii("Exif"),
      0x00,
      0x00,
      ...ascii("GPSLatitude 34.6383"),
    ]),
    ...segment(0xc0, [0x08, 0x00, 0x64, 0x00, 0xc8, 0x03]),
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
    0xff,
    0xd9,
  ]);
}

/**
 * 実際の Storage へ置いて公開 URL から取り出す確認（BE-13）。
 *
 * CI では storage-api のコンテナを起動していない
 * （.github/workflows/code-checks.yml が -x storage-api で除いている）ため、
 * 既定では飛ばす。手元で確かめるときは次のように実行する。
 *
 *   STORAGE_E2E=1 pnpm --filter @michinavi/backend test
 *
 * 起動中のローカル Supabase に storage-api が含まれている必要がある
 * （`pnpm db:start` は全サービスを起動する）。
 */
describe.skipIf(!process.env.STORAGE_E2E)("実際の Storage への配置", () => {
  test("公開 URL から取り出した画像に GPS が残っていない", async () => {
    const user = await createTestUser();
    const { caller } = await createCallerFor(user);
    await caller.user.setup({
      displayName: "テスト太郎",
      areaId: SEED_AREA_IDS.mabiYata,
      homeMeshCode: "5133451124",
    });
    const report = await caller.fieldReport.create({
      meshCode: "5133451199",
      roadCondition: "impassable",
    });

    const photo = await caller.fieldReportPhoto.attach({
      fieldReportId: report.id,
      contentBase64: jpegWithGps().toString("base64"),
    });

    const response = await fetch(photo.publicUrl);
    expect(response.status).toBe(200);

    const downloaded = Buffer.from(await response.arrayBuffer());
    expect(downloaded.includes(Buffer.from("GPSLatitude"))).toBe(false);
    expect(downloaded.includes(Buffer.from("Exif"))).toBe(false);
    expect(downloaded.byteLength).toBe(photo.byteSize);

    await deleteTestUser(user.id);
  });
});
