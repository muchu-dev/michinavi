import type { Database } from "@michinavi/db";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  type AggregatableReport,
  countByCondition,
  countReporters,
  dedupeReports,
  majorityCondition,
  type RoadCondition,
} from "../reports/aggregate";

/**
 * デモ用データの投入（BE-26）。
 *
 * 投稿が 1 件も無いと地図が空になり、発表で何も見せられない。
 * 架空の家族と、その家族が上げた投稿を作る。
 *
 * **すべて架空のデータである。** 実在の人物ではない。
 * 見分けが付くよう、表示名は「デモ」で始め、メールアドレスは
 * 予約済みの example ドメインを使う（RFC 2606）。
 *
 * 何度実行しても同じ状態になるようにしてある。作り直すたびに投稿が
 * 積み上がると、発表のたびに地図が濃くなっていく。
 *
 * 世帯と構成員は、画面と同じ RPC（setup_user_account /
 * update_household_account）をデモ用アカウントのログインで呼んで作る。
 * service role で直接 INSERT しないのは、世帯と最初の構成員を同じ
 * トランザクションで作る必要があり（households_owner_is_member）、
 * その手順がすでに RPC にあるためである。
 */

type ServiceClient = SupabaseClient<Database>;

/** seed.sql に入っている地区（packages/db/supabase/seed.sql） */
const MABI_YATA_AREA_ID = "00000000-0000-4000-8000-000000000003";

/** 実在のアドレスに届かないよう、予約済みのドメインを使う */
const DEMO_EMAIL_DOMAIN = "michinavi.example";
const DEMO_PASSWORD = "demo-password-1234";

export type DemoSeedConnection = {
  url: string;
  /** RLS を迂回する鍵。アカウントの作成と投稿の時刻合わせに使う */
  secretKey: string;
  /** デモ用アカウントでログインするための鍵 */
  publishableKey: string;
};

type DemoMember = {
  displayName: string;
  ageGroup: Database["public"]["Enums"]["age_group"];
  needsAssistance?: boolean;
  careNeedKeys?: (
    | "wheelchair"
    | "walking_difficulty"
    | "infant_care"
    | "medical_device"
  )[];
};

type DemoHousehold = {
  key: string;
  displayName: string;
  householdName: string;
  homeMeshCode: string;
  carCount: number;
  members: DemoMember[];
  pets?: {
    species: Database["public"]["Enums"]["pet_species"];
    size: Database["public"]["Enums"]["pet_size"];
    count: number;
  }[];
};

/**
 * デモに出す 3 世帯。
 * 選択肢の生成（B1）で分岐が変わるよう、車の有無と要配慮の組み合わせを散らす。
 */
const DEMO_HOUSEHOLDS: DemoHousehold[] = [
  {
    key: "sato",
    displayName: "デモ 佐藤",
    householdName: "デモ 佐藤家",
    homeMeshCode: "5133756531",
    carCount: 1,
    members: [
      { displayName: "デモ 佐藤", ageGroup: "adult" },
      { displayName: "デモ 佐藤（配偶者）", ageGroup: "adult" },
      { displayName: "デモ 佐藤（長男）", ageGroup: "child" },
    ],
  },
  {
    key: "tanaka",
    displayName: "デモ 田中",
    householdName: "デモ 田中家",
    homeMeshCode: "5133756532",
    carCount: 0,
    members: [
      { displayName: "デモ 田中", ageGroup: "adult" },
      {
        displayName: "デモ 田中（母）",
        ageGroup: "senior",
        needsAssistance: true,
        careNeedKeys: ["wheelchair"],
      },
    ],
  },
  {
    key: "suzuki",
    displayName: "デモ 鈴木",
    householdName: "デモ 鈴木家",
    homeMeshCode: "5133756513",
    carCount: 1,
    members: [
      { displayName: "デモ 鈴木", ageGroup: "adult" },
      {
        displayName: "デモ 鈴木（長女）",
        ageGroup: "infant",
        careNeedKeys: ["infant_care"],
      },
    ],
    pets: [{ species: "dog", size: "small", count: 1 }],
  },
];

type DemoReport = {
  householdKey: string;
  meshCode: string;
  roadCondition: Database["public"]["Enums"]["road_condition"];
  /** 何分前の投稿にするか */
  minutesAgo: number;
};

