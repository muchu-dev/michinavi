import type { Database } from "@michinavi/db";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * service role クライアントを作る唯一の場所。RLS を迂回するため、
 * テストでの検証と後片付け以外には使わない
 * （docs/er/00-conventions.md#db-クライアントの使い分け）。
 */
export function createServiceRoleClient(): SupabaseClient<Database> {
  return createClient<Database>(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** 開発・テスト用の seed に入っている地区（packages/db/supabase/seed.sql） */
export const SEED_AREA_IDS = {
  mabiYata: "00000000-0000-4000-8000-000000000003",
  mabiKawabe: "00000000-0000-4000-8000-000000000004",
  tamashima: "00000000-0000-4000-8000-000000000005",
} as const;

export type TestUser = {
  id: string;
  email: string;
  accessToken: string;
};

let sequence = 0;

export type CreateTestUserOptions = {
  /**
   * JWT の app_metadata.app_role に載せる役割（S4）。
   * 運営（`"moderator"`）の権限は users の列ではなくこのクレームで決まる
   * （docs/er/07-safety-moderation.md#ポリシーの一覧）。
   * app_metadata は管理 API からしか書けないため、テストでもここから渡す。
   */
  appRole?: "moderator";
};

/**
 * Supabase Auth 上にユーザーを作り、ログイン済みのアクセストークンを返す。
 * アプリ内のプロフィール（public.users）はまだ無い状態になる。
 */
export async function createTestUser(
  options: CreateTestUserOptions = {},
): Promise<TestUser> {
  const serviceRole = createServiceRoleClient();
  sequence += 1;
  const email = `test-${Date.now()}-${sequence}@example.test`;
  const password = "test-password-1234";

  const { data: created, error: createError } =
    await serviceRole.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: options.appRole ? { app_role: options.appRole } : undefined,
    });

  if (createError || !created.user) {
    throw new Error(
      `テストユーザーを作成できませんでした: ${createError?.message}`,
    );
  }

  const anon = createClient<Database>(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: session, error: signInError } =
    await anon.auth.signInWithPassword({ email, password });

  if (signInError || !session.session) {
    throw new Error(
      `テストユーザーでログインできませんでした: ${signInError?.message}`,
    );
  }

  return {
    id: created.user.id,
    email,
    accessToken: session.session.access_token,
  };
}

/** 認証情報ごと削除する。public 側は外部キーの CASCADE で消える */
export async function deleteTestUser(userId: string): Promise<void> {
  const serviceRole = createServiceRoleClient();
  await serviceRole.auth.admin.deleteUser(userId);
}

export function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません。`);
  }

  return value;
}
