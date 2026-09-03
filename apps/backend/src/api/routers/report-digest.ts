import { z } from "zod";
import { generateStructuredJson } from "../../ai/gemini-client";
import { getServiceRoleClient } from "../../db/service-role";
import {
  type AggregatableReport,
  countByCondition,
  countReporters,
  dedupeReports,
  majorityCondition,
  type RoadCondition,
} from "../../reports/aggregate";
import { toTRPCError } from "../errors";
import type { TRPCContext } from "../init";
import { createTRPCRouter, publicProcedure } from "../init";

const CONDITION_LABELS: Record<RoadCondition, string> = {
  passable: "通れる",
  caution: "注意",
  impassable: "通れない",
};

/** 要約はカードの 1 行に収める。長い文はカード側で切られて意味が変わる */
const SUMMARY_MAX_LENGTH = 60;

/** Gemini からの応答の形。呼び出し元は必ずこれで検証する */
const summaryResponseSchema = z.object({
  meshCode: z.string().regex(/^\d{10}$/),
  summary: z
    .string()
    .trim()
    .min(1)
    .max(SUMMARY_MAX_LENGTH)
    // カードは 1 行で描くため、改行を含む出力は使わない
    .refine((value) => !value.includes("\n")),
});

/** Gemini の generationConfig.responseSchema（OpenAPI のサブセット） */
const GEMINI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    meshCode: { type: "string" },
    summary: { type: "string" },
  },
  required: ["meshCode", "summary"],
};

/** 重複統合まで終わった、カード 1 枚分の事実 */
type DigestFacts = {
  meshCode: string;
  roadCondition: RoadCondition;
  reportCount: number;
  mergedCount: number;
  reporterCount: number;
  counts: Record<RoadCondition, number>;
  latestReportedAt: string;
};

/**
 * AI を使わずに組み立てる要約。
 *
 * Gemini が落ちていても「同一地点の投稿が 1 つのカードにまとまる」が
 * 崩れないようにするための定型文で、内容はすべて集計結果から決まる。
 */
function fallbackSummary(facts: DigestFacts): string {
  const breakdown = `通れる${facts.counts.passable}件・注意${facts.counts.caution}件・通れない${facts.counts.impassable}件`;
  const merged =
    facts.mergedCount > 0 ? `重複${facts.mergedCount}件は統合しました。` : "";

  return `現在は「${CONDITION_LABELS[facts.roadCondition]}」とみています。内訳は${breakdown}、${facts.reporterCount}人からの報告です。${merged}`;
}

/**
 * 住民が書いた自由記述は一切渡さず、サーバが数えた事実だけを JSON で渡す
 * （docs/er/07-safety-moderation.md#プロンプトインジェクションへの対策 の
 * 「入力の隔離」と「入力の変換」の層）。
 * 現状の field_reports には自由記述の列そのものが無いため、
 * この地点で AI に届く住民由来の値は enum と時刻に限られる。
 */
function buildPrompt(facts: DigestFacts, nowMs: number): string {
  const aggregated = {
    meshCode: facts.meshCode,
    roadCondition: facts.roadCondition,
    passableCount: facts.counts.passable,
    cautionCount: facts.counts.caution,
    impassableCount: facts.counts.impassable,
    reporterCount: facts.reporterCount,
    mergedCount: facts.mergedCount,
    latestMinutesAgo: Math.max(
      0,
      Math.round((nowMs - Date.parse(facts.latestReportedAt)) / 60_000),
    ),
  };

  return `あなたは災害時の地図に出す短い説明文を作るアシスタントです。
以下は、ある地点（mesh_code = "${facts.meshCode}"）に届いた通行可否の報告を、
重複を取り除いて集計した結果です。この JSON の数値だけを根拠にしてください。
JSON 以外の情報は与えられていません。

集計データ:
${JSON.stringify(aggregated)}

roadCondition は "passable"（通れる）/ "caution"（注意）/
"impassable"（通れない）のいずれかで、mergedCount は同じ人の連投として
まとめた件数、latestMinutesAgo は最新の報告が何分前かを表します。

この地点のカードに 1 行で出す日本語の要約を、${SUMMARY_MAX_LENGTH}文字以内で書いてください。
「避難してください」のような行動の指示は書かず、報告の状況だけを述べてください。
meshCode は必ず "${facts.meshCode}" のまま返し、他の地点について答えないでください。`;
}

/**
 * 同一地点の報告をまとめ、カード 1 枚分の要約を field_report_digests に保存する（BE-18）。
 *
 * BE-16 と同じく、呼び出し元（fieldReport.create）の投稿保存を道連れにしないため、
 * 失敗はすべてここで吸収する。要約の生成に失敗しても集計結果は保存する。
 */
