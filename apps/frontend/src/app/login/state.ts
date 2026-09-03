/**
 * ログインフォームの状態。
 *
 * `actions.ts` から分けているのは、`"use server"` を付けたファイルが
 * async 関数以外を export できないためである（初期値を置くと実行時に落ちる）。
 */
export type LoginActionState = {
  fieldErrors?: {
    email?: string[];
    password?: string[];
  };
  message?: string;
  values?: { email: string; next?: string };
};

export const initialLoginState: LoginActionState = {};
