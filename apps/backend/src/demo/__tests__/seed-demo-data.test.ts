import {
  createServiceRoleClient,
  createTestUser,
  deleteTestUser,
  requiredEnv,
  SEED_AREA_IDS,
} from "@michinavi/testing";
import { afterAll, describe, expect, test, vi } from "vitest";
import {
  createAnonymousCaller,
  createCallerFor,
} from "../../api/__tests__/helpers";
import {
  DEMO_MAP_MESH_PREFIX,
  type DemoSeedConnection,
  demoCredentials,
  removeDemoData,
  seedDemoData,
} from "../seed-demo-data";

/**
 * 通常の投稿（fieldReport.create）は推定の再計算で Gemini を呼ぶ。
 * テストを外部APIの調子に左右させないため、ここでも呼び出しを差し替える。
 * デモ用データの投入そのものは元から Gemini を呼ばない。
 */
vi.mock("../../ai/gemini-client", () => ({
  generateStructuredJson: vi.fn(async () => ({
    ok: false as const,
    error: "unavailable in test",
  })),
}));

const serviceRole = createServiceRoleClient();

const connection: DemoSeedConnection = {
  url: requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
  secretKey: requiredEnv("SUPABASE_SECRET_KEY"),
  publishableKey: requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
};

afterAll(async () => {
  // 他のテストの一覧に混ざらないよう、最後に片付ける
  await removeDemoData(connection);
});

