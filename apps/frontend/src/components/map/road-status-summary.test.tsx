import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

type Estimate = {
  meshCode: string;
  roadCondition: "passable" | "caution" | "impassable";
  confidence: "high" | "medium" | "low";
  reportCount: number;
  reasoning: string;
  updatedAt: string;
};

type Digest = {
  meshCode: string;
  roadCondition: "passable" | "caution" | "impassable";
  reportCount: number;
  mergedCount: number;
  reporterCount: number;
  counts: { passable: number; caution: number; impassable: number };
  latestReportedAt: string;
  summary: string;
  isAiSummary: boolean;
  updatedAt: string;
};

type QueryResult<T> = {
  data: T[] | undefined;
  isPending: boolean;
  isError: boolean;
};

const { roadStatusUseQuery, reportDigestUseQuery } = vi.hoisted(() => ({
  roadStatusUseQuery: vi.fn<() => QueryResult<Estimate>>(),
  reportDigestUseQuery: vi.fn<() => QueryResult<Digest>>(),
}));

vi.mock("@/lib/trpc/client", () => ({
  api: {
    roadStatus: { list: { useQuery: roadStatusUseQuery } },
    reportDigest: { list: { useQuery: reportDigestUseQuery } },
  },
}));

import { RoadStatusSummary } from "./road-status-summary";

const MESH_CODE = "5133756531";

function loaded<T>(rows: T[]): QueryResult<T> {
  return { data: rows, isPending: false, isError: false };
}

const pending: QueryResult<never> = {
  data: undefined,
  isPending: true,
  isError: false,
};

const failed: QueryResult<never> = {
  data: undefined,
  isPending: false,
  isError: true,
};

/** Gemini が答えたときに保存される推定 */
const aiEstimate: Estimate = {
  meshCode: MESH_CODE,
  roadCondition: "impassable",
  confidence: "high",
  reportCount: 3,
  reasoning: "直近の報告が3件とも通れないため",
  updatedAt: "2026-08-29T02:00:00.000Z",
};

/**
 * Gemini が使えなかったときに保存される推定。
 * router 側（apps/backend/src/api/routers/road-status.ts）の
 * majorityVoteFallback がそのまま入っている形。
 */
const fallbackEstimate: Estimate = {
  meshCode: MESH_CODE,
  roadCondition: "caution",
  confidence: "low",
  reportCount: 3,
  reasoning: "AIの推定に失敗したため、報告件数の多数決で算出しました",
  updatedAt: "2026-08-29T02:00:00.000Z",
};

const aiDigest: Digest = {
  meshCode: MESH_CODE,
  roadCondition: "impassable",
  reportCount: 3,
  mergedCount: 1,
  reporterCount: 3,
  counts: { passable: 0, caution: 0, impassable: 3 },
  latestReportedAt: "2026-08-29T01:50:00.000Z",
  summary: "3人が通れないと報告しています",
  isAiSummary: true,
  updatedAt: "2026-08-29T02:00:00.000Z",
};

