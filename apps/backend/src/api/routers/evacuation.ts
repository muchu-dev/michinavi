import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { generateStructuredJson } from "../../ai/gemini-client";
import {
  buildCandidates,
  buildSummary,
  type EvacuationCandidate,
  type HouseholdFacts,
  type OptionKey,
  type RoadFacts,
  type SwitchCriterion,
} from "../../evacuation/options";
import { toTRPCError } from "../errors";
import type { TRPCContext } from "../init";
import { createTRPCRouter, protectedProcedure } from "../init";

/** 提案が有効な時間。状況は動くので、古い提案をそのまま出し続けない */
const ADVICE_VALID_MINUTES = 180;

const SWITCH_TRIGGER_TYPES = [
  "alert_level",
  "rainfall",
  "river_level",
  "daylight",
  "elapsed_time",
  "observation",
  "congestion",
] as const;

/**
 * Gemini からの応答の形。
 *
 * option_type と travel_mode は含めない。移動手段を AI に選ばせると、
 * 車の無い世帯に車の選択肢が返る余地が残る。AI に任せるのは
 * 並び順・文面・切り替え基準だけで、選択肢の中身はサーバが決めた候補を使う
 * （docs/er/07-safety-moderation.md#プロンプトインジェクションへの対策）。
 */
const aiCriterionSchema = z.object({
  triggerType: z.enum(SWITCH_TRIGGER_TYPES),
  description: z.string().trim().min(1).max(200),
  thresholdValue: z.number().finite().min(-1000).max(10_000).nullish(),
  thresholdUnit: z.string().trim().min(1).max(20).nullish(),
  comparator: z.enum(["gte", "lte"]).nullish(),
  switchToKey: z.string().trim().min(1).max(40).nullish(),
});

const aiOptionSchema = z.object({
  key: z.string().trim().min(1).max(40),
  rank: z.int().min(1).max(5),
  title: z.string().trim().min(1).max(40),
  reason: z.string().trim().min(1).max(200),
  riskNote: z.string().trim().min(1).max(200).nullish(),
  switchCriteria: z.array(aiCriterionSchema).max(3).default([]),
});

const aiAdviceSchema = z.object({
  summary: z.string().trim().min(1).max(200),
  options: z.array(aiOptionSchema).min(1).max(5),
});

/** Gemini の generationConfig.responseSchema（OpenAPI のサブセット） */
const GEMINI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    options: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          rank: { type: "integer" },
          title: { type: "string" },
          reason: { type: "string" },
          riskNote: { type: "string" },
          switchCriteria: {
            type: "array",
            items: {
              type: "object",
              properties: {
                triggerType: {
                  type: "string",
                  enum: [...SWITCH_TRIGGER_TYPES],
                },
                description: { type: "string" },
                thresholdValue: { type: "number" },
                thresholdUnit: { type: "string" },
                comparator: { type: "string", enum: ["gte", "lte"] },
                switchToKey: { type: "string" },
              },
              required: ["triggerType", "description"],
            },
          },
        },
        required: ["key", "rank", "title", "reason", "switchCriteria"],
      },
    },
  },
  required: ["summary", "options"],
};

/**
 * 呼び出し元の既定の世帯から、提案の入力になる事実を集める。
 * 要配慮の自由記述（detail）は読まない（docs/er/07-safety-moderation.md）。
 */
async function resolvePrimaryHouseholdId(
  supabase: TRPCContext["supabase"],
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .maybeSingle();

  if (error) {
    throw toTRPCError(error, "世帯の取得に失敗しました");
  }
  if (!data) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "世帯が見つかりません",
    });
  }

  return data.household_id;
}

