import type { PostgrestError } from "@supabase/supabase-js";
import { TRPCError } from "@trpc/server";
import { match } from "ts-pattern";

/**
 * PostgREST から返ったエラーを tRPC のエラーへ移す。
 *
 * DB 側の詳細（制約名、テーブル名）はクライアントへ渡さない。
 * どのテーブルにどんな一意制約があるかは、他人のデータの有無を推測する材料になる。
 */
export function toTRPCError(
  error: PostgrestError,
  fallbackMessage: string,
): TRPCError {
  const { code, message } = match(error.code)
    // 認証されていない状態で DB 関数を呼んだ
    .with("28000", () => ({
      code: "UNAUTHORIZED" as const,
      message: "ログインが必要です",
    }))
    // JWT の期限切れなど（PostgREST が返す）
    .with("PGRST301", () => ({
      code: "UNAUTHORIZED" as const,
      message: "ログインの有効期限が切れました",
    }))
    // RLS または権限で弾かれた
    .with("42501", () => ({
      code: "FORBIDDEN" as const,
      message: "この操作は許可されていません",
    }))
    // 参照先が無い（存在しない地区など）。23503 は地区専用ではないため、
    // 断定しすぎないメッセージにする
    .with("23503", () => ({
      code: "BAD_REQUEST" as const,
      message: "指定された値が正しくありません",
    }))
    // DB 関数内の RAISE EXCEPTION（対象の世帯や構成員が見つからない）
    .with("P0002", () => ({
      code: "NOT_FOUND" as const,
      message: "指定された世帯または構成員が見つかりません",
    }))
    // レート制限（create_field_report の RAISE）
    .with("P0001", () => ({
      code: "TOO_MANY_REQUESTS" as const,
      message:
        "投稿の回数が上限に達しました。しばらく時間をおいてからお試しください",
    }))
    // 一意制約違反
    .with("23505", () => ({
      code: "CONFLICT" as const,
      message: "すでに登録されています",
    }))
    // CHECK 制約違反、NOT NULL 違反
    .with("23514", "23502", () => ({
      code: "BAD_REQUEST" as const,
      message: "入力の内容が正しくありません",
    }))
    .otherwise(() => ({
      code: "INTERNAL_SERVER_ERROR" as const,
      message: fallbackMessage,
    }));

  return new TRPCError({
    code,
    message,
    // 元のエラーはサーバーのログにだけ残す
    cause: new Error(`${error.code}: ${error.message}`),
  });
}
