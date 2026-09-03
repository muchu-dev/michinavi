import { describe, expect, test } from "vitest";
import {
  neighborMeshCodes,
  quarterMeshCodeToCenter,
  toQuarterMeshCode,
} from "../mesh-code";

describe("toQuarterMeshCode / quarterMeshCodeToCenter", () => {
  test("エンコードしてデコードすると、元の座標に近い中心点が返る", () => {
    const latitude = 35.6918;
    const longitude = 139.7708;

    const meshCode = toQuarterMeshCode(latitude, longitude);
    expect(meshCode).toMatch(/^\d{10}$/);

    const [centerLat, centerLng] = quarterMeshCodeToCenter(meshCode);
    // メッシュの一辺は約250mなので、中心との差は0.002度程度に収まるはず
    expect(Math.abs(centerLat - latitude)).toBeLessThan(0.003);
    expect(Math.abs(centerLng - longitude)).toBeLessThan(0.004);
  });

  test("日本のメッシュ範囲外の座標は例外になる", () => {
    expect(() => toQuarterMeshCode(-10, 139)).toThrow(RangeError);
    expect(() => toQuarterMeshCode(35, 50)).toThrow(RangeError);
  });

  test("10桁でないメッシュコードは例外になる", () => {
    expect(() => quarterMeshCodeToCenter("12345")).toThrow(RangeError);
  });
});

describe("neighborMeshCodes", () => {
  test("4方向の隣接メッシュを返し、自分自身は含まない", () => {
    const meshCode = toQuarterMeshCode(35.6918, 139.7708);
    const neighbors = neighborMeshCodes(meshCode);

    expect(neighbors).not.toContain(meshCode);
    expect(neighbors.length).toBeGreaterThan(0);
    expect(neighbors.length).toBeLessThanOrEqual(4);
    for (const neighbor of neighbors) {
      expect(neighbor).toMatch(/^\d{10}$/);
    }
  });

  test("隣接メッシュの中心は、元のメッシュから1区画分離れている", () => {
    const meshCode = toQuarterMeshCode(35.6918, 139.7708);
    const [originLat, originLng] = quarterMeshCodeToCenter(meshCode);

    for (const neighbor of neighborMeshCodes(meshCode)) {
      const [lat, lng] = quarterMeshCodeToCenter(neighbor);
      const distance = Math.hypot(lat - originLat, lng - originLng);
      // 1区画分の対角線程度に収まっているはず（緯度・経度どちらかにずれる）
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(0.01);
    }
  });

  test("隣接メッシュを行き来すると、元のメッシュに戻ってくる", () => {
    const meshCode = toQuarterMeshCode(35.6918, 139.7708);
    const neighbors = neighborMeshCodes(meshCode);
    const [firstNeighbor] = neighbors;
    if (!firstNeighbor) throw new Error("no neighbor found");

    const neighborsOfNeighbor = neighborMeshCodes(firstNeighbor);
    expect(neighborsOfNeighbor).toContain(meshCode);
  });
});