async function fetchHouseholdFacts(
  supabase: TRPCContext["supabase"],
  userId: string,
): Promise<{
  householdId: string;
  homeMeshCode: string;
  facts: HouseholdFacts;
}> {
  const householdId = await resolvePrimaryHouseholdId(supabase, userId);

  const [
    { data: household, error: householdError },
    { data: members, error: membersError },
    { data: pets, error: petsError },
  ] = await Promise.all([
    supabase
      .from("households")
      .select("home_mesh_code, car_count, has_car")
      .eq("id", householdId)
      .single(),
    supabase
      .from("household_members")
      .select("id, age_group, needs_assistance")
      .eq("household_id", householdId),
    supabase.from("pets").select("count").eq("household_id", householdId),
  ]);

  if (householdError) {
    throw toTRPCError(householdError, "世帯の取得に失敗しました");
  }
  if (membersError) {
    throw toTRPCError(membersError, "構成員の取得に失敗しました");
  }
  if (petsError) {
    throw toTRPCError(petsError, "ペットの取得に失敗しました");
  }
  if (!household) {
    throw new TRPCError({ code: "NOT_FOUND", message: "世帯が見つかりません" });
  }

  const memberRows = members ?? [];
  const memberIds = memberRows.map((row) => row.id);

  const { data: careNeedLinks, error: careNeedsError } =
    memberIds.length > 0
      ? await supabase
          .from("household_member_care_needs")
          .select("care_needs(key)")
          .in("household_member_id", memberIds)
      : { data: [], error: null };

  if (careNeedsError) {
    throw toTRPCError(careNeedsError, "要配慮の取得に失敗しました");
  }

  return {
    householdId,
    homeMeshCode: household.home_mesh_code,
    facts: {
      memberCount: memberRows.length,
      infantCount: memberRows.filter((row) => row.age_group === "infant")
        .length,
      seniorCount: memberRows.filter((row) => row.age_group === "senior")
        .length,
      needsAssistanceCount: memberRows.filter((row) => row.needs_assistance)
        .length,
      careNeedKeys: (careNeedLinks ?? []).flatMap((link) =>
        link.care_needs ? [link.care_needs.key] : [],
      ),
      petCount: (pets ?? []).reduce((total, pet) => total + pet.count, 0),
      carCount: household.car_count,
      hasCar: household.has_car ?? household.car_count > 0,
    },
  };
}

/**
 * 自宅と同じ 1km メッシュ（10 桁のうち上位 8 桁）の道路状態推定を数える。
 *
 * 半径で絞らずメッシュの前方一致にするのは、投稿位置を座標で持たない
 * （S1、docs/er/00-conventions.md#位置情報の扱い）ためである。
 */
async function fetchRoadFacts(
  supabase: TRPCContext["supabase"],
  homeMeshCode: string,
): Promise<RoadFacts> {
  const { data, error } = await supabase
    .from("road_status_estimates")
    .select("road_condition, report_count")
    .like("mesh_code", `${homeMeshCode.slice(0, 8)}%`);

  if (error) {
    throw toTRPCError(error, "周辺の道路状況の取得に失敗しました");
  }

  const rows = data ?? [];

  return {
    meshCount: rows.length,
    passable: rows.filter((row) => row.road_condition === "passable").length,
    caution: rows.filter((row) => row.road_condition === "caution").length,
    impassable: rows.filter((row) => row.road_condition === "impassable")
      .length,
    reportCount: rows.reduce((total, row) => total + row.report_count, 0),
  };
}

function buildPrompt(
  facts: HouseholdFacts,
  road: RoadFacts,
  candidates: readonly EvacuationCandidate[],
): string {
  // 住民の自由記述は渡さない。渡すのはサーバが数えた件数と、
  // サーバが決めた候補のキーだけである
  const input = {
    household: {
      memberCount: facts.memberCount,
      infantCount: facts.infantCount,
      seniorCount: facts.seniorCount,
      needsAssistanceCount: facts.needsAssistanceCount,
      careNeedCount: facts.careNeedKeys.length,
      petCount: facts.petCount,
      carCount: facts.carCount,
    },
    surroundings: road,
    candidates: candidates.map((candidate) => ({
      key: candidate.key,
      optionType: candidate.optionType,
      travelMode: candidate.travelMode,
    })),
  };

  return `あなたは災害時に住民が自分で判断するための材料を整えるアシスタントです。
以下の JSON は、ある世帯の構成と自宅周辺の通行可否の集計、そしてサーバが
選んだ選択肢の候補です。この JSON の内容だけを根拠にしてください。
JSON 以外の情報は与えられていません。

入力データ:
${JSON.stringify(input)}

守ること:
- candidates に無いキーの選択肢を作らないでください。候補は増やしても減らしても
  いけません。key は候補のものをそのまま使ってください
- rank は 1 から ${candidates.length} までを 1 つずつ使ってください
- switchToKey には candidates のキーか null だけを入れてください
- 「必ず避難してください」のような断定的な指示ではなく、選択肢と、
  どうなったら切り替えるかという基準を書いてください
- 各選択肢には、その選択肢の弱点を riskNote に必ず書いてください
- しきい値を書く場合は thresholdValue・thresholdUnit・comparator の 3 つを
  そろえてください。1 つでも欠ける場合は 3 つとも省いてください
- title は 40 文字以内、reason と riskNote と description は 200 文字以内、
  summary は 200 文字以内の日本語で書いてください`;
}

