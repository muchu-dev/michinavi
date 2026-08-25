import type { TestUser } from "@michinavi/testing";
import { createTRPCContext } from "../init";
import { appRouter } from "../root";

/**
 * appRouter に依存するテストヘルパー。
 *
 * `@michinavi/testing` へ置かないのは、あちらがこのパッケージを参照し返すと
 * 依存が循環するためである。DB にしか依存しない部品だけが向こうに入る。
 */

/** ログイン済みユーザーとして tRPC を呼ぶ */
export async function createCallerFor(user: TestUser) {
  const ctx = await createTRPCContext({
    headers: new Headers({ authorization: `Bearer ${user.accessToken}` }),
  });

  return { ctx, caller: appRouter.createCaller(ctx) };
}

/** 未ログインの状態で tRPC を呼ぶ */
export async function createAnonymousCaller() {
  const ctx = await createTRPCContext({ headers: new Headers() });

  return { ctx, caller: appRouter.createCaller(ctx) };
}
