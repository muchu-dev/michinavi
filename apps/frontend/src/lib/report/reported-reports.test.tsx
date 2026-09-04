import { describe, expect, it } from "vitest";
import {
  describeReportFailure,
  isAlreadyReportedError,
  isReported,
  toContentFlagInput,
} from "./reported-reports";

/** tRPC のクライアント側エラーは data.code に tRPC のコードを載せて返る */
function trpcError(code: string) {
  return Object.assign(new Error(code), { data: { code } });
}

describe("isReported", () => {
  it("treats a report with no flags loaded yet as not reported", () => {
    expect(isReported(undefined, "report-1")).toBe(false);
    expect(isReported([], "report-1")).toBe(false);
  });

  it("finds the report the user has already flagged", () => {
    const flags = [
      { targetType: "field_report", targetId: "report-1" },
      { targetType: "field_report", targetId: "report-2" },
    ];

    expect(isReported(flags, "report-2")).toBe(true);
    expect(isReported(flags, "report-3")).toBe(false);
  });

  it("does not match a flag on another kind of target", () => {
    const flags = [{ targetType: "community_post", targetId: "report-1" }];

    expect(isReported(flags, "report-1")).toBe(false);
  });
});

describe("toContentFlagInput", () => {
  it("sends the note as the server's detail field", () => {
    expect(
      toContentFlagInput({
        fieldReportId: "report-1",
        reason: "privacy",
        note: "  表札が読める  ",
      }),
    ).toEqual({
      targetType: "field_report",
      targetId: "report-1",
      reason: "privacy",
      detail: "表札が読める",
    });
  });

  it("omits the detail when the note is empty, because the server rejects it", () => {
    expect(
      toContentFlagInput({
        fieldReportId: "report-1",
        reason: "spam",
        note: "   ",
      }).detail,
    ).toBeUndefined();

    expect(
      toContentFlagInput({ fieldReportId: "report-1", reason: "spam" }).detail,
    ).toBeUndefined();
  });
});

describe("isAlreadyReportedError", () => {
  it("recognises the conflict the server returns for a second report", () => {
    expect(isAlreadyReportedError(trpcError("CONFLICT"))).toBe(true);
  });

  it("does not mistake another failure for an existing report", () => {
    expect(isAlreadyReportedError(trpcError("INTERNAL_SERVER_ERROR"))).toBe(
      false,
    );
    expect(isAlreadyReportedError(new Error("network down"))).toBe(false);
    expect(isAlreadyReportedError(undefined)).toBe(false);
  });
});

describe("describeReportFailure", () => {
  it("asks the user to sign in when the report was rejected as unauthorized", () => {
    expect(describeReportFailure(trpcError("UNAUTHORIZED"))).toContain(
      "ログイン",
    );
  });

  it("explains that the post is gone when the target was not found", () => {
    expect(describeReportFailure(trpcError("NOT_FOUND"))).toContain(
      "見つかりませんでした",
    );
  });

  it("explains the limit when too many reports were sent", () => {
    expect(describeReportFailure(trpcError("TOO_MANY_REQUESTS"))).toContain(
      "上限",
    );
  });

  it("falls back to a message about the connection for anything else", () => {
    expect(describeReportFailure(new Error("network down"))).toContain(
      "通信の状態",
    );
    expect(describeReportFailure({ data: { code: 500 } })).toContain(
      "通信の状態",
    );
  });
});