/**
 * 地図に出す投稿。
 *
 * 同じ地点に複数の報告が集まる形にしてあるのは、集約の表示（E3）と
 * 推定（C3）が意味を持つ絵にするためである。
 *
 * メッシュコードは地図の初期表示位置（倉敷市真備町 34.6383, 133.6903 =
 * 5133756531）とその隣接から選ぶ。投稿画面は表示中の地点と同じ 2 次メッシュ
 * （先頭 6 桁）で絞り込むため、ここがずれるとデモを開いた直後の地図と
 * 投稿一覧がどちらも 0 件になる。
 */
const DEMO_REPORTS: DemoReport[] = [
  {
    householdKey: "sato",
    meshCode: "5133756531",
    roadCondition: "passable",
    minutesAgo: 165,
  },
  {
    householdKey: "tanaka",
    meshCode: "5133756531",
    roadCondition: "caution",
    minutesAgo: 120,
  },
  {
    householdKey: "suzuki",
    meshCode: "5133756531",
    roadCondition: "caution",
    minutesAgo: 95,
  },
  {
    householdKey: "sato",
    meshCode: "5133756533",
    roadCondition: "impassable",
    minutesAgo: 88,
  },
  {
    householdKey: "tanaka",
    meshCode: "5133756533",
    roadCondition: "impassable",
    minutesAgo: 74,
  },
  {
    householdKey: "suzuki",
    meshCode: "5133756533",
    roadCondition: "impassable",
    minutesAgo: 51,
  },
  {
    householdKey: "sato",
    meshCode: "5133756532",
    roadCondition: "passable",
    minutesAgo: 47,
  },
  {
    householdKey: "tanaka",
    meshCode: "5133756532",
    roadCondition: "passable",
    minutesAgo: 33,
  },
  {
    householdKey: "suzuki",
    meshCode: "5133756534",
    roadCondition: "caution",
    minutesAgo: 28,
  },
  {
    householdKey: "sato",
    meshCode: "5133756513",
    roadCondition: "impassable",
    minutesAgo: 21,
  },
  {
    householdKey: "tanaka",
    meshCode: "5133756514",
    roadCondition: "passable",
    minutesAgo: 12,
  },
  {
    householdKey: "suzuki",
    meshCode: "5133756514",
    roadCondition: "caution",
    minutesAgo: 4,
  },
];

const CONDITION_LABELS: Record<RoadCondition, string> = {
  passable: "通れる",
  caution: "注意",
  impassable: "通れない",
};

/** 投稿を出す地点。片付けのときに、そこから作った推定も消すために使う */
function demoMeshCodes(): string[] {
  return [...new Set(DEMO_REPORTS.map((report) => report.meshCode))];
}

export type DemoSeedSummary = {
  households: number;
  members: number;
  reports: number;
  /** 推定とまとめを入れた地点の数 */
  estimatedMeshes: number;
  userIds: string[];
};

function demoEmail(key: string): string {
  return `demo-${key}@${DEMO_EMAIL_DOMAIN}`;
}

