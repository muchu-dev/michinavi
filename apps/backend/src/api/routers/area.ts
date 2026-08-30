import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { toTRPCError } from "../errors";
import { createTRPCRouter, publicProcedure } from "../init";

const resolveFromAddressInputSchema = z.object({
  address: z.string().trim().min(1).max(200),
});

export const areaRouter = createTRPCRouter({
  /**
   * 住所文字列から地区を決める（BE-10）。E3（地区ラベルと信頼度表示）専用。
   *
   * ジオコーディングも areas.boundary の境界ポリゴンも使わない。
   * 日本の住所は町丁目名をそのまま含む構造化された文字列なので、
   * 町字（level = 3）の名前が住所に含まれるかどうかの文字列一致だけで決める。
   * ルート探索や避難所検索のような座標の精度が必要な機能はこの area_id を使わず、
   * GPS 座標をそのまま扱う（BE-14、BE-20）。
   */
  resolveFromAddress: publicProcedure
    .input(resolveFromAddressInputSchema)
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("areas")
        .select("id, name")
        .eq("level", 3);

      if (error) {
        throw toTRPCError(error, "地区の判定に失敗しました");
      }

      const matches = (data ?? []).filter((area) =>
        input.address.includes(area.name),
      );

      if (matches.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "住所から地区を特定できませんでした",
        });
      }

      if (matches.length > 1) {
        // 現在のシードデータでは起こらないが、地区名が増えたときに
        // 誤った地区を返すより、判定できないと伝える方が安全
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "住所から地区を一意に特定できませんでした",
        });
      }

      const matched = matches[0];
      if (!matched) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "地区の判定に失敗しました",
        });
      }

      return {
        areaId: matched.id,
        name: matched.name,
      };
    }),
});