export async function refreshFieldReportDigest(
  supabase: TRPCContext["supabase"],
  meshCode: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("field_reports")
    .select("user_id, road_condition, created_at")
    .eq("report_type", "road")
    .eq("mesh_code", meshCode)
    .is("deleted_at", null);

  if (error || !data || data.length === 0) {
    return;
  }

  // report_type = 'road' の行は road_condition が NOT NULL（field_reports_type_check）
  const reports = data.filter(
    (row): row is AggregatableReport => row.road_condition !== null,
  );

  const { active, mergedCount } = dedupeReports(reports);
  const latest = active[0];

  if (!latest) {
    return;
  }

  const counts = countByCondition(active);

  // 代表的な状態は BE-16 の推定を優先する。同じ投稿で先に再計算されているため、
  // 通常はこの行がある。読めなかった場合だけ統合後の多数決で埋める
  const { data: estimate } = await supabase
    .from("road_status_estimates")
    .select("road_condition")
    .eq("mesh_code", meshCode)
    .maybeSingle();

  const facts: DigestFacts = {
    meshCode,
    roadCondition: estimate?.road_condition ?? majorityCondition(counts),
    reportCount: active.length,
    mergedCount,
    reporterCount: countReporters(active),
    counts,
    latestReportedAt: latest.created_at,
  };

  let summary = fallbackSummary(facts);
  let isAiSummary = false;

  try {
    const geminiResult = await generateStructuredJson({
      prompt: buildPrompt(facts, Date.now()),
      responseSchema: GEMINI_RESPONSE_SCHEMA,
    });

    if (geminiResult.ok) {
      const parsed = summaryResponseSchema.safeParse(
        JSON.parse(geminiResult.raw),
      );
      // 意味の検証: 尋ねた地点以外について答えていたら使わない。
      // ここで検証できるのは形式と地点までで、文面の妥当性そのものは
      // 検証できない（docs/er/07-safety-moderation.md、BE-17）
      if (parsed.success && parsed.data.meshCode === meshCode) {
        summary = parsed.data.summary;
        isAiSummary = true;
      }
    }
  } catch {
    // JSON.parse の失敗などもすべて定型文のまま進める
  }

  const serviceRole = getServiceRoleClient();
  if (!serviceRole) {
    console.warn(
      "[report-digest] SUPABASE_SECRET_KEY が未設定のため field_report_digests を更新できません",
    );
    return;
  }

  await serviceRole.from("field_report_digests").upsert(
    {
      mesh_code: meshCode,
      road_condition: facts.roadCondition,
      report_count: facts.reportCount,
      merged_count: facts.mergedCount,
      reporter_count: facts.reporterCount,
      passable_count: counts.passable,
      caution_count: counts.caution,
      impassable_count: counts.impassable,
      latest_reported_at: facts.latestReportedAt,
      summary,
      is_ai_summary: isAiSummary,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "mesh_code" },
  );
}

const listInputSchema = z.object({
  limit: z.int().min(1).max(100).default(50),
  /**
   * メッシュコードの前方一致で地点を絞る。
   * 8 桁を渡せば約 1km 四方、6 桁なら広域という具合に、
   * 地図の縮尺に合わせて呼び出し側が桁数を決める
   */
  meshCodePrefix: z
    .string()
    .regex(
      /^\d{1,10}$/,
      "メッシュコードの前方一致は 1〜10 桁の数字で指定してください",
    )
    .optional(),
});

export const reportDigestRouter = createTRPCRouter({
  /**
   * 同一地点の投稿をまとめたカードを、新しい報告のあった順に返す（BE-18）。
   *
   * 保存済みの集計を読むだけで、この procedure 自体は Gemini を呼ばない
   * （閲覧のたびに呼ぶと費用と待ち時間が計算不能になるため。BE-16 と同じ方針）。
   */
  list: publicProcedure.input(listInputSchema).query(async ({ ctx, input }) => {
    let query = ctx.supabase
      .from("field_report_digests")
      .select(
        "mesh_code, road_condition, report_count, merged_count, reporter_count, passable_count, caution_count, impassable_count, latest_reported_at, summary, is_ai_summary, updated_at",
      );

    if (input.meshCodePrefix) {
      query = query.like("mesh_code", `${input.meshCodePrefix}%`);
    }

    const { data, error } = await query
      .order("latest_reported_at", { ascending: false })
      .limit(input.limit);

    if (error) {
      throw toTRPCError(error, "投稿の要約の取得に失敗しました");
    }

    return data.map((row) => ({
      meshCode: row.mesh_code,
      roadCondition: row.road_condition,
      reportCount: row.report_count,
      mergedCount: row.merged_count,
      reporterCount: row.reporter_count,
      counts: {
        passable: row.passable_count,
        caution: row.caution_count,
        impassable: row.impassable_count,
      },
      latestReportedAt: row.latest_reported_at,
      summary: row.summary,
      isAiSummary: row.is_ai_summary,
      updatedAt: row.updated_at,
    }));
  }),
});
