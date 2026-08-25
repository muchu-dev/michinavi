import { appRouter, createTRPCContext } from "@michinavi/backend";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

/**
 * バックエンド（@michinavi/backend）を HTTP に載せる唯一の場所。
 * 環境変数はバックエンド側が自分で読むため、ここには何も渡さない。
 */
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
    onError({ path, error }) {
      console.error(`tRPC error on '${path ?? "<no-path>"}':`, error.message);
    },
  });

export { handler as GET, handler as POST };
