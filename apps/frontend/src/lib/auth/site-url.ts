const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

function toOrigin(value: string): string {
  const url = new URL(value);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("サイトの URL は http(s) で指定してください");
  }

  return url.origin;
}

function isLocalHost(host: string) {
  const hostname = host.split(":")[0];
  return LOCAL_HOSTNAMES.includes(hostname);
}

/**
 * メールに載せるリンクの起点になるオリジンを決める。
 *
 * 設定値（SITE_URL）を最優先にするのは、Host ヘッダーを差し替えたリクエストで
 * 再設定メールのリンク先を書き換えられないようにするためである。
 * 設定が無い環境（プレビュー配信など）ではリクエスト側の情報に落とすが、
 * リンク先の許可リストは Supabase 側にもある。
 */
export function resolveSiteOrigin(
  requestHeaders: Headers,
  configuredSiteUrl?: string,
): string {
  if (configuredSiteUrl) {
    return toOrigin(configuredSiteUrl);
  }

  const origin = requestHeaders.get("origin");

  if (origin) {
    return toOrigin(origin);
  }

  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (!host) {
    throw new Error("リクエストから配信元のホストを判定できませんでした");
  }

  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (isLocalHost(host) ? "http" : "https");

  return toOrigin(`${protocol}://${host}`);
}
