import { emergencyGuidance } from "../fallback";
import { createTRPCRouter, publicProcedure } from "../init";

export const fallbackRouter = createTRPCRouter({
  /**
   * 行政と気象庁への誘導（BE-27）。
   *
   * 応答は固定で、DB も外部 API も見ない。ここが落ちるのは
   * サーバそのものが動いていないときだけである。
   *
   * この procedure が呼べない状況こそが本題なので、同じ内容を
   * エラー応答（errorFormatter）にも載せている。フロントエンドは
   * `@michinavi/backend` から定数として import することもできる。
   */
  guidance: publicProcedure.query(() => emergencyGuidance),
});
