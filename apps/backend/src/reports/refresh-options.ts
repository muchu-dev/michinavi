import type { Database } from "@michinavi/db";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 地点ごとの再集計（refreshRoadStatusEstimate / refreshFieldReportDigest）に
 * 渡す任意設定。
 *
 * 既定値は投稿API（fieldReport.create）の経路に合わせてあるので、
 * 通常の呼び出しでは何も渡さなくてよい。デモ用データの投入（BE-26）だけが
 * 「AI を呼ばない」「接続先を明示する」ためにここを使う。
 *
 * このファイルが env を読まないのは、型と既定値の意味だけを置く場所に
 * したいためである。
 */
export type RefreshOptions = {
  /**
   * Gemini を呼ぶか。既定は true。
   *
   * デモ用データの投入では false にする。投入が外部APIの調子や鍵の有無に
   * 左右されると、発表直前に地図の吹き出しが空になりうるためである。
   * false のときは、AI が使えないときと同じ多数決・定型文で埋める。
   */
  useAi?: boolean;
  /**
   * 書き込みに使う service role クライアント。
   * 省略時は env（SUPABASE_SECRET_KEY）から作る。
   *
   * デモ用データの投入は CLI が解決した接続先へ書くため、そこだけ明示する。
   */
  writer?: SupabaseClient<Database>;
};
