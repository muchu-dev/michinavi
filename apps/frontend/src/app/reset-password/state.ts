/**
 * 新しいパスワードの入力フォームの状態。
 *
 * `actions.ts` から分けているのは、`"use server"` を付けたファイルが
 * async 関数以外を export できないためである（初期値を置くと実行時に落ちる）。
 */
export type PasswordUpdateState = {
  fieldErrors?: {
    password?: string[];
    passwordConfirmation?: string[];
  };
  message?: string;
};

export const initialPasswordUpdateState: PasswordUpdateState = {};