describe("seedDemoData（BE-26）", () => {
  test("架空の家族と投稿が入り、地図が空にならない", async () => {
    const summary = await seedDemoData(connection);

    expect(summary.households).toBe(3);
    expect(summary.members).toBeGreaterThanOrEqual(summary.households);
    expect(summary.reports).toBeGreaterThan(0);

    // 投入した投稿が、未ログインの地図から見えること（デモは未ログインで見せる）
    const { data: seededIds } = await serviceRole
      .from("field_reports")
      .select("id, mesh_code")
      .in("user_id", summary.userIds);
    expect(seededIds).toHaveLength(summary.reports);

    // 投稿はすべて地図の初期表示位置と同じ 2 次メッシュに乗っていること。
    // ここがずれるとデモを開いた直後の地図が 0 件になる（BE-26 の再発防止）
    for (const row of seededIds ?? []) {
      expect(row.mesh_code.startsWith(DEMO_MAP_MESH_PREFIX)).toBe(true);
    }

    // 画面と同じく meshPrefix で絞って引く。
    // 絞らずに「新しい順 100 件」を引くと、他のテストが積んだ投稿に
    // 押し出されて、DB の中身次第で落ちるテストになる
    const { caller } = await createAnonymousCaller();
    const visible = await caller.fieldReport.list({
      limit: 100,
      meshPrefix: DEMO_MAP_MESH_PREFIX,
    });
    const visibleIds = new Set(visible.map((report) => report.id));

    expect(
      (seededIds ?? []).filter((row) => visibleIds.has(row.id)).length,
    ).toBe(summary.reports);
  });

  test("投稿した地点の推定とまとめが、未ログインの地図から読める", async () => {
    const summary = await seedDemoData(connection);

    expect(summary.estimatedMeshes).toBeGreaterThan(0);

    const { data: seededMeshes } = await serviceRole
      .from("field_reports")
      .select("mesh_code")
      .in("user_id", summary.userIds);
    const meshCodes = new Set((seededMeshes ?? []).map((row) => row.mesh_code));

    // 地図の吹き出しは未ログインでこの2つを読む（FE 側の RoadStatusSummary）
    const { caller } = await createAnonymousCaller();
    const estimates = await caller.roadStatus.list({ limit: 500 });

    for (const meshCode of meshCodes) {
      const estimate = estimates.find((row) => row.meshCode === meshCode);
      const [digest] = await caller.reportDigest.list({
        limit: 1,
        meshCodePrefix: meshCode,
      });

      expect(estimate).toBeDefined();
      expect(digest).toBeDefined();
      expect(digest?.reportCount).toBeGreaterThan(0);
      // Gemini を呼ばずに多数決で埋めているので、AI 由来だと偽らない
      expect(estimate?.confidence).toBe("low");
      expect(digest?.isAiSummary).toBe(false);
      // 見出しの状態は推定とまとめで食い違わない
      expect(digest?.roadCondition).toBe(estimate?.roadCondition);
    }
  });

  test("片付けると推定とまとめも残らない", async () => {
    const summary = await seedDemoData(connection);

    const { data: seededMeshes } = await serviceRole
      .from("field_reports")
      .select("mesh_code")
      .in("user_id", summary.userIds);
    const meshCodes = [
      ...new Set((seededMeshes ?? []).map((row) => row.mesh_code)),
    ];

    await removeDemoData(connection);

    const { data: estimates } = await serviceRole
      .from("road_status_estimates")
      .select("mesh_code")
      .in("mesh_code", meshCodes);
    const { data: digests } = await serviceRole
      .from("field_report_digests")
      .select("mesh_code")
      .in("mesh_code", meshCodes);

    expect(estimates).toEqual([]);
    expect(digests).toEqual([]);
  });

  test("同じ地点に複数の報告が集まる", async () => {
    await seedDemoData(connection);

    const { data } = await serviceRole
      .from("field_reports")
      .select("mesh_code")
      .in(
        "user_id",
        (
          await serviceRole
            .from("users")
            .select("id")
            .like("display_name", "デモ %")
        ).data?.map((row) => row.id) ?? [],
      );

    const countsByMesh = new Map<string, number>();

    for (const row of data ?? []) {
      countsByMesh.set(
        row.mesh_code,
        (countsByMesh.get(row.mesh_code) ?? 0) + 1,
      );
    }

    // 集約の表示（E3）と推定（C3）が意味を持つ絵にするため、
    // 1 地点に複数の報告が乗っている必要がある
    expect([...countsByMesh.values()].some((count) => count >= 3)).toBe(true);
  });

  test("何度実行しても投稿が積み上がらない", async () => {
    const first = await seedDemoData(connection);
    const second = await seedDemoData(connection);

    expect(second.reports).toBe(first.reports);

    const { data: users } = await serviceRole
      .from("users")
      .select("id")
      .like("display_name", "デモ %");
    expect(users).toHaveLength(3);

    const { data: reports } = await serviceRole
      .from("field_reports")
      .select("id")
      .in(
        "user_id",
        (users ?? []).map((row) => row.id),
      );
    expect(reports).toHaveLength(first.reports);
  });

  test("要配慮と車の有無が世帯ごとに違う", async () => {
    await seedDemoData(connection);

    const { data: households } = await serviceRole
      .from("households")
      .select("name, car_count, has_car")
      .like("name", "デモ %");

    // 選択肢の生成（B1）で分岐が変わるよう、車のある世帯と無い世帯を混ぜる
    expect(households?.some((row) => row.has_car)).toBe(true);
    expect(households?.some((row) => !row.has_car)).toBe(true);

    const { data: careNeeds } = await serviceRole
      .from("household_member_care_needs")
      .select("household_member_id");
    expect((careNeeds ?? []).length).toBeGreaterThan(0);
  });

  test("架空だと分かる形になっている", async () => {
    await seedDemoData(connection);

    // 実在のアドレスに届かない予約済みドメイン（RFC 2606）
    for (const credential of demoCredentials) {
      expect(credential.email.endsWith("@michinavi.example")).toBe(true);
      expect(credential.householdName.startsWith("デモ ")).toBe(true);
    }

    const { data } = await serviceRole
      .from("users")
      .select("display_name")
      .like("display_name", "デモ %");
    expect(data?.length).toBe(3);
  });

  test("片付けるとデモのデータが残らない", async () => {
    await seedDemoData(connection);
    await removeDemoData(connection);

    const { data } = await serviceRole
      .from("users")
      .select("id")
      .like("display_name", "デモ %");

    expect(data).toEqual([]);
  });
});

/**
 * デモの投入・片付けが、同じ地点にある通常の投稿を壊さないこと。
 *
 * デモ用の投稿だけから集計を作って mesh_code 単位で上書きすると、同じ地点の
 * 通常の投稿が推定と要約から消える。片付けで固定のメッシュを無条件に消すと、
 * 通常の投稿から作られた集計まで巻き込む。どちらも共有の dev / preview 環境で
 * 実データを壊すため、投入も片付けも「その地点に残っている投稿すべて」から
 * 数え直す。
 */
