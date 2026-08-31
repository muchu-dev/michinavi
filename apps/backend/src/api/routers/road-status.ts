import { z } from "zod";
import { generateStructuredJson } from "../../ai/gemini-client";
import { getServiceRoleClient } from "../../db/service-role";
import {
  type AggregatableReport,
  countByCondition,
  dedupeReports,
  majorityCondition,
} from "../../reports/aggregate";
import { toTRPCError } from "../errors";
import type { TRPCContext } from "../init";
import { createTRPCRouter, publicProcedure } from "../init";

const roadConditionSchema = z.enum(["passable", "caution", "impassable"]);
const confidenceSchema = z.enum(["high", "medium", "low"]);

/**
 * Gemini からの応答の形。呼び出し元は必ずこれで検証する。
 * reportCount はここに含めない。件数はサーバーが知っている事実であって
 * モデルに申告させるものではないため、常に reports.length で上書きする
 */
const estimateResponseSchema = z.object({
  meshCode: z.string().regex(/^\d{10}$/),
  roadCondition: roadConditionSchema,
  confidence: confidenceSchema,
  reasoning: z.string().trim().min(1).max(200),
});

type EstimateResult = z.infer<typeof estimateResponseSchema>;

/** Gemini の generationConfig.responseSchema（OpenAPI のサブセット） */
const GEMINI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    meshCode: { type: "string" },
    roadCondition: {
      type: "string",
      enum: ["passable", "caution", "impassable"],
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    reasoning: { type: "string" },
  },
  required: ["meshCode", "roadCondition", "confidence", "reasoning"],
};

/** この時間より古い投稿は推定の根拠にしない（field_reports の既定の有効期限に合わせる） */
const REPORT_WINDOW_HOURS = 6;
/** 1回の推定に使う投稿の上限。プロンプトが無制限に伸びるのを防ぐ */
const MAX_REPORTS_PER_ESTIMATE = 50;
/** 1回の一覧取得で返す上限 */
const DEFAULT_LIST_LIMIT = 500;

/**
 * Gemini が使えない・出力が不正なときのフォールバック。
 * 単純な多数決で、同数のときは深刻な方（通れない > 注意 > 通れる）を優先する。
 * これがあるおかげで、AI が落ちていても「投稿を入れると道路状態のJSONが返る」が崩れない
 */
function majorityVoteFallback(
  meshCode: string,
  reports: readonly AggregatableReport[],
): EstimateResult {
  return {
    meshCode,
    roadCondition: majorityCondition(countByCondition(reports)),
    confidence: "low",
    reasoning: "AIの推定に失敗したため、報告件数の多数決で算出しました",
  };
}

function buildPrompt(
  meshCode: string,
  reports: readonly AggregatableReport[],
  nowMs: number,
): string {
  const items = reports.map((report) => ({
    roadCondition: report.road_condition,
    minutesAgo: Math.max(
      0,
      Math.round((nowMs - new Date(report.created_at).getTime()) / 60_000),
    ),
  }));

  return `あなたは災害時の道路の通行可否を要約するアシスタントです。
以下は、ある地点（mesh_code = "${meshCode}"）について住民から寄せられた
通行可否の報告です。この JSON 配列の内容だけを根拠に判断してください。
配列以外にはどんな情報も与えられていません。

報告データ:
${JSON.stringify(items)}

各要素の roadCondition は "passable"（通れる）/ "caution"（注意）/
"impassable"（通れない）のいずれかで、minutesAgo は何分前の報告かを表します。

多数決を基本にしつつ、直近の報告をより重視して、この地点の現在の状態を
1 つだけ推定してください。meshCode は必ず "${meshCode}" のまま返し、
他の地点について答えないでください。`;
}

