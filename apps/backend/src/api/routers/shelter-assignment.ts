import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { toTRPCError } from "../errors";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../init";

/**
 * 避難先の分散（BE-21、機能 B3）。
 *
 * 避難所ごとの想定人数を集計し、定員を超えたら別の候補を割り当てる。
 * 「想定人数」は世帯の申告の合計であって、実際の滞在者数ではない。
 * 実際の人数には避難所側のアカウントが要る（D3）。
 */

const assignInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusM: z.number().min(100).max(50_000).default(5000),
  /** 候補として見る避難所の数 */
  candidateLimit: z.int().min(1).max(30).default(10),
});

export const shelterAssignmentRouter = createTRPCRouter({
  /**
   * 世帯の避難先を割り当てる（BE-21）。
   *
   * 近い順に見て、想定人数が定員に収まる最初の避難所を選ぶ。
   * どこにも収まらなければ、最も混雑率の低い避難所を「超過あり」として返す。
   * 候補が 1 つも残らない状態を作るほうが危険なためである
   * （docs/er/02-shelter.md）。
   *
   * 代替の候補も一緒に返す。集中している避難所に対して、
   * 次にどこがあるのかを画面で示せるようにする。
   */
  assign: protectedProcedure
    .input(assignInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .rpc("assign_shelter", {
          p_latitude: input.latitude,
          p_longitude: input.longitude,
          p_radius_m: input.radiusM,
          p_candidate_limit: input.candidateLimit,
        })
        .single();

      if (error) {
        throw toTRPCError(error, "避難先の割り当てに失敗しました");
      }
      if (!data) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "避難先の割り当てに失敗しました",
        });
      }

      // 割り当てた先を含む周辺の候補と、その混雑の度合いを添える
      const { data: candidates, error: candidatesError } =
        await ctx.supabase.rpc("nearby_shelters", {
          p_latitude: input.latitude,
          p_longitude: input.longitude,
          p_radius_m: input.radiusM,
          p_limit: input.candidateLimit,
        });

      if (candidatesError) {
        throw toTRPCError(candidatesError, "避難所の取得に失敗しました");
      }

      const shelters = candidates ?? [];
      const { data: loads, error: loadsError } = await ctx.supabase.rpc(
        "shelter_loads",
        { p_shelter_ids: shelters.map((shelter) => shelter.id) },
      );

      if (loadsError) {
        throw toTRPCError(loadsError, "避難所の想定人数の取得に失敗しました");
      }

      const withLoad = shelters.map((shelter) => {
        const load = (loads ?? []).find((row) => row.shelter_id === shelter.id);

        return {
          id: shelter.id,
          name: shelter.name,
          address: shelter.address,
          capacity: shelter.capacity,
          distanceM: Math.round(shelter.distance_m),
          expectedPeople: load?.expected_people ?? 0,
          householdCount: load?.household_count ?? 0,
          /** 定員が不明な避難所では null。率ではなく人数だけを見せる */
          occupancyRate: load?.occupancy_rate ?? null,
          isAssigned: shelter.id === data.shelter_id,
        };
      });

      const assigned = withLoad.find((shelter) => shelter.isAssigned);

      return {
        shelterId: data.shelter_id,
        shelterName: assigned?.name ?? null,
        partySize: data.party_size,
        /** 定員に収まる候補が無く、超過を承知で割り当てた */
        isOverCapacity: data.is_over_capacity,
        distanceM: Math.round(data.distance_m),
        /** 割り当て前の想定人数。ここに partySize が乗る */
        expectedPeopleBefore: data.expected_people,
        alternatives: withLoad.filter((shelter) => !shelter.isAssigned),
      };
    }),

  /** 自分の世帯の現在の避難先 */
  current: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("shelter_assignments")
      .select(
        "shelter_id, party_size, is_over_capacity, assigned_at, shelters(name, address, capacity)",
      )
      .maybeSingle();

    if (error) {
      throw toTRPCError(error, "避難先の取得に失敗しました");
    }
    if (!data) {
      return null;
    }

    return {
      shelterId: data.shelter_id,
      shelterName: data.shelters?.name ?? null,
      address: data.shelters?.address ?? null,
      capacity: data.shelters?.capacity ?? null,
      partySize: data.party_size,
      isOverCapacity: data.is_over_capacity,
      assignedAt: data.assigned_at,
    };
  }),

  /**
   * 避難所ごとの想定人数（B3）。
   * どの世帯が行くかは返さない。集計だけを公開する
   */
  loads: publicProcedure
    .input(z.object({ shelterIds: z.array(z.uuid()).min(1).max(50) }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase.rpc("shelter_loads", {
        p_shelter_ids: input.shelterIds,
      });

      if (error) {
        throw toTRPCError(error, "避難所の想定人数の取得に失敗しました");
      }

      return (data ?? []).map((row) => ({
        shelterId: row.shelter_id,
        expectedPeople: row.expected_people,
        householdCount: row.household_count,
        capacity: row.capacity,
        occupancyRate: row.occupancy_rate,
      }));
    }),
});
