/**
 * パスワード再設定メールの送信フォームの状態。
 *
 * `actions.ts` から分けているのは、`"use server"` を付けたファイルが
 * async 関数以外を export できないためである（初期値を置くと実行時に落ちる）。
 */
export type PasswordResetRequestState = {
  fieldErrors?: { email?: string[] };
  message?: string;
  status?: "sent" | "error";
  values?: { email: string };
};

export const initialPasswordResetRequestState: PasswordResetRequestState = {};
