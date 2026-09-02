import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  stripImageMetadata,
  UnsupportedImageError,
} from "../../media/strip-exif";
import {
  FIELD_REPORT_PHOTO_BUCKET,
  PhotoUploadError,
  uploadFieldReportPhoto,
} from "../../storage/field-report-photos";
import { toTRPCError } from "../errors";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../init";

/**
 * 現地報告の写真（BE-13、機能 C3 / S2）。
 *
 * 受け取った画像はサーバ側で Exif を落としてから Storage に置く。
 * クライアントが落としてから送る形にしないのは、実装や設定に穴があったときに
 * 位置情報つきの写真がそのまま公開されるためである。
 */

/**
 * 受け取れる大きさの上限。Storage のバケット側にも同じ上限を掛けている。
 * base64 は元の約 4/3 になるので、入力の文字列長はこれより長くなる
 */
const MAX_BYTE_SIZE = 5 * 1024 * 1024;

const attachInputSchema = z.object({
  fieldReportId: z.uuid(),
  /** 画像そのもの（base64）。data URL の接頭辞は付けない */
  contentBase64: z
    .string()
    .min(1)
    // base64 は元の約 4/3 の長さになる。多少の余裕を見て弾く
    .max(Math.ceil((MAX_BYTE_SIZE * 4) / 3) + 1024),
});

export const fieldReportPhotoRouter = createTRPCRouter({
  /**
   * 自分の投稿に写真を添える（BE-13）。
   *
   * 手順は「復号 → Exif 除去 → Storage へ配置 → 行の作成」の順で、
   * 除去に失敗した画像は Storage に届かない。
   */
  attach: protectedProcedure
    .input(attachInputSchema)
    .mutation(async ({ ctx, input }) => {
      // 自分の投稿かどうかを先に見る。RLS でも防いでいるが、
      // 他人の投稿の写真を作ろうとしたことを 403 として返したい
      const { data: report, error: reportError } = await ctx.supabase
        .from("field_reports")
        .select("id, user_id")
        .eq("id", input.fieldReportId)
        .maybeSingle();

      if (reportError) {
        throw toTRPCError(reportError, "投稿の確認に失敗しました");
      }
      if (!report) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "投稿が見つかりません",
        });
      }
      if (report.user_id !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "自分の投稿にだけ写真を添えられます",
        });
      }

      const raw = Buffer.from(input.contentBase64, "base64");

      if (raw.byteLength === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "画像を読み取れませんでした",
        });
      }
      if (raw.byteLength > MAX_BYTE_SIZE) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "写真は 5MB までです",
        });
      }

      let stripped: ReturnType<typeof stripImageMetadata>;

      try {
        stripped = stripImageMetadata(new Uint8Array(raw));
      } catch (error) {
        if (error instanceof UnsupportedImageError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }

        // 想定外の壊れ方をした画像も、除去できない以上は受け取らない
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "画像を処理できませんでした",
        });
      }

      let uploaded: Awaited<ReturnType<typeof uploadFieldReportPhoto>>;

      try {
        uploaded = await uploadFieldReportPhoto(ctx.supabase, {
          userId: ctx.user.id,
          fieldReportId: report.id,
          data: stripped.data,
          mimeType: stripped.mimeType,
        });
      } catch (error) {
        if (error instanceof PhotoUploadError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "写真を保存できませんでした",
            cause: error,
          });
        }

        throw error;
      }

      const { data, error } = await ctx.supabase
        .from("field_report_photos")
        .insert({
          field_report_id: report.id,
          storage_path: uploaded.storagePath,
          mime_type: stripped.mimeType,
          byte_size: stripped.data.byteLength,
          width: stripped.width,
          height: stripped.height,
          // Storage へ置く前に落としているので、行ができた時点で必ず true
          exif_stripped: true,
          processed_at: new Date().toISOString(),
        })
        .select("id, storage_path, mime_type, byte_size, width, height")
        .single();

      if (error) {
        throw toTRPCError(error, "写真の保存に失敗しました");
      }

      return {
        id: data.id,
        storagePath: data.storage_path,
        publicUrl: uploaded.publicUrl,
        mimeType: data.mime_type,
        byteSize: data.byte_size,
        width: data.width,
        height: data.height,
        /** 落としたメタデータの種類。何を消したかを画面や監査で確かめられる */
        removedMetadata: stripped.removed,
      };
    }),

  /** 投稿に添えられた写真を返す（未ログインでも見える） */
  listForReport: publicProcedure
    .input(z.object({ fieldReportId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("field_report_photos")
        .select("id, storage_path, mime_type, width, height, created_at")
        .eq("field_report_id", input.fieldReportId)
        .order("created_at", { ascending: true });

      if (error) {
        throw toTRPCError(error, "写真の取得に失敗しました");
      }

      return data.map((row) => ({
        id: row.id,
        storagePath: row.storage_path,
        publicUrl: ctx.supabase.storage
          .from(FIELD_REPORT_PHOTO_BUCKET)
          .getPublicUrl(row.storage_path).data.publicUrl,
        mimeType: row.mime_type,
        width: row.width,
        height: row.height,
        createdAt: row.created_at,
      }));
    }),
});
