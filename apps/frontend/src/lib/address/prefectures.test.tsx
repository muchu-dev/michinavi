import { describe, expect, it } from "vitest";
import { PREFECTURES } from "./prefectures";

describe("PREFECTURES", () => {
  it("contains all 47 prefectures exactly once in geographic order", () => {
    expect(PREFECTURES).toHaveLength(47);
    expect(new Set(PREFECTURES)).toHaveLength(47);
    expect(PREFECTURES[0]).toBe("北海道");
    expect(PREFECTURES[46]).toBe("沖縄県");
  });
});
