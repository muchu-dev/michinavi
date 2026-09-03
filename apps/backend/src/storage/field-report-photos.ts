import type { TRPCContext } from "../api/init";

/**
 * 写真の保存先（BE-13）。
 *
 * Storage への書き込みをこの 1 ファイルに閉じるのは、テストで差し替えるためと、
 * 保存先を変えるときに触る場所を 1 つにするためである。
 *
 * service role は使わない。ログインユーザーの JWT のまま置き、
 * 「自分の user_id のフォルダにしか置けない」という Storage 側のポリシーで守る。
 */
export const FIELD_REPORT_PHOTO_BUCKET = "field-report-photos";

export type UploadedPhoto = {
  storagePath: string;
  publicUrl: string;
};

export class PhotoUploadError extends Error {}

/**
 * Exif を落としたあとの画像を置く。
 *
 * パスは `{user_id}/{field_report_id}/{uuid}` にする。先頭を user_id にするのは、
 * Storage のポリシーが 1 階層目で持ち主を判定するためである。
 */
export async function uploadFieldReportPhoto(
  supabase: TRPCContext["supabase"],
  params: {
    userId: string;
    fieldReportId: string;
    data: Uint8Array;
    mimeType: "image/jpeg" | "image/png";
  },
): Promise<UploadedPhoto> {
  const extension = params.mimeType === "image/png" ? "png" : "jpg";
  const storagePath = `${params.userId}/${params.fieldReportId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(FIELD_REPORT_PHOTO_BUCKET)
    .upload(storagePath, params.data, {
      contentType: params.mimeType,
      // 上書きを許さない。差し替えの経路を作らない
      upsert: false,
    });

  if (error) {
    throw new PhotoUploadError(error.message);
  }

  const { data } = supabase.storage
    .from(FIELD_REPORT_PHOTO_BUCKET)
    .getPublicUrl(storagePath);

  return { storagePath, publicUrl: data.publicUrl };
}