/** Gemini が使えなかったときの定型文（report-digest.ts の fallbackSummary） */
const fallbackDigest: Digest = {
  ...aiDigest,
  roadCondition: "caution",
  counts: { passable: 1, caution: 2, impassable: 0 },
  summary:
    "現在は「注意」とみています。内訳は通れる1件・注意2件・通れない0件、3人からの報告です。",
  isAiSummary: false,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RoadStatusSummary", () => {
  it("推定と根拠と最終更新を吹き出しに出す", () => {
    roadStatusUseQuery.mockReturnValue(loaded([aiEstimate]));
    reportDigestUseQuery.mockReturnValue(loaded([aiDigest]));

    render(<RoadStatusSummary meshCode={MESH_CODE} />);

    expect(screen.getByLabelText("この地点の道路状況の推定")).toBeTruthy();
    expect(screen.getByText("通行不可")).toBeTruthy();
    expect(screen.getByText("確度 高い")).toBeTruthy();
    expect(
      screen.getByText("根拠: 直近の報告が3件とも通れないため"),
    ).toBeTruthy();
    expect(
      screen.getByText("まとめ: 3人が通れないと報告しています"),
    ).toBeTruthy();
    expect(screen.getByText("通れる0・注意0・通れない3（3人）")).toBeTruthy();
    // 端末のタイムゾーンに関わらず日本時間で出す
    expect(screen.getByText("2026/08/29 11:00")).toBeTruthy();
    expect(screen.getByText(/AIの要約/)).toBeTruthy();
  });

  it("AIが落ちて多数決にフォールバックした推定でも表示が壊れない", () => {
    roadStatusUseQuery.mockReturnValue(loaded([fallbackEstimate]));
    reportDigestUseQuery.mockReturnValue(loaded([fallbackDigest]));

    render(<RoadStatusSummary meshCode={MESH_CODE} />);

    expect(screen.getByText("注意")).toBeTruthy();
    expect(screen.getByText("確度 低い")).toBeTruthy();
    expect(
      screen.getByText(
        "根拠: AIの推定に失敗したため、報告件数の多数決で算出しました",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(/内訳は通れる1件・注意2件・通れない0件/),
    ).toBeTruthy();
    expect(screen.getByText("通れる1・注意2・通れない0（3人）")).toBeTruthy();
    // AI 由来ではない要約を「AIの要約」と偽らない
    expect(screen.getByText(/自動集計/)).toBeTruthy();
    expect(screen.queryByText(/AIの要約/)).toBeNull();
  });

  it("推定だけ保存されていてまとめが無くても表示できる", () => {
    roadStatusUseQuery.mockReturnValue(loaded([fallbackEstimate]));
    reportDigestUseQuery.mockReturnValue(loaded([]));

    render(<RoadStatusSummary meshCode={MESH_CODE} />);

    expect(screen.getByText("注意")).toBeTruthy();
    expect(screen.getByText("確度 低い")).toBeTruthy();
    expect(screen.queryByText(/^まとめ: /)).toBeNull();
    expect(screen.getByText(/自動集計/)).toBeTruthy();
  });

  it("まとめだけ保存されていて推定が無くても表示できる", () => {
    roadStatusUseQuery.mockReturnValue(loaded([]));
    reportDigestUseQuery.mockReturnValue(loaded([aiDigest]));

    render(<RoadStatusSummary meshCode={MESH_CODE} />);

    expect(screen.getByText("通行不可")).toBeTruthy();
    // 確度は推定にしか無いので、あるように見せない
    expect(screen.getByText("集計のみ")).toBeTruthy();
    expect(screen.queryByText(/^根拠: /)).toBeNull();
    expect(
      screen.getByText("まとめ: 3人が通れないと報告しています"),
    ).toBeTruthy();
  });

  it("「注意」のバッジに白文字を載せない", () => {
    // 黄色（--caution #f0a92e）に白文字はコントラスト比 2.02:1 で、
    // 12px のこのバッジは WCAG 2.1 AA（4.5:1）を満たさない。
    // 面の色は地図の凡例と揃えるため、前景を --caution-contrast（8.15:1）にする
    roadStatusUseQuery.mockReturnValue(loaded([fallbackEstimate]));
    reportDigestUseQuery.mockReturnValue(loaded([fallbackDigest]));

    render(<RoadStatusSummary meshCode={MESH_CODE} />);

    const badge = screen.getByText("注意");
    expect(badge.className).toContain("bg-caution");
    expect(badge.className).toContain("text-caution-contrast");
    expect(badge.className).not.toContain("text-white");
  });

  it("濃い面のバッジは白文字のままでよい", () => {
    roadStatusUseQuery.mockReturnValue(loaded([aiEstimate]));
    reportDigestUseQuery.mockReturnValue(loaded([aiDigest]));

    render(<RoadStatusSummary meshCode={MESH_CODE} />);

    const badge = screen.getByText("通行不可");
    expect(badge.className).toContain("bg-impassable");
    expect(badge.className).toContain("text-white");
  });

  it("他の地点の推定を混ぜない", () => {
    roadStatusUseQuery.mockReturnValue(
      loaded([{ ...aiEstimate, meshCode: "5133756532" }]),
    );
    reportDigestUseQuery.mockReturnValue(
      loaded([{ ...aiDigest, meshCode: "5133756532" }]),
    );

    render(<RoadStatusSummary meshCode={MESH_CODE} />);

    expect(screen.getByText("この地点の推定はまだありません")).toBeTruthy();
    expect(screen.queryByText("通行不可")).toBeNull();
  });

  it("取得中は読み込み中と伝える", () => {
    roadStatusUseQuery.mockReturnValue(pending);
    reportDigestUseQuery.mockReturnValue(loaded([]));

    render(<RoadStatusSummary meshCode={MESH_CODE} />);

    expect(screen.getByRole("status").textContent).toBe(
      "道路状況の推定を読み込んでいます",
    );
  });

  it("取得に失敗しても投稿の吹き出しごと壊さず、失敗だけを伝える", () => {
    roadStatusUseQuery.mockReturnValue(failed);
    reportDigestUseQuery.mockReturnValue(failed);

    render(<RoadStatusSummary meshCode={MESH_CODE} />);

    expect(screen.getByRole("alert").textContent).toBe(
      "道路状況の推定を取得できませんでした",
    );
  });

  it("片方の取得に失敗しても、読めた方の推定は出す", () => {
    roadStatusUseQuery.mockReturnValue(failed);
    reportDigestUseQuery.mockReturnValue(loaded([aiDigest]));

    render(<RoadStatusSummary meshCode={MESH_CODE} />);

    expect(screen.getByText("通行不可")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("推定が1件も無い地点では、無いとだけ伝える", () => {
    roadStatusUseQuery.mockReturnValue(loaded([]));
    reportDigestUseQuery.mockReturnValue(loaded([]));

    render(<RoadStatusSummary meshCode={MESH_CODE} />);

    expect(screen.getByText("この地点の推定はまだありません")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("通行可の推定も色分けして出す", () => {
    roadStatusUseQuery.mockReturnValue(
      loaded([
        {
          ...aiEstimate,
          roadCondition: "passable",
          confidence: "medium",
          reasoning: "直近2件が通れると報告しているため",
        },
      ]),
    );
    reportDigestUseQuery.mockReturnValue(loaded([]));

    render(<RoadStatusSummary meshCode={MESH_CODE} />);

    const badge = screen.getByText("通行可");
    expect(badge.className).toContain("bg-passable");
    expect(screen.getByText("確度 ふつう")).toBeTruthy();
  });

  it("推定は一覧から、まとめは地点を指定して問い合わせる", () => {
    roadStatusUseQuery.mockReturnValue(loaded([]));
    reportDigestUseQuery.mockReturnValue(loaded([]));

    render(<RoadStatusSummary meshCode={MESH_CODE} />);

    expect(roadStatusUseQuery).toHaveBeenCalledWith({ limit: 500 });
    // まとめは地点を指定して取る。投稿の多い環境で一覧から溢れないようにするため
    expect(reportDigestUseQuery).toHaveBeenCalledWith({
      limit: 1,
      meshCodePrefix: MESH_CODE,
    });
  });
});
