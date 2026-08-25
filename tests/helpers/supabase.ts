import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createTRPCContext } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/root";

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

/** 開発・テスト用の seed に入っている地区 */
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

/**
 * Supabase Auth 上にユーザーを作り、ログイン済みのアクセストークンを返す。
 * アプリ内のプロフィール（public.users）はまだ無い状態になる。
 */
export async function createTestUser(): Promise<TestUser> {
  const serviceRole = createServiceRoleClient();
  sequence += 1;
  const email = `test-${Date.now()}-${sequence}@example.test`;
  const password = "test-password-1234";

  const { data: created, error: createError } =
    await serviceRole.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
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

/** ログイン済みユーザーとして tRPC を呼ぶ */
export async function createCallerFor(user: TestUser) {
  const ctx = await createTRPCContext({
    headers: new Headers({ authorization: `Bearer ${user.accessToken}` }),
  });

  return { ctx, caller: appRouter.createCaller(ctx) };
}

/** 未ログインの状態で tRPC を呼ぶ */
export async function createAnonymousCaller() {
  const ctx = await createTRPCContext({ headers: new Headers() });

  return { ctx, caller: appRouter.createCaller(ctx) };
}

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません。`);
  }

  return value;
}
