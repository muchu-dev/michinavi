import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mutate = vi.fn();
const reset = vi.fn();
const refetch = vi.fn();

type QueryState = {
  data?: ReturnType<typeof advice>;
  error: ErrorWithCode | null;
  isLoading: boolean;
  refetch: typeof refetch;
};

type MutationState = {
  error: ErrorWithCode | null;
  isPending: boolean;
  mutate: typeof mutate;
  reset: typeof reset;
};

type ErrorWithCode = Error & { data: { code: string } };

let latestState: QueryState;
let mutationState: MutationState;

function trpcError(code: string, message: string): ErrorWithCode {
  return Object.assign(new Error(message), { data: { code } });
}

function advice(expiresAt = "2999-01-01T00:00:00.000Z") {
  return {
    adviceId: "advice-1",
    summary: "周辺状況と世帯情報から、複数の行動を比較できます。",
    isAiGenerated: true,
    generatedAt: "2026-09-04T00:00:00.000Z",
    expiresAt,
    homeMeshCode: "5233669911",
    inputSnapshot: {
      surroundings: { reportCount: 12, caution: 0, impassable: 0 },
    },
    options: [
      {
        id: "option-1",
        rank: 1,
        optionType: "designated_shelter" as const,
        travelMode: "walk" as const,
        title: "徒歩で避難する",
        reason: "渋滞の影響を受けずに移動できます。",
        riskNote: "暗くなると足元が見えにくくなります。",
        estimatedMinutes: null,
        switchCriteria: [
          {
            id: "criterion-1",
            triggerType: "observation" as const,
            description: "道に膝より上の水があれば引き返します。",
            thresholdValue: 50,
            thresholdUnit: "cm",
            comparator: "gte" as const,
            switchToOptionId: "option-3",
            displayOrder: 0,
          },
        ],
      },
      {
        id: "option-2",
        rank: 2,
        optionType: "designated_shelter" as const,
        travelMode: "car" as const,
        title: "車で避難する",
        reason: "移動に配慮が必要な家族と移動できます。",
        riskNote: null,
        estimatedMinutes: null,
        switchCriteria: [],
      },
      {
        id: "option-3",
        rank: 3,
        optionType: "stay_home" as const,
        travelMode: "none" as const,
        title: "自宅にとどまる",
        reason: "建物の安全を確認しながら待機できます。",
        riskNote: "救助が届くまで時間がかかる可能性があります。",
        estimatedMinutes: null,
        switchCriteria: [],
      },
      {
        id: "option-4",
        rank: 4,
        optionType: "vertical" as const,
        travelMode: "none" as const,
        title: "建物の上階へ移る",
        reason: "外へ出ることが危険な場合の選択肢です。",
        riskNote: "浸水が届く高さでは避けられません。",
        estimatedMinutes: null,
        switchCriteria: [],
      },
    ],
  };
}

vi.mock("@/lib/trpc/client", () => ({
  api: {
    evacuation: {
      latest: { useQuery: () => latestState },
      generate: { useMutation: () => mutationState },
    },
  },
}));

import { ChoicePanel } from "./choice-panel";

