import { afterEach, describe, expect, it } from "vitest";
import { isReported, markReported, submitReport } from "./reported-reports";

const STORAGE_KEY = "michinavi.reported-field-reports.v1";

afterEach(() => {
  window.localStorage.clear();
});

describe("reported reports store", () => {
  it("treats an unknown report as not yet reported", () => {
    expect(isReported("report-1")).toBe(false);
  });

  it("remembers a reported id", () => {
    markReported("report-1");

    expect(isReported("report-1")).toBe(true);
    expect(isReported("report-2")).toBe(false);
  });

  it("does not store the same id twice", () => {
    markReported("report-1");
    markReported("report-1");

    expect(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]"),
    ).toEqual(["report-1"]);
  });

  it("ignores a broken stored value instead of throwing", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");

    expect(isReported("report-1")).toBe(false);

    markReported("report-1");
    expect(isReported("report-1")).toBe(true);
  });

  it("ignores entries that are not strings", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([1, "report-1"]));

    expect(isReported("report-1")).toBe(true);
  });

  it("records the report and reports that the server has not received it yet", async () => {
    const result = await submitReport({
      fieldReportId: "report-1",
      reason: "false_info",
    });

    // BE-24 が入るまではサーバへ送る先が無い
    expect(result.deliveredToServer).toBe(false);
    expect(isReported("report-1")).toBe(true);
  });
});
