/**
 * テスト用のヘルパー。
 *
 * `src/` の外に置いているのは、RLS を迂回する service role クライアントを
 * 含むためである（docs/er/00-conventions.md#db-クライアントの使い分け）。
 * アプリ本体から `@/` では到達できない。
 */
export * from "./supabase";