/**
 * AI の出力を、サーバが決めた候補と突き合わせて検査する（意味の検証）。
 *
 * 通らなければ null を返し、呼び出し元は決定論的な候補をそのまま使う。
 * 一部だけ採用して混ぜると、どこまでが AI の判断か後から追えなくなる。
 */
function applyAiAdvice(
  candidates: readonly EvacuationCandidate[],
  parsed: z.infer<typeof aiAdviceSchema>,
): { summary: string; options: EvacuationCandidate[] } | null {
  // AI が返すキーは検証前の string なので、突き合わせ用の Map も string で引く
  const byKey = new Map<string, EvacuationCandidate>(
    candidates.map((candidate) => [candidate.key, candidate]),
  );

  // 候補集合と過不足なく一致すること
  if (parsed.options.length !== candidates.length) {
    return null;
  }

  const returnedKeys = new Set(parsed.options.map((option) => option.key));
  if (returnedKeys.size !== candidates.length) {
    return null;
  }
  for (const key of returnedKeys) {
    if (!byKey.has(key)) {
      return null;
    }
  }

  // rank が 1..n の並べ替えになっていること
  const ranks = new Set(parsed.options.map((option) => option.rank));
  if (
    ranks.size !== candidates.length ||
    [...ranks].some((rank) => rank > candidates.length)
  ) {
    return null;
  }

  const options: EvacuationCandidate[] = [];

  for (const option of parsed.options) {
    const candidate = byKey.get(option.key);
    if (!candidate) {
      return null;
    }

    const switchCriteria: SwitchCriterion[] = [];

    for (const [index, criterion] of option.switchCriteria.entries()) {
      const hasThreshold =
        criterion.thresholdValue !== null &&
        criterion.thresholdValue !== undefined;
      const hasUnit =
        criterion.thresholdUnit !== null &&
        criterion.thresholdUnit !== undefined;
      const hasComparator =
        criterion.comparator !== null && criterion.comparator !== undefined;

      // 値・単位・比較は揃っているか、3 つとも無いかのどちらかに限る
      if (
        (hasThreshold || hasUnit || hasComparator) &&
        !(hasThreshold && hasUnit && hasComparator)
      ) {
        return null;
      }

      const switchToKey = criterion.switchToKey ?? null;
      if (switchToKey !== null && !byKey.has(switchToKey)) {
        return null;
      }

      switchCriteria.push({
        triggerType: criterion.triggerType,
        description: criterion.description,
        thresholdValue: hasThreshold
          ? (criterion.thresholdValue ?? null)
          : null,
        thresholdUnit: hasUnit ? (criterion.thresholdUnit ?? null) : null,
        comparator: hasComparator ? (criterion.comparator ?? null) : null,
        switchToKey: switchToKey as OptionKey | null,
        displayOrder: index,
      });
    }

    options.push({
      ...candidate,
      // 種別と移動手段はサーバが決めた候補のまま。AI の出力では上書きしない
      rank: option.rank,
      title: option.title,
      reason: option.reason,
      riskNote: option.riskNote ?? null,
      switchCriteria,
    });
  }

  return {
    summary: parsed.summary,
    options: options.sort((a, b) => a.rank - b.rank),
  };
}

/**
 * 保存済みの提案を、選択肢と切り替え基準ごと読む。
 *
 * ユーザーの JWT で読むため、他人の世帯の提案は RLS が落とす（S6）。
 * 埋め込みの指定に制約名を使うのは、evacuation_switch_criteria から
 * evacuation_options への外部キーが 2 本（親と切り替え先）あり、
 * どちらを辿るか曖昧になるためである。
 */
