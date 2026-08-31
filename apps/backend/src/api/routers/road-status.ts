import { z } from "zod";
import { generateStructuredJson } from "../../ai/gemini-client";
import { getServiceRoleClient } from "../../db/service-role";
import { toTRPCError } from "../errors";
import type { TRPCContext } from "../init";
import { createTRPCRouter, publicProcedure } from "../init";

const roadConditionSchema = z.enum(["passable", "caution", "impassable"]);
const confidenceSchema = z.enum(["high", "medium", "low"]);

/** Gemini からの応答の形。呼び出し元は必ずこれで検証する */
const estimateResponseSchema = z.object({
  meshCode: z.string().regex(/^\d{10}$/),
  roadCondition: roadConditionSchema,
  confidence: confidenceSchema,
  reportCount: z.int().min(1),
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
    reportCount: { type: "integer" },
    reasoning: { type: "string" },
  },
  required: [
    "meshCode",
    "roadCondition",
    "confidence",
    "reportCount",
    "reasoning",
  ],
};

type ActiveReport = {
  road_condition: "passable" | "caution" | "impassable";
  created_at: string;
};

/**
 * Gemini が使えない・出力が不正なときのフォールバック。
 * 単純な多数決で、同数のときは深刻な方（通れない > 注意 > 通れる）を優先する。
 * これがあるおかげで、AI が落ちていても「投稿を入れると道路状態のJSONが返る」が崩れない
 */
function majorityVoteFallback(
  meshCode: string,
  reports: readonly ActiveReport[],
): EstimateResult {
  const counts = { passable: 0, caution: 0, impassable: 0 };
  for (const report of reports) {
    counts[report.road_condition] += 1;
  }

  const severity = { impassable: 2, caution: 1, passable: 0 } as const;
  let winner: keyof typeof counts = "passable";
  for (const key of Object.keys(counts) as (keyof typeof counts)[]) {
    if (
      counts[key] > counts[winner] ||
      (counts[key] === counts[winner] && severity[key] > severity[winner])
    ) {
      winner = key;
    }
  }

  return {
    meshCode,
    roadCondition: winner,
    confidence: "low",
    reportCount: reports.length,
    reasoning: "AIの推定に失敗したため、報告件数の多数決で算出しました",
  };
}

function buildPrompt(
  meshCode: string,
  reports: readonly ActiveReport[],
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
 * Gemini の呼び出しが失敗しても例外を投げない。呼び出し元（fieldReport.create）の
 * 投稿保存を道連れにしないため、失敗はすべてここで吸収し多数決にフォールバックする。
 */
export async function refreshRoadStatusEstimate(
  supabase: TRPCContext["supabase"],
  meshCode: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("field_reports")
    .select("road_condition, created_at")
    .eq("report_type", "road")
    .eq("mesh_code", meshCode)
    .is("deleted_at", null);

  // 対象が読めない・0 件なら更新するものが無い
  if (error || !data || data.length === 0) {
    return;
  }

  const reports = data as ActiveReport[];
  let result = majorityVoteFallback(meshCode, reports);

  try {
    const geminiResult = await generateStructuredJson({
      prompt: buildPrompt(meshCode, reports, Date.now()),
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
  await serviceRole.from("road_status_estimates").upsert(
    {
      mesh_code: meshCode,
      road_condition: result.roadCondition,
      confidence: result.confidence,
      report_count: result.reportCount,
      reasoning: result.reasoning,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "mesh_code" },
  );
}

export const roadStatusRouter = createTRPCRouter({
  /**
   * mesh_code ごとの道路状態推定を返す（BE-16）。
   * 保存済みの推定を読むだけで、この procedure 自体は Gemini を呼ばない
   * （閲覧のたびに呼ぶと費用と待ち時間が計算不能になるため）。
   */
  list: publicProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("road_status_estimates")
      .select(
        "mesh_code, road_condition, confidence, report_count, reasoning, updated_at",
      );

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