beforeEach(() => {
  latestState = {
    data: advice(),
    error: null,
    isLoading: false,
    refetch,
  };
  mutationState = {
    error: null,
    isPending: false,
    mutate,
    reset,
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ChoicePanel", () => {
  it("shows every API option and marks only rank 1 as recommended", () => {
    render(<ChoicePanel />);

    for (const title of [
      "徒歩で避難する",
      "車で避難する",
      "自宅にとどまる",
      "建物の上階へ移る",
    ]) {
      expect(
        screen.getByRole("button", { name: `${title}の詳細を表示` }),
      ).toBeTruthy();
    }
    expect(screen.getAllByText("推奨")).toHaveLength(1);
    expect(
      screen.getAllByText("周辺に通行不可の報告なし・投稿12件"),
    ).toHaveLength(4);
    expect(screen.queryByText(/周辺状況と世帯情報/)).toBeNull();
    expect(
      screen.getByRole("heading", { name: "AIが提案する避難の選択肢" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "更新" })).toBeTruthy();
    expect(screen.getByText("4件/09:00時点")).toBeTruthy();
    expect(
      screen.getByText(
        "決めるのはあなたです。状況が変わったら再確認してください。",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/渋滞の影響を受けず/)).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "徒歩で避難するの詳細を表示" }),
    );

    expect(screen.getByText(/渋滞の影響を受けず/)).toBeTruthy();
    expect(screen.getByText(/暗くなると足元/)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "選択肢一覧へ戻る" }),
    ).toBeTruthy();
  });

  it("shows that there are no reports in the generated snapshot", () => {
    latestState = {
      ...latestState,
      data: {
        ...advice(),
        inputSnapshot: {
          surroundings: { reportCount: 0, caution: 0, impassable: 0 },
        },
      },
    };
    render(<ChoicePanel />);

    expect(screen.getAllByText("周辺の報告なし")).toHaveLength(4);
  });

  it("does not claim there are no reports when the snapshot cannot be read", () => {
    // 読めなかったのを「報告なし」と言い切ると、確認できていない状態が
    // 安全に見える。災害時にここは安心側へ倒したくない
    latestState = {
      ...latestState,
      data: {
        ...advice(),
        // input_snapshot は jsonb なので、型の形どおりの値が入っている保証はない。
        // readRoadSnapshot が unknown を受けているのはそのためで、
        // ここではその「型どおりでない値」を再現するために型を外している
        inputSnapshot: { surroundings: "壊れた形" } as unknown as ReturnType<
          typeof advice
        >["inputSnapshot"],
      },
    };
    render(<ChoicePanel />);

    expect(screen.queryByText("周辺の報告なし")).toBeNull();
    expect(
      screen.getAllByText("周辺の状況を取得できませんでした"),
    ).toHaveLength(4);
  });

  it("shows switch criteria", () => {
    render(<ChoicePanel />);

    fireEvent.click(
      screen.getByRole("button", { name: "徒歩で避難するの詳細を表示" }),
    );

    expect(screen.getByText("切り替えを考える目安")).toBeTruthy();
    expect(
      screen.getByText("道に膝より上の水があれば引き返します。"),
    ).toBeTruthy();
  });

  it("shows the shelter assigned by the backend on shelter options", () => {
    render(
      <ChoicePanel
        assignedShelter={{
          shelterId: "shelter-1",
          shelterName: "デモ第一小学校",
          partySize: 3,
          isOverCapacity: false,
          distanceM: 179,
          expectedPeopleBefore: 12,
          alternatives: [],
        }}
      />,
    );

    expect(
      screen.getByText("直線距離での目安 約3分／デモ第一小学校"),
    ).toBeTruthy();
    expect(screen.getByText("所要時間未取得／デモ第一小学校")).toBeTruthy();
    expect(screen.getByText("即時／自宅")).toBeTruthy();
    expect(screen.getByText("即時／現在いる建物")).toBeTruthy();
    expect(screen.queryByText(/km/)).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "徒歩で避難するの詳細を表示" }),
    );
    expect(
      screen.getByText(/混雑状況を考慮した避難先：デモ第一小学校/),
    ).toBeTruthy();
  });

  it("offers generation when no latest advice exists", () => {
    latestState = {
      ...latestState,
      data: undefined,
      error: trpcError("NOT_FOUND", "避難の提案がまだありません"),
    };
    render(<ChoicePanel />);

    fireEvent.click(screen.getByRole("button", { name: "選択肢を作る" }));

    expect(reset).toHaveBeenCalledOnce();
    expect(mutate).toHaveBeenCalledWith(undefined);
  });

  it("warns when the advice has expired", () => {
    latestState = {
      ...latestState,
      data: advice("2020-01-01T00:00:00.000Z"),
    };
    render(<ChoicePanel />);

    expect(screen.getByRole("alert").textContent).toContain(
      "この情報は古くなっています",
    );
  });

  it("explains when household registration is missing", () => {
    latestState = {
      ...latestState,
      data: undefined,
      error: trpcError("NOT_FOUND", "message can change"),
    };
    mutationState = {
      ...mutationState,
      error: trpcError("NOT_FOUND", "message can change"),
    };
    render(<ChoicePanel />);

    expect(
      screen.getByRole("heading", { name: "世帯情報が必要です" }),
    ).toBeTruthy();
  });

  it("handles authentication and other retrieval errors", () => {
    latestState = {
      ...latestState,
      data: undefined,
      error: trpcError("UNAUTHORIZED", "ログインが必要です"),
    };
    const { rerender } = render(<ChoicePanel />);
    expect(
      screen.getByRole("heading", { name: "ログインが必要です" }),
    ).toBeTruthy();

    latestState = {
      ...latestState,
      error: trpcError("INTERNAL_SERVER_ERROR", "取得に失敗しました"),
    };
    rerender(<ChoicePanel />);
    expect(
      screen.getByRole("heading", { name: "選択肢を取得できませんでした" }),
    ).toBeTruthy();
  });
});
