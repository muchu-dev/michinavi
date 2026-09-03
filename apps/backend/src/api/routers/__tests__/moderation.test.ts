import {
  createServiceRoleClient,
  createTestUser,
  deleteTestUser,
  SEED_AREA_IDS,
  type TestUser,
} from "@michinavi/testing";
import { afterEach, describe, expect, test } from "vitest";
import {
  createAnonymousCaller,
  createCallerFor,
} from "../../__tests__/helpers";

const serviceRole = createServiceRoleClient();
const createdUserIds: string[] = [];

/**
 * field_reports は user_id が ON DELETE RESTRICT のため、テスト後も残り続ける
 * （docs/er/00-conventions.md#外部キーの削除規則）。
 * 一覧の検証が前回の実行に影響されないよう、実行ごとに違う mesh_code を使う
 */
let meshCodeSequence = 0;
function uniqueMeshCode(): string {
  meshCodeSequence += 1;
  return `54${String(Date.now()).slice(-6)}${String(meshCodeSequence).padStart(2, "0")}`;
}

async function newRegisteredUser(options: { appRole?: "moderator" } = {}) {
  const user = await createTestUser(options);
  createdUserIds.push(user.id);

  const { caller } = await createCallerFor(user);
  await caller.user.setup({
    displayName: "テスト太郎",
    areaId: SEED_AREA_IDS.mabiYata,
    homeMeshCode: "5133451124",
  });

  return user;
}

/** 投稿を 1 件作り、その ID と投稿者を返す */
async function newFieldReport(poster: TestUser, meshCode: string) {
  const { caller } = await createCallerFor(poster);

  return caller.fieldReport.create({ meshCode, roadCondition: "impassable" });
}

afterEach(async () => {
  await Promise.all(createdUserIds.splice(0).map(deleteTestUser));
});