/**
 * 投稿（field_reports の INSERT）を受けて、その mesh_code の道路状態推定を
 * 再計算し road_status_estimates に保存する。
 *
 * 集計の母数は重複統合後の報告に限る（BE-18）。同じ人が「通れない」を
 * 3 回送っても 3 票にはならない。
 *
 * Gemini の呼び出しが失敗しても例外を投げない。呼び出し元（fieldReport.create）の
 * 投稿保存を道連れにしないため、失敗はすべてここで吸収し多数決にフォールバックする。
 */
export async function refreshRoadStatusEstimate(
  supabase: TRPCContext["supabase"],
  meshCode: string,
): Promise<void> {
  const since = new Date(
    Date.now() - REPORT_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("field_reports")
    .select("user_id, road_condition, created_at")
    .eq("report_type", "road")
    .eq("mesh_code", meshCode)
    .is("deleted_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(MAX_REPORTS_PER_ESTIMATE);

  // 対象が読めない・0 件なら更新するものが無い
  if (error || !data || data.length === 0) {
    if (error) {
      console.warn("[road-status] field_reports の取得に失敗しました", error);
    }
    return;
  }

  // report_type = 'road' の行は road_condition が NOT NULL（field_reports_type_check）
  const { active } = dedupeReports(
    data.filter(
      (row): row is AggregatableReport => row.road_condition !== null,
    ),
  );

  if (active.length === 0) {
    return;
  }

  let result = majorityVoteFallback(meshCode, active);

  try {
    const geminiResult = await generateStructuredJson({
      prompt: buildPrompt(meshCode, active, Date.now()),
      responseSchema: GEMINI_RESPONSE_SCHEMA,
    });

    if (geminiResult.ok) {
      const parsed = estimateResponseSchema.safeParse(
        JSON.parse(geminiResult.raw),
      );
      // 意味の検証: 尋ねた地点以外について答えていたら使わない
      if (parsed.success && parsed.data.meshCode === meshCode) {
        result = parsed.data;
      }
    }
  } catch {
    // JSON.parse の失敗などもすべて多数決の結果をそのまま使う
  }

  const serviceRole = getServiceRoleClient();
  if (!serviceRole) {
    console.warn(
      "[road-status] SUPABASE_SECRET_KEY が未設定のため road_status_estimates を更新できません",
    );
    return;
  }

  const { error: upsertError } = await serviceRole
    .from("road_status_estimates")
    .upsert(
      {
        mesh_code: meshCode,
        road_condition: result.roadCondition,
        confidence: result.confidence,
        // 件数はサーバーが知っている事実。モデルの申告値は使わない。
        // 重複統合後の件数を使う（field_report_digests の reportCount と同じ母数にする）
        report_count: active.length,
        reasoning: result.reasoning,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "mesh_code" },
    );

  if (upsertError) {
    console.warn(
      "[road-status] road_status_estimates の更新に失敗しました",
      upsertError,
    );
  }
}

const listInputSchema = z
  .object({
    limit: z.int().min(1).max(DEFAULT_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
  })
  .default({ limit: DEFAULT_LIST_LIMIT });

export const roadStatusRouter = createTRPCRouter({
  /**
   * mesh_code ごとの道路状態推定を返す（BE-16）。
   * 保存済みの推定を読むだけで、この procedure 自体は Gemini を呼ばない
   * （閲覧のたびに呼ぶと費用と待ち時間が計算不能になるため）。
   */
  list: publicProcedure.input(listInputSchema).query(async ({ ctx, input }) => {
    const { data, error } = await ctx.supabase
      .from("road_status_estimates")
      .select(
        "mesh_code, road_condition, confidence, report_count, reasoning, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(input.limit);

    if (error) {
      throw toTRPCError(error, "道路状態の取得に失敗しました");
    }

    return data.map((row) => ({
      meshCode: row.mesh_code,
      roadCondition: row.road_condition,
      confidence: row.confidence,
      reportCount: row.report_count,
      reasoning: row.reasoning,
      updatedAt: row.updated_at,
    }));
  }),
});