function serviceClient(connection: DemoSeedConnection): ServiceClient {
  return createClient<Database>(connection.url, connection.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** デモ用のアカウントをすべて消す。投入をやり直せるようにするため */
export async function removeDemoData(
  connection: DemoSeedConnection,
): Promise<void> {
  const client = serviceClient(connection);

  // 投稿から作った推定とまとめも一緒に消す。
  // これを残すと、デモを片付けた後の地図の吹き出しに、
  // 投稿が1件も無い地点の推定だけが出続ける
  const meshCodes = demoMeshCodes();
  await client
    .from("road_status_estimates")
    .delete()
    .in("mesh_code", meshCodes);
  await client.from("field_report_digests").delete().in("mesh_code", meshCodes);

  const emails = DEMO_HOUSEHOLDS.map((household) => demoEmail(household.key));
  const { data } = await client.auth.admin.listUsers({ perPage: 1000 });
  const targets = (data?.users ?? []).filter(
    (user) => user.email !== undefined && emails.includes(user.email),
  );

  for (const user of targets) {
    // 依存している行を順に落としてからアカウントを消す。
    // auth 側の削除だけに任せると、household_members.user_id が
    // ON DELETE SET NULL になった行が
    // household_members_primary_requires_user（is_primary なら user_id が要る）
    // に引っかかり、「Database error deleting user」になる
    await client.from("field_reports").delete().eq("user_id", user.id);
    await client.from("households").delete().eq("owner_user_id", user.id);
    await client.from("household_members").delete().eq("user_id", user.id);
    await client.from("users").delete().eq("id", user.id);

    const { error } = await client.auth.admin.deleteUser(user.id);

    if (error) {
      throw new Error(
        `デモ用のアカウントを削除できませんでした（${user.email}）: ${error.message}`,
      );
    }
  }
}

/** デモ用アカウントを作り、そのアカウントとしてログインしたクライアントを返す */
async function signInAsDemoUser(
  connection: DemoSeedConnection,
  household: DemoHousehold,
): Promise<{ userId: string; client: SupabaseClient<Database> }> {
  const admin = serviceClient(connection);
  const email = demoEmail(household.key);

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { is_demo: true },
    });

  if (createError || !created.user) {
    throw new Error(
      `デモ用のアカウントを作成できませんでした（${household.key}）: ${createError?.message}`,
    );
  }

  const client = createClient<Database>(
    connection.url,
    connection.publishableKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: DEMO_PASSWORD,
  });

  if (signInError) {
    throw new Error(
      `デモ用のアカウントでログインできませんでした（${household.key}）: ${signInError.message}`,
    );
  }

  return { userId: created.user.id, client };
}

/**
 * デモ用の家族と投稿を作る。
 *
 * 世帯と構成員は画面と同じ RPC で作り、投稿だけは時刻をずらすために
 * service role で入れる（created_at を過去にするため）。
 */
export async function seedDemoData(
  connection: DemoSeedConnection,
): Promise<DemoSeedSummary> {
  // 何度実行しても同じ状態になるよう、先に消してから作る
  await removeDemoData(connection);

  const userIdsByKey = new Map<string, string>();
  let memberCount = 0;

  for (const household of DEMO_HOUSEHOLDS) {
    const { userId, client } = await signInAsDemoUser(connection, household);
    userIdsByKey.set(household.key, userId);

    const primary = household.members[0];

    if (!primary) {
      throw new Error(`構成員がいません: ${household.key}`);
    }

    // 1. 本人と世帯を作る（users / households / household_members が 1 度に入る）
    const { data: setup, error: setupError } = await client
      .rpc("setup_user_account", {
        p_display_name: household.displayName,
        p_area_id: MABI_YATA_AREA_ID,
        p_home_mesh_code: household.homeMeshCode,
        p_household_name: household.householdName,
        p_age_group: primary.ageGroup,
        p_car_count: household.carCount,
      })
      .single();

    if (setupError || !setup) {
      throw new Error(`初期登録に失敗しました: ${setupError?.message}`);
    }

    // 2. 残りの家族・要配慮・ペット・車の台数を入れる
    const { error: updateError } = await client
      .rpc("update_household_account", {
        p_area_id: MABI_YATA_AREA_ID,
        p_home_mesh_code: household.homeMeshCode,
        p_car_count: household.carCount,
        p_members: household.members.map((member, index) => ({
          id: index === 0 ? setup.household_member_id : null,
          displayName: member.displayName,
          ageGroup: member.ageGroup,
          needsAssistance: member.needsAssistance ?? false,
          careNeeds: (member.careNeedKeys ?? []).map((key) => ({
            key,
            detail: null,
          })),
        })),
        p_pets: (household.pets ?? []).map((pet) => ({
          species: pet.species,
          size: pet.size,
          count: pet.count,
          isCrateTrained: true,
          note: null,
        })),
      })
      .single();

    if (updateError) {
      throw new Error(`世帯の登録に失敗しました: ${updateError.message}`);
    }

    memberCount += household.members.length;
    await client.auth.signOut();
  }

  // 3. 投稿。created_at をずらして「◯分前」の表示に幅を持たせるため、
  //    ここだけ service role で入れる
  const now = Date.now();
  const reportRows = DEMO_REPORTS.map((report) => {
    const userId = userIdsByKey.get(report.householdKey);

    if (!userId) {
      throw new Error(`世帯が見つかりません: ${report.householdKey}`);
    }

    return {
      user_id: userId,
      report_type: "road" as const,
      road_condition: report.roadCondition,
      mesh_code: report.meshCode,
      created_at: new Date(now - report.minutesAgo * 60_000).toISOString(),
    };
  });

  const client = serviceClient(connection);
  const { error: reportError } = await client
    .from("field_reports")
    .insert(reportRows);

  if (reportError) {
    throw new Error(
      `field_reports を作成できませんでした: ${reportError.message}`,
    );
  }

  // 4. 投稿から地点ごとの推定とまとめを作る
  const estimatedMeshes = await seedRoadStatus(client, reportRows);

  return {
    households: DEMO_HOUSEHOLDS.length,
    members: memberCount,
    reports: reportRows.length,
    estimatedMeshes,
    userIds: [...userIdsByKey.values()],
  };
}

