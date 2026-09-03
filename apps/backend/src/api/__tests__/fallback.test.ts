import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { describe, expect, test } from "vitest";
import { emergencyGuidance, shouldAttachGuidance } from "../fallback";
import { createTRPCContext, createTRPCRouter, publicProcedure } from "../init";
import { appRouter } from "../root";
import { createAnonymousCaller } from "./helpers";

describe("fallback.guidance", () => {
  test("未認証でも案内を取得できる", async () => {
    const { caller } = await createAnonymousCaller();
    const guidance = await caller.fallback.guidance();

    expect(guidance.links.length).toBeGreaterThan(0);
    expect(guidance.phones.map((phone) => phone.number)).toContain("119");
  });

  test("誘導先は実在する機関の URL になっている", () => {
    for (const link of emergencyGuidance.links) {
      expect(link.url.startsWith("https://")).toBe(true);
      expect(link.note.length).toBeGreaterThan(0);
    }
  });
});

describe("shouldAttachGuidance", () => {
  test("サーバ側の障害には案内を添える", () => {
    expect(shouldAttachGuidance("INTERNAL_SERVER_ERROR")).toBe(true);
    expect(shouldAttachGuidance("SERVICE_UNAVAILABLE")).toBe(true);
  });

  test("入力の誤りや権限不足には添えない", () => {
    // 通常の操作ミスにまで行政のリンクが並ぶと、本当に落ちたときの重みが薄れる
    expect(shouldAttachGuidance("BAD_REQUEST")).toBe(false);
    expect(shouldAttachGuidance("UNAUTHORIZED")).toBe(false);
    expect(shouldAttachGuidance("NOT_FOUND")).toBe(false);
  });
});

/** HTTP に載せたときの応答を実際に組み立てて確かめる */
async function callOverHttp(
  router: Parameters<typeof fetchRequestHandler>[0]["router"],
  path: string,
) {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: new Request(`http://localhost/api/trpc/${path}`),
    router,
    createContext: () => createTRPCContext({ headers: new Headers() }),
    onError: () => {},
  });

  // superjson を通しているので、本体は error.json の下に入る
  const body = (await response.json()) as {
    error: { json: { data: { code: string; fallback?: unknown } } };
  };

  return { status: response.status, data: body.error.json.data };
}

describe("エラー応答への案内の添付(BE-27)", () => {
  test("サーバ側で落ちたとき、応答に行政への案内が入る", async () => {
    const brokenRouter = createTRPCRouter({
      broken: publicProcedure.query(() => {
        throw new Error("データベースに接続できません");
      }),
    });

    const { status, data } = await callOverHttp(brokenRouter, "broken");

    expect(status).toBe(500);
    expect(data.code).toBe("INTERNAL_SERVER_ERROR");
    expect(data.fallback).toEqual(emergencyGuidance);
  });

  test("入力の誤りには案内を添えない", async () => {
    // 必須の入力を渡さずに呼ぶ
    const { data } = await callOverHttp(appRouter, "health.echo");

    expect(data.code).toBe("BAD_REQUEST");
    expect(data.fallback).toBeUndefined();
  });

  test("案内は通信できなくても使えるよう、定数として持ち出せる", () => {
    // フロントエンドは API を呼ばずに import できる
    expect(emergencyGuidance.headline.length).toBeGreaterThan(0);
    expect(emergencyGuidance.body.length).toBeGreaterThan(0);
  });
});
