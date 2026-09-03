import { createServiceRoleClient } from "@michinavi/testing";
import { afterEach, describe, expect, test } from "vitest";
import {
  neighborMeshCodes,
  quarterMeshCodeToCenter,
  toQuarterMeshCode,
} from "../../../location/mesh-code";
import { createAnonymousCaller } from "../../__tests__/helpers";

const serviceRole = createServiceRoleClient();
const insertedMeshCodes: string[] = [];

/**
 * road_status_estimates は user に紐づかず、field_reports と違って
 * 外部キーによる後片付けの経路が無いため、この行が手で消す
 */
afterEach(async () => {
  const codes = insertedMeshCodes.splice(0);
  if (codes.length > 0) {
    await serviceRole
      .from("road_status_estimates")
      .delete()
      .in("mesh_code", codes);
  }
});

async function markImpassable(meshCode: string): Promise<void> {
  insertedMeshCodes.push(meshCode);
  const { error } = await serviceRole.from("road_status_estimates").insert({
    mesh_code: meshCode,
    road_condition: "impassable",
    confidence: "high",
    report_count: 1,
    reasoning: "テスト用に通行不可とした",
  });
  if (error) throw error;
}

/**
 * 実行のたびに異なる座標域を使う。road_status_estimates への書き込みは
 * field_reports のように後片付けの仕組みが弱いため、固定座標だと
 * 前回実行の残骸と衝突しうる
 */
function testOrigin(): { latitude: number; longitude: number } {
  const offset = (Date.now() % 100_000) / 1_000_000; // 0〜0.1度程度の範囲でずらす
  return { latitude: 35.5 + offset, longitude: 139.5 + offset };
}

/** 出発点より北にある隣接メッシュを1つ選ぶ */
function findNorthNeighbor(meshCode: string, fromLatitude: number): string {
  const found = neighborMeshCodes(meshCode).find((code) => {
    const [lat] = quarterMeshCodeToCenter(code);
    return lat > fromLatitude;
  });
  if (!found) throw new Error("no north neighbor found");
  return found;
}

describe("route.suggest", () => {
  test("既に同じメッシュなら、そのメッシュだけの経路が返る", async () => {
    const { caller } = await createAnonymousCaller();
    const point = testOrigin();

    const result = await caller.route.suggest({
      origin: point,
      destination: point,
    });

    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.path).toHaveLength(1);
      expect(result.hopCount).toBe(0);
    }
  });

  test("何も通行不可が無ければ、隣接メッシュをつないだ経路が返る", async () => {
    const { caller } = await createAnonymousCaller();
    const origin = testOrigin();
    const originMeshCode = toQuarterMeshCode(origin.latitude, origin.longitude);
    const [neighborMeshCode] = neighborMeshCodes(originMeshCode);
    if (!neighborMeshCode) throw new Error("no neighbor found");

    // 隣接メッシュの中心座標を目的地にすることで、隣り合っていることを保証する
    const [destLat, destLng] = quarterMeshCodeToCenter(neighborMeshCode);

    const result = await caller.route.suggest({
      origin,
      destination: { latitude: destLat, longitude: destLng },
    });

    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.path[0]?.meshCode).toBe(originMeshCode);
      expect(result.path.at(-1)?.meshCode).toBe(neighborMeshCode);
      expect(result.hopCount).toBe(1);
    }
    expect(result.disclaimer).toContain(
      "実際の道路のつながりを保証するものではありません",
    );
  });

  test("出発メッシュ自体が通行不可なら、経路は見つからない", async () => {
    const { caller } = await createAnonymousCaller();
    const origin = testOrigin();
    const originMeshCode = toQuarterMeshCode(origin.latitude, origin.longitude);
    await markImpassable(originMeshCode);

    const destination = {
      latitude: origin.latitude + 0.01,
      longitude: origin.longitude,
    };

    const result = await caller.route.suggest({ origin, destination });

    expect(result.found).toBe(false);
    expect(result.path).toEqual([]);
  });

  test("直接隣接するメッシュが通行不可でも、迂回できれば経路が見つかる", async () => {
    const { caller } = await createAnonymousCaller();
    const origin = testOrigin();
    const originMeshCode = toQuarterMeshCode(origin.latitude, origin.longitude);

    // 出発点から北へ2メッシュ分離れた地点を目的地にし、
    // その直進経路上（1メッシュ目）だけを塞ぐ
    const firstStepMeshCode = findNorthNeighbor(
      originMeshCode,
      origin.latitude,
    );
    const [firstStepLat] = quarterMeshCodeToCenter(firstStepMeshCode);
    const destinationMeshCode = findNorthNeighbor(
      firstStepMeshCode,
      firstStepLat,
    );
    const [destLat, destLng] = quarterMeshCodeToCenter(destinationMeshCode);

    await markImpassable(firstStepMeshCode);

    const result = await caller.route.suggest({
      origin,
      destination: { latitude: destLat, longitude: destLng },
    });

    expect(result.found).toBe(true);
    if (result.found) {
      const pathMeshCodes = result.path.map((step) => step.meshCode);
      expect(pathMeshCodes).not.toContain(firstStepMeshCode);
      expect(pathMeshCodes[0]).toBe(originMeshCode);
      expect(pathMeshCodes.at(-1)).toBe(destinationMeshCode);
      // 塞がれていなければ2ホップで着くはずが、迂回するので3ホップ以上になる
      expect(result.hopCount).toBeGreaterThan(2);
    }
  });

  test("日本のメッシュ範囲外の座標は BAD_REQUEST になる", async () => {
    const { caller } = await createAnonymousCaller();

    await expect(
      caller.route.suggest({
        origin: { latitude: 0, longitude: 0 },
        destination: { latitude: 35.6, longitude: 139.7 },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("未認証でも呼び出せる", async () => {
    const { caller } = await createAnonymousCaller();
    const point = testOrigin();

    await expect(
      caller.route.suggest({ origin: point, destination: point }),
    ).resolves.toMatchObject({ found: true });
  });
});