/**
 * 投稿から road_status_estimates と field_report_digests を作る。
 *
 * 本番ではこの2つを投稿API（fieldReport.create）が投稿のたびに作るが、
 * デモ用の投稿は created_at をずらすため service role で直接入れており、
 * その経路を通らない。埋めておかないと、地図の吹き出しに
 * 「推定はまだありません」しか出ず、投稿から通行可否を推定するという
 * この product の主張がデモで一切見えなくなる。
 *
 * ここでは Gemini を呼ばない。デモ用データの投入が外部APIの調子や
 * 鍵の有無に左右されると、発表直前に地図が空になりうるためである。
 * 代わりに、AI が使えないときと同じ多数決（src/reports/aggregate.ts）で
 * 埋める。AI 由来ではないことは confidence: low と
 * is_ai_summary: false で画面に伝わる。
 */
async function seedRoadStatus(
  client: ServiceClient,
  rows: readonly {
    user_id: string;
    road_condition: Database["public"]["Enums"]["road_condition"];
    mesh_code: string;
    created_at: string;
  }[],
): Promise<number> {
  const reportsByMesh = new Map<string, AggregatableReport[]>();

  for (const row of rows) {
    const reports = reportsByMesh.get(row.mesh_code) ?? [];
    reports.push({
      user_id: row.user_id,
      road_condition: row.road_condition,
      created_at: row.created_at,
    });
    reportsByMesh.set(row.mesh_code, reports);
  }

  const updatedAt = new Date().toISOString();
  const estimates = [];
  const digests = [];

  for (const [meshCode, reports] of reportsByMesh) {
    // 数え方は本番と同じ。連投を畳んでから多数決を取る（BE-18）
    const { active, mergedCount } = dedupeReports(reports);
    const latest = active[0];

    if (!latest) {
      continue;
    }

    const counts = countByCondition(active);
    const roadCondition = majorityCondition(counts);
    const reporterCount = countReporters(active);

    estimates.push({
      mesh_code: meshCode,
      road_condition: roadCondition,
      confidence: "low" as const,
      report_count: active.length,
      reasoning: "デモ用データのため、報告件数の多数決で算出しました",
      updated_at: updatedAt,
    });

    digests.push({
      mesh_code: meshCode,
      road_condition: roadCondition,
      report_count: active.length,
      merged_count: mergedCount,
      reporter_count: reporterCount,
      passable_count: counts.passable,
      caution_count: counts.caution,
      impassable_count: counts.impassable,
      latest_reported_at: latest.created_at,
      summary: `現在は「${CONDITION_LABELS[roadCondition]}」とみています。内訳は通れる${counts.passable}件・注意${counts.caution}件・通れない${counts.impassable}件、${reporterCount}人からの報告です。`,
      is_ai_summary: false,
      updated_at: updatedAt,
    });
  }

  const { error: estimateError } = await client
    .from("road_status_estimates")
    .upsert(estimates, { onConflict: "mesh_code" });

  if (estimateError) {
    throw new Error(
      `road_status_estimates を作成できませんでした: ${estimateError.message}`,
    );
  }

  const { error: digestError } = await client
    .from("field_report_digests")
    .upsert(digests, { onConflict: "mesh_code" });

  if (digestError) {
    throw new Error(
      `field_report_digests を作成できませんでした: ${digestError.message}`,
    );
  }

  return estimates.length;
}

/** デモ用アカウントでログインするための情報。発表者に渡す */
export const demoCredentials = DEMO_HOUSEHOLDS.map((household) => ({
  householdName: household.householdName,
  email: demoEmail(household.key),
  password: DEMO_PASSWORD,
}));
