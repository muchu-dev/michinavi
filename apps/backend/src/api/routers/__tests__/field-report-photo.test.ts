import {
  createServiceRoleClient,
  createTestUser,
  deleteTestUser,
  SEED_AREA_IDS,
  type TestUser,
} from "@michinavi/testing";
import { afterEach, describe, expect, test, vi } from "vitest";
import { uploadFieldReportPhoto } from "../../../storage/field-report-photos";
import {
  createAnonymousCaller,
  createCallerFor,
} from "../../__tests__/helpers";

/**
 * Storage への配置はモックする。CI では storage-api のコンテナを起動していない
 * （.github/workflows/code-checks.yml が -x storage-api で除いている）ためで、
 * ここで確かめたいのは「Storage へ渡る中身から Exif が消えていること」である。
 * Exif 除去そのものは src/media/__tests__/strip-exif.test.ts が見ている。
 */
vi.mock("../../../storage/field-report-photos", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../../storage/field-report-photos")
    >();

  return {
    ...actual,
    uploadFieldReportPhoto: vi.fn(
      async (
        _supabase: unknown,
        params: { userId: string; fieldReportId: string },
      ) => {
        const storagePath = `${params.userId}/${params.fieldReportId}/${crypto.randomUUID()}.jpg`;

        return {
          storagePath,
          publicUrl: `http://localhost:54321/storage/v1/object/public/field-report-photos/${storagePath}`,
        };
      },
    ),
  };
});

const mockedUpload = vi.mocked(uploadFieldReportPhoto);

const serviceRole = createServiceRoleClient();
const createdUserIds: string[] = [];

let meshCodeSequence = 0;
function uniqueMeshCode(): string {
  meshCodeSequence += 1;
  return `56${String(Date.now()).slice(-6)}${String(meshCodeSequence).padStart(2, "0")}`;
}

function ascii(text: string): number[] {
  return [...text].map((char) => char.charCodeAt(0));
}

function segment(marker: number, payload: number[]): number[] {
  const length = payload.length + 2;

  return [0xff, marker, (length >> 8) & 0xff, length & 0xff, ...payload];
}

/** GPS 入りの Exif を持つ JPEG */
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

async function newRegisteredUser(): Promise<TestUser> {
  const user = await createTestUser();
  createdUserIds.push(user.id);

  const { caller } = await createCallerFor(user);
  await caller.user.setup({
    displayName: "テスト太郎",
    areaId: SEED_AREA_IDS.mabiYata,
    homeMeshCode: "5133451124",
  });

  return user;
}

async function newReportFor(user: TestUser) {
  const { caller } = await createCallerFor(user);

  return caller.fieldReport.create({
    meshCode: uniqueMeshCode(),
    roadCondition: "impassable",
  });
}

afterEach(async () => {
  await Promise.all(createdUserIds.splice(0).map(deleteTestUser));
  vi.clearAllMocks();
});

