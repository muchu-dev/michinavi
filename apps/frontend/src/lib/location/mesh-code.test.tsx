import { describe, expect, it } from "vitest";
import { quarterMeshCodeToCenter, toQuarterMeshCode } from "./mesh-code";

describe("toQuarterMeshCode", () => {
  it("converts a coordinate to a 10-digit quarter mesh code", () => {
    expect(toQuarterMeshCode(35.681236, 139.767125)).toBe("5339461132");
  });

  it("rejects coordinates outside the Japanese mesh range", () => {
    expect(() => toQuarterMeshCode(35, 99)).toThrow(RangeError);
  });

  it("restores the center of a quarter mesh", () => {
    const meshCode = toQuarterMeshCode(34.6383, 133.6903);
    const [latitude, longitude] = quarterMeshCodeToCenter(meshCode);

    expect(meshCode).toBe("5133756531");
    expect(Math.abs(latitude - 34.6383)).toBeLessThan(0.002);
    expect(Math.abs(longitude - 133.6903)).toBeLessThan(0.002);
  });

  it("rejects an out-of-range secondary mesh digit", () => {
    expect(() => quarterMeshCodeToCenter("5133889911")).toThrow(RangeError);
  });
});
