import { createServiceRoleClient } from "@michinavi/testing";
import { afterEach, describe, expect, test } from "vitest";
import { createAnonymousCaller } from "../../__tests__/helpers";

const serviceRole = createServiceRoleClient();

/** seed に入れた架空の避難所（真備町箭田のあたり） */
const MABI_YATA = { latitude: 34.6383, longitude: 133.6903 };
const importedCodes: string[] = [];

afterEach(async () => {
  if (importedCodes.length > 0) {
    await serviceRole
      .from("shelters")
      .delete()
      .in("external_code", importedCodes.splice(0));
  }
});

describe("shelter.nearby", () => {
  test("現在地から近い順に返る", async () => {
    const { caller } = await createAnonymousCaller();
    const shelters = await caller.shelter.nearby({
      ...MABI_YATA,
      radiusM: 3000,
      limit: 10,
    });

    expect(shelters.length).toBeGreaterThan(0);

    const distances = shelters.map((shelter) => shelter.distanceM);
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
    expect(distances[0]).toBeGreaterThan(0);
  });

  test("半径の外にある避難所は返らない", async () => {
    const { caller } = await createAnonymousCaller();

    const near = await caller.shelter.nearby({
      ...MABI_YATA,
      radiusM: 3000,
      limit: 50,
    });
    const wide = await caller.shelter.nearby({
      ...MABI_YATA,
      radiusM: 20_000,
      limit: 50,
    });

    // 玉島の施設は 10km 以上離れている
    expect(near.some((s) => s.externalCode === "DEMO-SHELTER-005")).toBe(false);
    expect(wide.some((s) => s.externalCode === "DEMO-SHELTER-005")).toBe(true);
  });

  test("受入条件が一緒に返る（D2）", async () => {
    const { caller } = await createAnonymousCaller();
    const shelters = await caller.shelter.nearby({
      ...MABI_YATA,
      radiusM: 3000,
      limit: 10,
    });
    const school = shelters.find(
      (shelter) => shelter.externalCode === "DEMO-SHELTER-001",
    );

    const pet = school?.acceptances.find((entry) => entry.key === "pet");
    expect(pet?.status).toBe("limited");
    expect(pet?.note).toBe("ケージ持参が条件");

    // 表示順はマスタの display_order に従う
    expect(school?.acceptances[0]?.key).toBe("pet");
  });

  test("収容人数が不明な避難所も候補に残る", async () => {
    const { caller } = await createAnonymousCaller();
    const shelters = await caller.shelter.nearby({
      ...MABI_YATA,
      radiusM: 3000,
      limit: 10,
    });
    const park = shelters.find(
      (shelter) => shelter.externalCode === "DEMO-SHELTER-003",
    );

    // 0 で埋めると混雑率が無限大になり、候補から永久に外れる
    expect(park).toBeTruthy();
    expect(park?.capacity).toBeNull();
  });

  test("対応災害は分かっているものだけが返る", async () => {
    const { caller } = await createAnonymousCaller();
    const shelters = await caller.shelter.nearby({
      ...MABI_YATA,
      radiusM: 3000,
      limit: 10,
    });
    const hall = shelters.find(
      (shelter) => shelter.externalCode === "DEMO-SHELTER-002",
    );

    // 「対応していないと明記されている」ことも情報として持つ
    expect(hall?.hazardSupports).toEqual([
      { hazardType: "flood", isSupported: false, note: "浸水想定区域内" },
    ]);
  });

  test("廃止された避難所は返らない", async () => {
    await serviceRole
      .from("shelters")
      .update({ is_active: false })
      .eq("external_code", "DEMO-SHELTER-002");

    const { caller } = await createAnonymousCaller();
    const shelters = await caller.shelter.nearby({
      ...MABI_YATA,
      radiusM: 3000,
      limit: 10,
    });

    expect(shelters.some((s) => s.externalCode === "DEMO-SHELTER-002")).toBe(
      false,
    );

    await serviceRole
      .from("shelters")
      .update({ is_active: true })
      .eq("external_code", "DEMO-SHELTER-002");
  });

  test("入力の検証で弾かれる", async () => {
    const { caller } = await createAnonymousCaller();

    await expect(
      caller.shelter.nearby({ latitude: 999, longitude: 133 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("shelter.byId", () => {
  test("出典を含む詳細が取れる", async () => {
    const { caller } = await createAnonymousCaller();
    const [nearest] = await caller.shelter.nearby({
      ...MABI_YATA,
      radiusM: 3000,
      limit: 1,
    });

    if (!nearest) {
      throw new Error("避難所が seed に入っていません");
    }

    const detail = await caller.shelter.byId({ id: nearest.id });

    expect(detail.name).toBe(nearest.name);
    // どこから来たデータかは画面に必ず出す
    expect(detail.source.length).toBeGreaterThan(0);
    expect(detail.acceptances.length).toBeGreaterThan(0);
  });

  test("存在しない ID は NOT_FOUND", async () => {
    const { caller } = await createAnonymousCaller();

    await expect(
      caller.shelter.byId({ id: "00000000-0000-4000-8000-00000000dead" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("取り込み（import_shelters）", () => {
  test("external_code で突合して追加・更新する", async () => {
    importedCodes.push("TEST-IMPORT-001");

    const created = await serviceRole.rpc("import_shelters", {
      p_shelters: [
        {
          externalCode: "TEST-IMPORT-001",
          name: "取り込みテスト施設",
          address: "岡山県倉敷市真備町箭田（架空）",
          areaId: "00000000-0000-4000-8000-000000000003",
          latitude: 34.639,
          longitude: 133.691,
          capacity: 50,
          source: "テスト",
          acceptances: [{ key: "pet", status: "unavailable" }],
        },
      ],
    });

    expect(created.error).toBeNull();
    expect(created.data?.[0]?.is_created).toBe(true);

    const updated = await serviceRole.rpc("import_shelters", {
      p_shelters: [
        {
          externalCode: "TEST-IMPORT-001",
          name: "取り込みテスト施設（改称）",
          address: "岡山県倉敷市真備町箭田（架空）",
          areaId: "00000000-0000-4000-8000-000000000003",
          latitude: 34.639,
          longitude: 133.691,
          capacity: 80,
          source: "テスト",
          acceptances: [{ key: "pet", status: "available" }],
        },
      ],
    });

    // 再取り込みで行を消して入れ直さない。id が変わると避難の記録が壊れる
    expect(updated.data?.[0]?.is_created).toBe(false);

    const { data } = await serviceRole
      .from("shelters")
      .select("id, name, capacity")
      .eq("external_code", "TEST-IMPORT-001")
      .single();

    expect(data?.name).toBe("取り込みテスト施設（改称）");
    expect(data?.capacity).toBe(80);
  });
});

describe("避難所データの守り", () => {
  test("住民は避難所を書き換えられない", async () => {
    const { ctx } = await createAnonymousCaller();

    const { error } = await ctx.supabase
      .from("shelters")
      .update({ capacity: 1 })
      .eq("external_code", "DEMO-SHELTER-001");

    expect(error?.code).toBe("42501");
  });
});
