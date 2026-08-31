import { createServiceRoleClient } from "@michinavi/db";
import { env } from "../env.backend";

/**
 * service role クライアントを生成する、アプリ側で唯一の場所。
 *
 * RLS を迂回するため、road_status_estimates への書き込み（BE-16）のような
 * 「ユーザー自身のデータではない、サーバーが計算した結果を保存する」用途にだけ使う。
 * ここ以外のファイルで `createServiceRoleClient` を呼ばないこと
 * （docs/er/00-conventions.md#db-クライアントの使い分け）。
 */
export function getServiceRoleClient() {
  return createServiceRoleClient({
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    secretKey: env.SUPABASE_SECRET_KEY,
  });
}