async function fetchAdvice(
  supabase: TRPCContext["supabase"],
  householdId: string,
  adviceId: string,
) {
  const { data, error } = await supabase
    .from("evacuation_advices")
    .select(
      `id, summary, is_ai_generated, generated_at, expires_at, home_mesh_code, input_snapshot,
       evacuation_options (
         id, rank, option_type, travel_mode, title, reason, risk_note, estimated_minutes,
         evacuation_switch_criteria!evacuation_switch_criteria_option_fk (
           id, trigger_type, description, threshold_value, threshold_unit,
           comparator, switch_to_option_id, display_order
         )
       )`,
    )
    .eq("id", adviceId)
    // RLS でも他人の提案は落ちるが、router 側でも世帯を絞る
    // （docs/er/00-conventions.md#db-クライアントの使い分け の二枚目の防壁）
    .eq("household_id", householdId)
    .maybeSingle();

  if (error) {
    throw toTRPCError(error, "避難の提案の取得に失敗しました");
  }
  if (!data) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "避難の提案が見つかりません",
    });
  }

  return {
    adviceId: data.id,
    summary: data.summary,
    isAiGenerated: data.is_ai_generated,
    generatedAt: data.generated_at,
    expiresAt: data.expires_at,
    homeMeshCode: data.home_mesh_code,
    inputSnapshot: data.input_snapshot,
    options: [...data.evacuation_options]
      .sort((a, b) => a.rank - b.rank)
      .map((option) => ({
        id: option.id,
        rank: option.rank,
        optionType: option.option_type,
        travelMode: option.travel_mode,
        title: option.title,
        reason: option.reason,
        riskNote: option.risk_note,
        estimatedMinutes: option.estimated_minutes,
        switchCriteria: [...option.evacuation_switch_criteria]
          .sort((a, b) => a.display_order - b.display_order)
          .map((criterion) => ({
            id: criterion.id,
            triggerType: criterion.trigger_type,
            description: criterion.description,
            thresholdValue: criterion.threshold_value,
            thresholdUnit: criterion.threshold_unit,
            comparator: criterion.comparator,
            switchToOptionId: criterion.switch_to_option_id,
            displayOrder: criterion.display_order,
          })),
      })),
  };
}

export const evacuationRouter = createTRPCRouter({
  /**
   * 家族構成・移動手段・周辺の投稿状況から、複数の選択肢と切り替え基準を作る（BE-19）。
   *
   * 対象の世帯は JWT から解決するため household_id は入力に持たない。
   * 候補の絞り込みはサーバが決定論的に行い、AI には並び順と文面だけを任せる。
   * AI が使えない場合も、候補と定型の文面でそのまま提案を作る。
   *
   * 避難所の指定（どの避難所へ行くか）は含まない。shelters が入るのは BE-14 で、
   * ここでは「自宅にとどまる／徒歩／車」という移動手段の切り分け（B4）までを扱う。
   */
  generate: protectedProcedure.mutation(async ({ ctx }) => {
    const { householdId, homeMeshCode, facts } = await fetchHouseholdFacts(
      ctx.supabase,
      ctx.user.id,
    );
    const road = await fetchRoadFacts(ctx.supabase, homeMeshCode);

    const candidates = buildCandidates(facts, road);
    let summary = buildSummary(facts, road, candidates);
    let options = candidates;
    let isAiGenerated = false;

    try {
      const geminiResult = await generateStructuredJson({
        prompt: buildPrompt(facts, road, candidates),
        responseSchema: GEMINI_RESPONSE_SCHEMA,
      });

      if (geminiResult.ok) {
        const parsed = aiAdviceSchema.safeParse(JSON.parse(geminiResult.raw));
        const applied = parsed.success
          ? applyAiAdvice(candidates, parsed.data)
          : null;

        if (applied) {
          summary = applied.summary;
          options = applied.options;
          isAiGenerated = true;
        }
      }
    } catch {
      // JSON.parse の失敗などもすべて決定論的な候補のまま進める
    }

    const { data, error } = await ctx.supabase
      .rpc("save_evacuation_advice", {
        p_summary: summary,
        p_is_ai_generated: isAiGenerated,
        p_input_snapshot: { household: facts, surroundings: road },
        p_options: options.map((option) => ({
          key: option.key,
          rank: option.rank,
          optionType: option.optionType,
          travelMode: option.travelMode,
          title: option.title,
          reason: option.reason,
          riskNote: option.riskNote,
          // 所要時間は避難所の位置が要る。BE-14 と BE-20 が入るまで空にする
          estimatedMinutes: null,
          switchCriteria: option.switchCriteria,
        })),
        p_valid_minutes: ADVICE_VALID_MINUTES,
      })
      .single();

    if (error) {
      throw toTRPCError(error, "避難の提案の保存に失敗しました");
    }
    if (!data) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "避難の提案の保存に失敗しました",
      });
    }

    return fetchAdvice(ctx.supabase, householdId, data.evacuation_advice_id);
  }),

  /**
   * 自分の世帯の最新の提案を返す（BE-19）。
   * 期限切れの提案も返し、古いかどうかの判断は expiresAt を見る側に任せる。
   */
  latest: protectedProcedure.query(async ({ ctx }) => {
    const householdId = await resolvePrimaryHouseholdId(
      ctx.supabase,
      ctx.user.id,
    );

    const { data, error } = await ctx.supabase
      .from("evacuation_advices")
      .select("id")
      .eq("household_id", householdId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw toTRPCError(error, "避難の提案の取得に失敗しました");
    }
    if (!data) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "避難の提案がまだありません",
      });
    }

    return fetchAdvice(ctx.supabase, householdId, data.id);
  }),
});