describe("contentFlag.create", () => {
  test("認証済みユーザーが投稿を通報できる", async () => {
    const poster = await newRegisteredUser();
    const reporter = await newRegisteredUser();
    const report = await newFieldReport(poster, uniqueMeshCode());

    const { caller } = await createCallerFor(reporter);
    const flag = await caller.contentFlag.create({
      targetType: "field_report",
      targetId: report.id,
      reason: "false_info",
      detail: "実際には通れました",
    });

    expect(flag.status).toBe("open");

    const { data } = await serviceRole
      .from("content_flags")
      .select("reporter_user_id, target_id, reason, detail")
      .eq("id", flag.id)
      .single();

    expect(data?.reporter_user_id).toBe(reporter.id);
    expect(data?.target_id).toBe(report.id);
    expect(data?.reason).toBe("false_info");
    expect(data?.detail).toBe("実際には通れました");
  });

  test("未認証では通報できない", async () => {
    const poster = await newRegisteredUser();
    const report = await newFieldReport(poster, uniqueMeshCode());
    const { caller } = await createAnonymousCaller();

    await expect(
      caller.contentFlag.create({
        targetType: "field_report",
        targetId: report.id,
        reason: "spam",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("存在しない投稿は通報できない", async () => {
    const reporter = await newRegisteredUser();
    const { caller } = await createCallerFor(reporter);

    await expect(
      caller.contentFlag.create({
        targetType: "field_report",
        targetId: "00000000-0000-4000-8000-00000000dead",
        reason: "spam",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("同じ人が同じ投稿を二度通報することはできない", async () => {
    const poster = await newRegisteredUser();
    const reporter = await newRegisteredUser();
    const report = await newFieldReport(poster, uniqueMeshCode());
    const { caller } = await createCallerFor(reporter);

    await caller.contentFlag.create({
      targetType: "field_report",
      targetId: report.id,
      reason: "spam",
    });

    await expect(
      caller.contentFlag.create({
        targetType: "field_report",
        targetId: report.id,
        reason: "abuse",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("通報に他人の user_id を混ぜても、JWT のユーザーで保存される", async () => {
    const poster = await newRegisteredUser();
    const victim = await newRegisteredUser();
    const attacker = await newRegisteredUser();
    const report = await newFieldReport(poster, uniqueMeshCode());

    const { caller } = await createCallerFor(attacker);
    const flag = await caller.contentFlag.create({
      targetType: "field_report",
      targetId: report.id,
      reason: "spam",
      ...({ reporterUserId: victim.id } as object),
    });

    const { data } = await serviceRole
      .from("content_flags")
      .select("reporter_user_id")
      .eq("id", flag.id)
      .single();

    expect(data?.reporter_user_id).toBe(attacker.id);
  });
});

describe("通報の可視範囲", () => {
  test("自分の通報は自分で確認できる", async () => {
    const poster = await newRegisteredUser();
    const reporter = await newRegisteredUser();
    const report = await newFieldReport(poster, uniqueMeshCode());

    const { caller } = await createCallerFor(reporter);
    await caller.contentFlag.create({
      targetType: "field_report",
      targetId: report.id,
      reason: "privacy",
    });

    const mine = await caller.contentFlag.mine();
    expect(mine.some((row) => row.targetId === report.id)).toBe(true);
  });

  test("他人の通報は読めない", async () => {
    const poster = await newRegisteredUser();
    const reporter = await newRegisteredUser();
    const stranger = await newRegisteredUser();
    const report = await newFieldReport(poster, uniqueMeshCode());

    const { caller: reporterCaller } = await createCallerFor(reporter);
    const flag = await reporterCaller.contentFlag.create({
      targetType: "field_report",
      targetId: report.id,
      reason: "abuse",
    });

    const { caller: strangerCaller, ctx } = await createCallerFor(stranger);

    expect(await strangerCaller.contentFlag.mine()).toEqual([]);

    const { data } = await ctx.supabase
      .from("content_flags")
      .select("id")
      .eq("id", flag.id);
    expect(data).toEqual([]);
  });

  test("運営でないユーザーは通報一覧を開けない", async () => {
    const user = await newRegisteredUser();
    const { caller } = await createCallerFor(user);

    await expect(caller.contentFlag.list({ limit: 10 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  test("運営は通報一覧を開ける", async () => {
    const poster = await newRegisteredUser();
    const reporter = await newRegisteredUser();
    const moderator = await newRegisteredUser({ appRole: "moderator" });
    const report = await newFieldReport(poster, uniqueMeshCode());

    const { caller: reporterCaller } = await createCallerFor(reporter);
    const flag = await reporterCaller.contentFlag.create({
      targetType: "field_report",
      targetId: report.id,
      reason: "false_info",
      detail: "見てきましたが通れました",
    });

    const { caller } = await createCallerFor(moderator);
    const list = await caller.contentFlag.list({ status: "open", limit: 100 });
    const found = list.find((row) => row.id === flag.id);

    expect(found?.reporterUserId).toBe(reporter.id);
    expect(found?.detail).toBe("見てきましたが通れました");
  });
});

describe("moderation.hide / restore / remove", () => {
  test("運営が通報された投稿を非表示にすると、一覧から消える", async () => {
    const poster = await newRegisteredUser();
    const reporter = await newRegisteredUser();
    const moderator = await newRegisteredUser({ appRole: "moderator" });
    const meshCode = uniqueMeshCode();
    const report = await newFieldReport(poster, meshCode);

    const { caller: reporterCaller } = await createCallerFor(reporter);
    const flag = await reporterCaller.contentFlag.create({
      targetType: "field_report",
      targetId: report.id,
      reason: "false_info",
    });

    const { caller: moderatorCaller } = await createCallerFor(moderator);
    const result = await moderatorCaller.moderation.hide({
      targetType: "field_report",
      targetId: report.id,
      reason: "現地と食い違う報告のため",
      contentFlagId: flag.id,
    });

    expect(result.status).toBe("hidden");

    // 第三者からは見えない
    const { caller: anonymousCaller } = await createAnonymousCaller();
    const publicList = await anonymousCaller.fieldReport.list({ limit: 100 });
    expect(publicList.some((row) => row.id === report.id)).toBe(false);

    // 投稿者本人には見える。何が起きたか分かるよう status も返る
    const { caller: posterCaller } = await createCallerFor(poster);
    const own = (await posterCaller.fieldReport.list({ limit: 100 })).find(
      (row) => row.id === report.id,
    );
    expect(own?.status).toBe("hidden");
  });

  test("非表示にすると、その投稿への未処理の通報がまとめて閉じる", async () => {
    const poster = await newRegisteredUser();
    const firstReporter = await newRegisteredUser();
    const secondReporter = await newRegisteredUser();
    const moderator = await newRegisteredUser({ appRole: "moderator" });
    const report = await newFieldReport(poster, uniqueMeshCode());

    for (const reporter of [firstReporter, secondReporter]) {
      const { caller } = await createCallerFor(reporter);
      await caller.contentFlag.create({
        targetType: "field_report",
        targetId: report.id,
        reason: "false_info",
      });
    }

    const { caller } = await createCallerFor(moderator);
    await caller.moderation.hide({
      targetType: "field_report",
      targetId: report.id,
      reason: "誤情報のため",
    });

    const { data } = await serviceRole
      .from("content_flags")
      .select("status, resolved_by, resolved_at")
      .eq("target_id", report.id);

    expect(data).toHaveLength(2);
    for (const row of data ?? []) {
      expect(row.status).toBe("actioned");
      expect(row.resolved_by).toBe(moderator.id);
      expect(row.resolved_at).not.toBeNull();
    }
  });

  test("措置は記録として残る", async () => {
    const poster = await newRegisteredUser();
    const moderator = await newRegisteredUser({ appRole: "moderator" });
    const report = await newFieldReport(poster, uniqueMeshCode());

    const { caller } = await createCallerFor(moderator);
    await caller.moderation.hide({
      targetType: "field_report",
      targetId: report.id,
      reason: "個人情報が含まれるため",
    });

    const history = await caller.moderation.history({
      targetType: "field_report",
      targetId: report.id,
    });

    expect(history).toHaveLength(1);
    expect(history[0]?.action).toBe("hide");
    expect(history[0]?.reason).toBe("個人情報が含まれるため");
    expect(history[0]?.moderatorUserId).toBe(moderator.id);
  });

  test("誤って非表示にした投稿を戻せる", async () => {
    const poster = await newRegisteredUser();
    const moderator = await newRegisteredUser({ appRole: "moderator" });
    const report = await newFieldReport(poster, uniqueMeshCode());

    const { caller } = await createCallerFor(moderator);
    await caller.moderation.hide({
      targetType: "field_report",
      targetId: report.id,
      reason: "誤情報の疑いのため",
    });
    const restored = await caller.moderation.restore({
      targetType: "field_report",
      targetId: report.id,
      reason: "確認したところ問題なかったため",
    });

    expect(restored.status).toBe("active");

    const { caller: anonymousCaller } = await createAnonymousCaller();
    const list = await anonymousCaller.fieldReport.list({ limit: 100 });
    expect(list.some((row) => row.id === report.id)).toBe(true);

    // 戻した記録も残る
    const history = await caller.moderation.history({
      targetType: "field_report",
      targetId: report.id,
    });
    expect(history.map((row) => row.action)).toEqual(["restore", "hide"]);
  });

  test("削除しても行は消さず、論理削除にする", async () => {
    const poster = await newRegisteredUser();
    const moderator = await newRegisteredUser({ appRole: "moderator" });
    const report = await newFieldReport(poster, uniqueMeshCode());

    const { caller } = await createCallerFor(moderator);
    const result = await caller.moderation.remove({
      targetType: "field_report",
      targetId: report.id,
      reason: "第三者の個人情報が含まれるため",
    });

    expect(result.isDeleted).toBe(true);

    // 通報の内容を後から確認できるよう、行そのものは残す
    const { data } = await serviceRole
      .from("field_reports")
      .select("id, status, deleted_at")
      .eq("id", report.id)
      .single();

    expect(data?.status).toBe("hidden");
    expect(data?.deleted_at).not.toBeNull();
  });

  test("存在しない投稿への措置は失敗する", async () => {
    const moderator = await newRegisteredUser({ appRole: "moderator" });
    const { caller } = await createCallerFor(moderator);

    await expect(
      caller.moderation.hide({
        targetType: "field_report",
        targetId: "00000000-0000-4000-8000-00000000dead",
        reason: "存在しない対象",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("運営の権限", () => {
  test("運営でないユーザーは投稿を非表示にできない", async () => {
    const poster = await newRegisteredUser();
    const attacker = await newRegisteredUser();
    const report = await newFieldReport(poster, uniqueMeshCode());

    const { caller } = await createCallerFor(attacker);

    await expect(
      caller.moderation.hide({
        targetType: "field_report",
        targetId: report.id,
        reason: "気に入らないため",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const { data } = await serviceRole
      .from("field_reports")
      .select("status")
      .eq("id", report.id)
      .single();
    expect(data?.status).toBe("active");
  });

  test("router を迂回して直接 INSERT しても、RLS が措置を拒む", async () => {
    const poster = await newRegisteredUser();
    const attacker = await newRegisteredUser();
    const report = await newFieldReport(poster, uniqueMeshCode());
    const { ctx } = await createCallerFor(attacker);

    const { error } = await ctx.supabase.from("moderation_actions").insert({
      moderator_user_id: attacker.id,
      target_type: "field_report",
      target_id: report.id,
      action: "hide",
      reason: "RLS を迂回できないことの確認",
    });

    expect(error?.code).toBe("42501");
  });

  test("投稿者本人でも status は変えられない", async () => {
    const poster = await newRegisteredUser();
    const moderator = await newRegisteredUser({ appRole: "moderator" });
    const report = await newFieldReport(poster, uniqueMeshCode());

    const { caller: moderatorCaller } = await createCallerFor(moderator);
    await moderatorCaller.moderation.hide({
      targetType: "field_report",
      targetId: report.id,
      reason: "誤情報のため",
    });

    // field_reports に UPDATE のポリシーが無いため、本人でも 0 行しか更新されない
    const { ctx } = await createCallerFor(poster);
    await ctx.supabase
      .from("field_reports")
      .update({ status: "active" })
      .eq("id", report.id);

    const { data } = await serviceRole
      .from("field_reports")
      .select("status")
      .eq("id", report.id)
      .single();
    expect(data?.status).toBe("hidden");
  });
});
