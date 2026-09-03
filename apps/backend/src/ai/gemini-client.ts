import { env } from "../env.backend";

/**
 * "latest" エイリアスを既定にするのは、特定のバージョン名（例: gemini-2.5-flash）を
 * 固定すると、Google 側の廃止でいきなり 404 になるためである。
 * 実際に 2.5-flash が廃止され 3.6-flash への切り替えを促すエラーになることを確認済み。
 * それでもエイリアスは出力の傾向が予告なく変わりうるため、env で上書きできるようにする
 */
const GEMINI_MODEL = env.GEMINI_MODEL ?? "gemini-flash-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/** 投稿の保存をブロックし続けないための上限。超えたらフォールバックへ倒す */
const GEMINI_TIMEOUT_MS = 5_000;

export type GeminiJsonResult =
  | { ok: true; raw: string }
  | { ok: false; error: string };

/**
 * Gemini に構造化出力（JSON）を要求する薄いラッパー。
 * SDK は増やさず fetch で直接叩く。
 *
 * 呼び出し元は必ず戻り値を Zod で検証すること。
 * responseSchema で形式を強制しても、モデルの出力保証だけを信用しない
 * （docs/er/07-safety-moderation.md#プロンプトインジェクションへの対策の「形式の検証」層）。
 */
export async function generateStructuredJson(params: {
  prompt: string;
  // Gemini の responseSchema（OpenAPI のサブセット）。呼び出し元が形を決める
  responseSchema: unknown;
}): Promise<GeminiJsonResult> {
  if (!env.GEMINI_API_KEY) {
    return { ok: false, error: "GEMINI_API_KEY is not configured" };
  }

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: params.prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: params.responseSchema,
        },
      }),
      // Serverless では投げっぱなしにしても応答後に実行が止まりうるため、
      // 短いタイムアウトで確実にフォールバックへ倒す
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });

    if (!res.ok) {
      return {
        ok: false,
        error: `Gemini API error: ${res.status} ${res.statusText}`,
      };
    }

    const body = await res.json();
    const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof text !== "string") {
      return { ok: false, error: "Gemini returned no text content" };
    }

    return { ok: true, raw: text };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
