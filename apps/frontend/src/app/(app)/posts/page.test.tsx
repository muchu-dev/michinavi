import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ReportListResult = {
  data: Array<{
    id: string;
    meshCode: string;
    roadCondition: "passable" | "caution" | "impassable";
    createdAt: string;
  }>;
  dataUpdatedAt: number;
  isError: boolean;
  isPending: boolean;
  isFetching?: boolean;
  refetch: () => void;
};

const { listUseQuery, mutateAsync, refetch } = vi.hoisted(() => {
  const refetch = vi.fn();
  return {
    refetch,
    listUseQuery: vi.fn<() => ReportListResult>(() => ({
      data: [],
      dataUpdatedAt: Date.now(),
      isError: false,
      isPending: false,
      refetch,
    })),
    mutateAsync: vi.fn(),
  };
});

vi.mock("@/components/map/map-view", () => ({
  MapView: ({
    onPositionChange,
    reports = [],
    previewPosition,
  }: {
    onPositionChange?: (position: [number, number]) => void;
    reports?: unknown[];
    previewPosition?: [number, number] | null;
  }) => (
    <div role="img" aria-label="投稿地点の地図">
      <span data-report-count={reports.length} />
      <span data-preview-position={JSON.stringify(previewPosition)} />
      {onPositionChange ? (
        <button
          type="button"
          onClick={() => onPositionChange([34.6383, 133.6903])}
        >
          テスト現在地を設定
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock("@/lib/trpc/client", () => ({
  api: {
    fieldReport: {
      create: { useMutation: () => ({ mutateAsync }) },
      list: { useQuery: listUseQuery },
    },
    useUtils: () => ({
      fieldReport: { list: { invalidate: vi.fn() } },
    }),
  },
}));

import PostsPage from "./page";

// mockReturnValue は clearAllMocks では消えないので、既定値を毎回置き直す
beforeEach(() => {
  listUseQuery.mockReturnValue({
    data: [],
    dataUpdatedAt: Date.now(),
    isError: false,
    isPending: false,
    refetch,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("PostsPage", () => {
  it("asks the server to scope the report list to the current regional mesh", () => {
    render(<PostsPage />);

    // 絞り込みは DB 側で行う。取得した 100 件を画面で捨てる作りだと、
    // 他の地域の投稿が増えたときに自分の地域が窓から押し出されて空になる
    expect(listUseQuery).toHaveBeenCalledWith({
      limit: 100,
      meshPrefix: "513375",
    });
  });

  it("re-scopes the query when the map moves to another region", () => {
    render(<PostsPage />);
    listUseQuery.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "テスト現在地を設定" }));

    expect(listUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ meshPrefix: "513375" }),
    );
  });

  it("renders every report the server returns without dropping any", () => {
    listUseQuery.mockReturnValueOnce({
      data: [
        {
          id: "first",
          meshCode: "5133756531",
          roadCondition: "passable" as const,
          createdAt: new Date().toISOString(),
        },
        {
          id: "second",
          meshCode: "5133756533",
          roadCondition: "caution" as const,
          createdAt: new Date().toISOString(),
        },
      ],
      dataUpdatedAt: Date.now(),
      isError: false,
      isPending: false,
      refetch,
    });

    render(<PostsPage />);

    expect(
      screen
        .getByRole("img", { name: "投稿地点の地図" })
        .querySelector("[data-report-count]")
        ?.getAttribute("data-report-count"),
    ).toBe("2");
  });

  it("tells the reader that the area has no reports yet once the list arrives", () => {
    render(<PostsPage />);

    // 「0件」という数字だけでは、取得できなかったのか本当に無いのか分からない
    expect(screen.getByText("まだこの地域の投稿がありません")).toBeTruthy();
    // 投稿地点が決まるまでは、画面下のボタンと重ねて2つ出さない
    expect(
      screen.queryByRole("button", { name: "いまの状況を投稿する" }),
    ).toBeNull();
  });

  it("opens the report form from the empty state once a position is known", () => {
    render(<PostsPage />);

    fireEvent.click(screen.getByRole("button", { name: "テスト現在地を設定" }));
    fireEvent.click(
      screen.getByRole("button", { name: "いまの状況を投稿する" }),
    );

    expect(screen.getByRole("radio", { name: "通れる" })).toBeTruthy();
  });

  it("does not claim the area is empty while the list is still loading", () => {
    listUseQuery.mockReturnValue({
      data: [],
      dataUpdatedAt: 0,
      isError: false,
      isPending: true,
      refetch,
    });

    render(<PostsPage />);

    expect(screen.queryByText("まだこの地域の投稿がありません")).toBeNull();
    expect(screen.getByText("投稿一覧を読み込んでいます")).toBeTruthy();
  });

  it("offers a retry that re-fetches the list when it cannot be loaded", () => {
    listUseQuery.mockReturnValue({
      data: [],
      dataUpdatedAt: 0,
      isError: true,
      isPending: false,
      refetch,
    });

    render(<PostsPage />);

    expect(screen.getByRole("alert").textContent).toContain(
      "投稿一覧を取得できませんでした",
    );
    fireEvent.click(screen.getByRole("button", { name: "もう一度読み込む" }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the last reports on the map and says so when a refresh fails", () => {
    listUseQuery.mockReturnValue({
      data: [
        {
          id: "stale",
          meshCode: "5133756531",
          roadCondition: "impassable",
          createdAt: new Date().toISOString(),
        },
      ],
      dataUpdatedAt: Date.now(),
      isError: true,
      isPending: false,
      refetch,
    });

    render(<PostsPage />);

    // 災害時は古い情報でも読めることが優先なので、地図は消さない
    expect(
      screen
        .getByRole("img", { name: "投稿地点の地図" })
        .querySelector("[data-report-count]")
        ?.getAttribute("data-report-count"),
    ).toBe("1");
    expect(screen.getByRole("alert").textContent).toContain(
      "最後に取得できた投稿です",
    );
  });

  it("shows that a retry is running instead of looking unresponsive", () => {
    listUseQuery.mockReturnValue({
      data: [],
      dataUpdatedAt: 0,
      isError: true,
      isPending: false,
      isFetching: true,
      refetch,
    });

    render(<PostsPage />);

    expect(
      screen.getByRole("button", { name: "読み込んでいます…" }),
    ).toBeTruthy();
  });

  it("shows the post position preview while the report form is open", () => {
    render(<PostsPage />);

    const reportButton = screen.getByRole("button", {
      name: "現在地を取得して投稿地点を確認",
    }) as HTMLButtonElement;
    expect(reportButton.disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "テスト現在地を設定" }));
    expect(
      screen
        .getByRole("img", { name: "投稿地点の地図" })
        .querySelector("[data-preview-position]")
        ?.getAttribute("data-preview-position"),
    ).toBe("null");

    fireEvent.click(
      screen.getByRole("button", { name: "この道の状況を報告する" }),
    );
    const previewMap = screen.getByRole("img", {
      name: "投稿地点の地図",
    });
    expect(
      previewMap
        .querySelector("[data-preview-position]")
        ?.getAttribute("data-preview-position"),
    ).toBe("[34.6383,133.6903]");
    expect(screen.getByText("このピンの位置に投稿されます")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "通れる" })).toBeTruthy();
  });

  it("uses native radios and allows caution submission without a cause", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (success: PositionCallback) =>
          success({
            coords: { latitude: 35.6812, longitude: 139.7671 },
          } as GeolocationPosition),
      },
    });
    render(<PostsPage />);

    fireEvent.click(screen.getByRole("button", { name: "テスト現在地を設定" }));
    fireEvent.click(
      screen.getByRole("button", { name: "この道の状況を報告する" }),
    );
    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "注意が必要" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("radio", { name: "注意が必要" }));

    expect(screen.getByText("選択中")).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(9);
    expect(
      (screen.getByRole("button", { name: "投稿する" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("does not count the current location as a preview and clears the preview after submission", async () => {
    listUseQuery.mockReturnValue({
      data: [
        {
          id: "existing",
          meshCode: "5133756531",
          roadCondition: "passable",
          createdAt: new Date().toISOString(),
        },
      ],
      dataUpdatedAt: Date.now(),
      isError: false,
      isPending: false,
      refetch,
    });
    mutateAsync.mockResolvedValueOnce({ id: "created" });
    render(<PostsPage />);

    fireEvent.click(screen.getByRole("button", { name: "テスト現在地を設定" }));
    const mapBeforeSubmit = screen.getByRole("img", {
      name: "投稿地点の地図",
    });
    expect(
      mapBeforeSubmit
        .querySelector("[data-report-count]")
        ?.getAttribute("data-report-count"),
    ).toBe("1");
    expect(
      mapBeforeSubmit
        .querySelector("[data-preview-position]")
        ?.getAttribute("data-preview-position"),
    ).toBe("null");

    fireEvent.click(
      screen.getByRole("button", { name: "この道の状況を報告する" }),
    );
    fireEvent.click(screen.getByRole("radio", { name: "通れる" }));
    fireEvent.click(screen.getByRole("button", { name: "投稿する" }));

    await waitFor(() => {
      expect(screen.queryByRole("radio", { name: "通れる" })).toBeNull();
    });
    const mapAfterSubmit = screen.getByRole("img", {
      name: "投稿地点の地図",
    });
    expect(
      mapAfterSubmit
        .querySelector("[data-report-count]")
        ?.getAttribute("data-report-count"),
    ).toBe("1");
    expect(
      mapAfterSubmit
        .querySelector("[data-preview-position]")
        ?.getAttribute("data-preview-position"),
    ).toBe("null");
  });

  it("allows impassable submission without a cause and can reopen cause choices", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (success: PositionCallback) =>
          success({
            coords: { latitude: 35.6812, longitude: 139.7671 },
          } as GeolocationPosition),
      },
    });
    render(<PostsPage />);
    fireEvent.click(screen.getByRole("button", { name: "テスト現在地を設定" }));
    fireEvent.click(
      screen.getByRole("button", { name: "この道の状況を報告する" }),
    );
    await waitFor(() => screen.getByRole("radio", { name: "通れない" }));

    fireEvent.click(screen.getByRole("radio", { name: "通れない" }));
    expect(
      (screen.getByRole("button", { name: "投稿する" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    fireEvent.click(screen.getByRole("radio", { name: "冠水" }));
    expect(screen.queryByRole("radio", { name: "冠水" })).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "通れないの原因一覧を開く" }),
    );
    expect(screen.getByRole("radio", { name: "冠水" })).toBeTruthy();
  });
});