describe("fieldReportPhoto.attach", () => {
  test("自分の投稿に写真を添えられる", async () => {
    const user = await newRegisteredUser();
    const report = await newReportFor(user);
    const { caller } = await createCallerFor(user);

    const photo = await caller.fieldReportPhoto.attach({
      fieldReportId: report.id,
      contentBase64: jpegWithGps().toString("base64"),
    });

    expect(photo.mimeType).toBe("image/jpeg");
    expect(photo.width).toBe(200);
    expect(photo.height).toBe(100);
    expect(photo.publicUrl).toContain(photo.storagePath);

    const { data } = await serviceRole
      .from("field_report_photos")
      .select("field_report_id, exif_stripped, processed_at, byte_size")
      .eq("id", photo.id)
      .single();

    expect(data?.field_report_id).toBe(report.id);
    expect(data?.exif_stripped).toBe(true);
    expect(data?.processed_at).not.toBeNull();
  });

  test("Storage へ渡る画像に GPS 情報が残っていない", async () => {
    const user = await newRegisteredUser();
    const report = await newReportFor(user);
    const { caller } = await createCallerFor(user);

    const original = jpegWithGps();
    expect(original.includes(Buffer.from("GPSLatitude"))).toBe(true);

    const photo = await caller.fieldReportPhoto.attach({
      fieldReportId: report.id,
      contentBase64: original.toString("base64"),
    });

    // 完了の定義: アップロード後の画像に GPS 情報が残っていない
    const uploaded = mockedUpload.mock.calls[0]?.[1];
    expect(uploaded).toBeTruthy();
    const uploadedBytes = Buffer.from(uploaded?.data ?? new Uint8Array());

    expect(uploadedBytes.includes(Buffer.from("GPSLatitude"))).toBe(false);
    expect(uploadedBytes.includes(Buffer.from("Exif"))).toBe(false);
    expect(photo.removedMetadata).toContain("APP1");
    expect(photo.byteSize).toBe(uploadedBytes.byteLength);
  });

  test("保存先は投稿者の user_id で始まる", async () => {
    const user = await newRegisteredUser();
    const report = await newReportFor(user);
    const { caller } = await createCallerFor(user);

    const photo = await caller.fieldReportPhoto.attach({
      fieldReportId: report.id,
      contentBase64: jpegWithGps().toString("base64"),
    });

    expect(photo.storagePath.startsWith(`${user.id}/`)).toBe(true);
  });

  test("他人の投稿には写真を添えられない", async () => {
    const owner = await newRegisteredUser();
    const attacker = await newRegisteredUser();
    const report = await newReportFor(owner);
    const { caller } = await createCallerFor(attacker);

    await expect(
      caller.fieldReportPhoto.attach({
        fieldReportId: report.id,
        contentBase64: jpegWithGps().toString("base64"),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(mockedUpload).not.toHaveBeenCalled();
  });

  test("存在しない投稿には添えられない", async () => {
    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);

    await expect(
      caller.fieldReportPhoto.attach({
        fieldReportId: "00000000-0000-4000-8000-00000000dead",
        contentBase64: jpegWithGps().toString("base64"),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("未認証では添えられない", async () => {
    const user = await newRegisteredUser();
    const report = await newReportFor(user);
    const { caller } = await createAnonymousCaller();

    await expect(
      caller.fieldReportPhoto.attach({
        fieldReportId: report.id,
        contentBase64: jpegWithGps().toString("base64"),
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("Exif を落とせない形式は受け取らない", async () => {
    const user = await newRegisteredUser();
    const report = await newReportFor(user);
    const { caller } = await createCallerFor(user);

    // HEIC のような形式を素通しさせると、除去できないまま公開される
    await expect(
      caller.fieldReportPhoto.attach({
        fieldReportId: report.id,
        contentBase64: Buffer.from("GIF89a...").toString("base64"),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(mockedUpload).not.toHaveBeenCalled();
  });

  test("壊れた画像は Storage に届かない", async () => {
    const user = await newRegisteredUser();
    const report = await newReportFor(user);
    const { caller } = await createCallerFor(user);

    await expect(
      caller.fieldReportPhoto.attach({
        fieldReportId: report.id,
        // JPEG の先頭だけがある壊れたデータ
        contentBase64: Buffer.from([0xff, 0xd8, 0xff, 0xe1]).toString("base64"),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(mockedUpload).not.toHaveBeenCalled();
  });
});

describe("fieldReportPhoto.listForReport", () => {
  test("未ログインでも写真を取得できる", async () => {
    const user = await newRegisteredUser();
    const report = await newReportFor(user);
    const { caller: ownerCaller } = await createCallerFor(user);
    const photo = await ownerCaller.fieldReportPhoto.attach({
      fieldReportId: report.id,
      contentBase64: jpegWithGps().toString("base64"),
    });

    const { caller } = await createAnonymousCaller();
    const photos = await caller.fieldReportPhoto.listForReport({
      fieldReportId: report.id,
    });

    expect(photos.map((row) => row.id)).toEqual([photo.id]);
    expect(photos[0]?.publicUrl).toContain(photo.storagePath);
  });

  test("Exif の除去が終わっていない写真は第三者に見せない", async () => {
    const user = await newRegisteredUser();
    const report = await newReportFor(user);

    // 除去に失敗した状態の行を service role で作る
    await serviceRole.from("field_report_photos").insert({
      field_report_id: report.id,
      storage_path: `${user.id}/${report.id}/not-stripped.jpg`,
      mime_type: "image/jpeg",
      byte_size: 100,
      exif_stripped: false,
    });

    const { caller } = await createAnonymousCaller();
    const photos = await caller.fieldReportPhoto.listForReport({
      fieldReportId: report.id,
    });
    expect(photos).toEqual([]);

    // 投稿者本人には見える
    const { caller: ownerCaller } = await createCallerFor(user);
    const ownPhotos = await ownerCaller.fieldReportPhoto.listForReport({
      fieldReportId: report.id,
    });
    expect(ownPhotos).toHaveLength(1);
  });
});

describe("写真の行の守り", () => {
  test("他人の投稿に写真の行を差し込めない", async () => {
    const owner = await newRegisteredUser();
    const attacker = await newRegisteredUser();
    const report = await newReportFor(owner);
    const { ctx } = await createCallerFor(attacker);

    const { error } = await ctx.supabase.from("field_report_photos").insert({
      field_report_id: report.id,
      storage_path: `${attacker.id}/${report.id}/injected.jpg`,
      mime_type: "image/jpeg",
      byte_size: 100,
      exif_stripped: true,
      processed_at: new Date().toISOString(),
    });

    expect(error?.code).toBe("42501");
  });

  test("写真の差し替えはできない", async () => {
    const user = await newRegisteredUser();
    const report = await newReportFor(user);
    const { caller, ctx } = await createCallerFor(user);
    const photo = await caller.fieldReportPhoto.attach({
      fieldReportId: report.id,
      contentBase64: jpegWithGps().toString("base64"),
    });

    const { error } = await ctx.supabase
      .from("field_report_photos")
      .update({ storage_path: "somewhere/else.jpg" })
      .eq("id", photo.id);

    expect(error?.code).toBe("42501");
  });
});
