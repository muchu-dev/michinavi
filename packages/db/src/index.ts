/**
 * DB のスキーマ型と、リクエスト単位の Supabase クライアント。
 *
 * `database.types.ts` は `pnpm db:types` で supabase/migrations から生成する。
 * 手で書き換えない。
 */
export * from "./client";
export * from "./database.types";