describe("同じ地点に通常のユーザーの投稿があるとき", () => {
  /** DEMO_REPORTS が複数の報告を乗せている地点（地図の初期表示位置） */
  const SHARED_MESH_CODE = "5133756531";

  async function estimateOf(meshCode: string) {
    const { data } = await serviceRole
      .from("road_status_estimates")
      .select("road_condition, report_count")
      .eq("mesh_code", meshCode)
      .maybeSingle();

    return data;
  }

  async function digestOf(meshCode: string) {
    const { data } = await serviceRole
      .from("field_report_digests")
      .select(
        "road_condition, report_count, reporter_count, passable_count, caution_count, impassable_count, summary, is_ai_summary",
      )
      .eq("mesh_code", meshCode)
      .maybeSingle();

    return data;
  }

  /**
   * デモと同じ地点に通常の投稿を 1 件だけ入れ、その状態で本文を走らせる。
   * 後片付けまで面倒を見るのは、この地点が固定で、投稿が残ると次の実行の
   * 件数の検証がぶれるためである。
   */
  async function withNonDemoReport(
    body: (context: { userId: string }) => Promise<void>,
  ): Promise<void> {
    // 前回の実行が残した投稿があると件数の検証がぶれるので、この地点を空にする
    await serviceRole
      .from("field_reports")
      .delete()
      .eq("mesh_code", SHARED_MESH_CODE);

    const user = await createTestUser();

    try {
      const { caller } = await createCallerFor(user);
      await caller.user.setup({
        displayName: "テスト太郎",
        areaId: SEED_AREA_IDS.mabiYata,
        homeMeshCode: "5133451124",
      });
      // 画面と同じ経路で、デモと同じ地点に通常の投稿を 1 件入れる
      await caller.fieldReport.create({
        meshCode: SHARED_MESH_CODE,
        roadCondition: "impassable",
      });

      await body({ userId: user.id });
    } finally {
      // 投稿は user_id が ON DELETE RESTRICT なので、行を落としてから消す
      await serviceRole.from("field_reports").delete().eq("user_id", user.id);
      await serviceRole
        .from("road_status_estimates")
        .delete()
        .eq("mesh_code", SHARED_MESH_CODE);
      await serviceRole
        .from("field_report_digests")
        .delete()
        .eq("mesh_code", SHARED_MESH_CODE);
      await serviceRole
        .from("households")
        .delete()
        .eq("owner_user_id", user.id);
      await serviceRole
        .from("household_members")
        .delete()
        .eq("user_id", user.id);
      await serviceRole.from("users").delete().eq("id", user.id);
      await deleteTestUser(user.id);
    }
  }

  test("投入しても、その投稿が推定と要約から消えない", async () => {
    await withNonDemoReport(async () => {
      const summary = await seedDemoData(connection);

      const { count: demoCount } = await serviceRole
        .from("field_reports")
        .select("id", { count: "exact", head: true })
        .eq("mesh_code", SHARED_MESH_CODE)
        .in("user_id", summary.userIds);

      // デモの投稿がこの地点に乗っていないと、この検査自体が空振りになる
      expect(demoCount ?? 0).toBeGreaterThan(0);

      // デモの投稿と通常の投稿の両方が母数に入る。
      // デモ用の投稿だけから集計を作って mesh_code で上書きすると、
      // ここが demoCount のままになり、通常の投稿が地図から消える
      const estimate = await estimateOf(SHARED_MESH_CODE);
      const digest = await digestOf(SHARED_MESH_CODE);

      expect(estimate?.report_count).toBe((demoCount ?? 0) + 1);
      expect(digest?.report_count).toBe((demoCount ?? 0) + 1);
      expect(digest?.impassable_count).toBe(1);
      expect(digest?.summary).toContain("通れない1件");
    });
  });

  test("片付けても、その投稿を反映した推定と要約が残る", async () => {
    await withNonDemoReport(async () => {
      await seedDemoData(connection);
      await removeDemoData(connection);

      // デモの投稿だけが消え、通常の投稿から数え直した集計が残る。
      // 固定のメッシュの行を無条件に消すと、ここが空になる
      const estimate = await estimateOf(SHARED_MESH_CODE);
      const digest = await digestOf(SHARED_MESH_CODE);

      expect(estimate).not.toBeNull();
      expect(estimate?.report_count).toBe(1);
      expect(estimate?.road_condition).toBe("impassable");

      expect(digest).not.toBeNull();
      expect(digest?.report_count).toBe(1);
      expect(digest?.reporter_count).toBe(1);
      expect(digest?.road_condition).toBe("impassable");
      expect(digest?.impassable_count).toBe(1);
      expect(digest?.summary).toContain("通れない1件");
      // デモの投入も片付けも Gemini を呼ばない
      expect(digest?.is_ai_summary).toBe(false);
    });
  });
});
