/**
 * バックエンドの入口。
 *
 * ここから出ているものだけがフロントエンドから見える。
 * 環境変数（env.backend.ts）と procedure の実装は外へ出さない。
 *
 * このパッケージは Next.js にも React にも依存しない。
 * HTTP に載せるのは利用側の責務で、apps/frontend では
 * `src/app/api/trpc/[trpc]/route.ts` がマウントしている。
 */
export { createTRPCContext, type TRPCContext } from "./api/init";
export { type AppRouter, appRouter } from "./api/root";
