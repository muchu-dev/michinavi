/**
 * ログイン直後の既定の遷移先。
 *
 * 初回設定が済んでいる利用者は `/onboarding` 側で `/` へ送り返される
 * （src/app/onboarding/page.tsx）。遷移先の判定を 1 か所に寄せるため、
 * ログイン時点では初回設定の有無を問い合わせない。
 */
export const DEFAULT_SIGNED_IN_PATH = "/onboarding";

/**
 * 認証の途中に置かれた画面。
 * ログイン後の戻り先にすると同じ画面へ戻り続けてしまう。
 */
const AUTH_PATHS = ["/login", "/forgot-password", "/reset-password", "/auth"];

/** 改行によるヘッダー分割など、制御文字の混入を弾く */
// biome-ignore lint/suspicious/noControlCharactersInRegex: 制御文字そのものを検出するための判定
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function isAuthPath(pathname: string) {
  return AUTH_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * 「ログイン後に戻る場所」として受け取った値を、自サイト内の安全なパスへ絞る。
 *
 * `next` はクエリ文字列から来るため、利用者以外にも書き換えられる。
 * 絶対 URL やスキーム相対（`//host`）をそのまま `redirect()` へ渡すと、
 * ログイン画面のリンクを踏ませるだけで別サイトへ送り込めてしまう。
 * ここを通していない値を遷移先に使わないこと。
 */
export function resolveRedirectPath(
  value: unknown,
  fallback: string = DEFAULT_SIGNED_IN_PATH,
): string {
  if (typeof value !== "string" || value === "") {
    return fallback;
  }

  // 自サイト内の絶対パスだけを通す（`//host` と `/\host` は別ホストに解決される）
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\") ||
    CONTROL_CHARACTERS.test(value)
  ) {
    return fallback;
  }

  const [pathname] = value.split(/[?#]/);

  if (isAuthPath(pathname)) {
    return fallback;
  }

  return value;
}
