import { describe, expect, test } from "vitest";
import { createAnonymousCaller } from "../../__tests__/helpers";

describe("area.resolveFromAddress", () => {
  test("神田の実在する町丁目名を含む住所は、その地区に一意に決まる", async () => {
    const { caller } = await createAnonymousCaller();

    const result = await caller.area.resolveFromAddress({
      address: "東京都千代田区神田錦町三丁目1番1号",
    });

    expect(result.name).toBe("神田錦町");
  });

  test("接頭辞ではなく接尾辞側に「神田」がつく地区名も一致する", async () => {
    const { caller } = await createAnonymousCaller();

    const result = await caller.area.resolveFromAddress({
      address: "東京都千代田区内神田2-1-1",
    });

    expect(result.name).toBe("内神田");
  });

  test("既存の岡山県のシードデータに対しても同じ仕組みで一致する", async () => {
    const { caller } = await createAnonymousCaller();

    const result = await caller.area.resolveFromAddress({
      address: "岡山県倉敷市真備町箭田1234",
    });

    expect(result.name).toBe("真備町箭田");
  });

  test("未認証でも呼び出せる", async () => {
    const { caller } = await createAnonymousCaller();

    await expect(
      caller.area.resolveFromAddress({ address: "東京都千代田区神田司町1-1" }),
    ).resolves.toMatchObject({ name: "神田司町" });
  });

  test("どの地区名も含まない住所は特定できない", async () => {
    const { caller } = await createAnonymousCaller();

    await expect(
      caller.area.resolveFromAddress({
        address: "北海道札幌市中央区北一条西1丁目",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("入力の検証で弾かれる", async () => {
    const { caller } = await createAnonymousCaller();

    await expect(
      caller.area.resolveFromAddress({ address: "" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
