import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { toTRPCError } from "../errors";
import type { TRPCContext } from "../init";
import { createTRPCRouter, publicProcedure } from "../init";

/**
 * 避難所（BE-14、機能 D1 / D2）。
 *
 * 避難所と地区の境界は公開情報なので座標を丸めない。投稿位置（S1）とは扱いが違う
 * （docs/er/00-conventions.md#位置情報の扱い）。
 */

const nearbyInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  /** 探す半径。既定は徒歩で現実的な 3km */
  radiusM: z.number().min(100).max(50_000).default(3000),
  limit: z.int().min(1).max(50).default(10),
});

/** 避難所の受入条件と対応災害をまとめて引く */
async function fetchShelterDetails(
  supabase: TRPCContext["supabase"],
  shelterIds: readonly string[],
) {
  if (shelterIds.length === 0) {
    return { acceptances: [], hazardSupports: [] };
  }

  const [
    { data: acceptances, error: acceptancesError },
    { data: hazardSupports, error: hazardSupportsError },
  ] = await Promise.all([
    supabase
      .from("shelter_acceptances")
      .select(
        "shelter_id, status, note, confirmed_at, acceptance_conditions(key, label, display_order)",
      )
      .in("shelter_id", [...shelterIds]),
    supabase
      .from("shelter_hazard_supports")
      .select("shelter_id, hazard_type, is_supported, note")
      .in("shelter_id", [...shelterIds]),
  ]);

  if (acceptancesError) {
    throw toTRPCError(acceptancesError, "受入条件の取得に失敗しました");
  }
  if (hazardSupportsError) {
    throw toTRPCError(hazardSupportsError, "対応災害の取得に失敗しました");
  }

  return {
    acceptances: acceptances ?? [],
    hazardSupports: hazardSupports ?? [],
  };
}

type AcceptanceRow = Awaited<
  ReturnType<typeof fetchShelterDetails>
>["acceptances"][number];
type HazardSupportRow = Awaited<
  ReturnType<typeof fetchShelterDetails>
>["hazardSupports"][number];

function toAcceptanceList(rows: readonly AcceptanceRow[], shelterId: string) {
  return rows
    .filter((row) => row.shelter_id === shelterId && row.acceptance_conditions)
    .sort(
      (a, b) =>
        (a.acceptance_conditions?.display_order ?? 0) -
        (b.acceptance_conditions?.display_order ?? 0),
    )
    .map((row) => ({
      key: row.acceptance_conditions?.key ?? "",
      label: row.acceptance_conditions?.label ?? "",
      // 記載の無い条件は行そのものが無い。画面では「不明」として出す
      status: row.status,
      note: row.note,
      confirmedAt: row.confirmed_at,
    }));
}

function toHazardSupportList(
  rows: readonly HazardSupportRow[],
  shelterId: string,
) {
  return rows
    .filter((row) => row.shelter_id === shelterId)
    .map((row) => ({
      hazardType: row.hazard_type,
      isSupported: row.is_supported,
      note: row.note,
    }));
}

export const shelterRouter = createTRPCRouter({
  /**
   * 現在地から近い避難所を返す（BE-14、D1 / D2）。
   *
   * 受入条件（D2）も一緒に返す。避難所の一覧を出してから 1 件ずつ条件を
   * 引き直すと、災害時の細い回線で往復が増える。
   *
   * capacity が NULL の避難所も落とさない。多くの施設で公開データに
   * 収容人数が無く、0 で埋めると混雑率が無限大になって候補から永久に外れる
   * （docs/er/02-shelter.md）。
   */
  nearby: publicProcedure
    .input(nearbyInputSchema)
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase.rpc("nearby_shelters", {
        p_latitude: input.latitude,
        p_longitude: input.longitude,
        p_radius_m: input.radiusM,
        p_limit: input.limit,
      });

      if (error) {
        throw toTRPCError(error, "避難所の取得に失敗しました");
      }

      const shelters = data ?? [];
      const { acceptances, hazardSupports } = await fetchShelterDetails(
        ctx.supabase,
        shelters.map((shelter) => shelter.id),
      );

      return shelters.map((shelter) => ({
        id: shelter.id,
        externalCode: shelter.external_code,
        name: shelter.name,
        address: shelter.address,
        areaId: shelter.area_id,
        category: shelter.category,
        /** 不明なら null。0 とは区別する */
        capacity: shelter.capacity,
        floors: shelter.floors,
        elevationM: shelter.elevation_m,
        latitude: shelter.latitude,
        longitude: shelter.longitude,
        distanceM: Math.round(shelter.distance_m),
        acceptances: toAcceptanceList(acceptances, shelter.id),
        hazardSupports: toHazardSupportList(hazardSupports, shelter.id),
      }));
    }),

  /** 1 件の避難所の詳細（D1 / D2） */
  byId: publicProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("shelters")
        .select(
          "id, external_code, name, name_kana, address, area_id, category, capacity, floors, elevation_m, operator, phone, source, source_updated_at, is_active",
        )
        .eq("id", input.id)
        .maybeSingle();

      if (error) {
        throw toTRPCError(error, "避難所の取得に失敗しました");
      }
      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "避難所が見つかりません",
        });
      }

      const { acceptances, hazardSupports } = await fetchShelterDetails(
        ctx.supabase,
        [data.id],
      );

      return {
        id: data.id,
        externalCode: data.external_code,
        name: data.name,
        nameKana: data.name_kana,
        address: data.address,
        areaId: data.area_id,
        category: data.category,
        capacity: data.capacity,
        floors: data.floors,
        elevationM: data.elevation_m,
        operator: data.operator,
        phone: data.phone,
        /** どこから来たデータか。画面に必ず出す */
        source: data.source,
        sourceUpdatedAt: data.source_updated_at,
        isActive: data.is_active,
        acceptances: toAcceptanceList(acceptances, data.id),
        hazardSupports: toHazardSupportList(hazardSupports, data.id),
      };
    }),
});
