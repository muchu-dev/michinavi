import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
};

const { listUseQuery, mutateAsync } = vi.hoisted(() => ({
  listUseQuery: vi.fn<() => ReportListResult>(() => ({
    data: [],
    dataUpdatedAt: Date.now(),
    isError: false,
    isPending: false,
  })),
  mutateAsync: vi.fn(),
}));

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
    });

    render(<PostsPage />);

    expect(
      screen
        .getByRole("img", { name: "投稿地点の地図" })
        .querySelector("[data-report-count]")
        ?.getAttribute("data-report-count"),
    ).toBe("2");
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

  it("keeps readable foreground colours on each condition surface", () => {
    render(<PostsPage />);

    const cta = screen.getByRole("button", {
      name: "現在地を取得して投稿地点を確認",
    });
    // `bg-disabled` は globals.css に無いトークンで、Tailwind は CSS を出さない。
    // 無効時も有効時と同じブランド色のままだった
    expect(cta.className).not.toContain("bg-disabled");
    expect(cta.className).toContain("disabled:bg-muted");

    fireEvent.click(screen.getByRole("button", { name: "テスト現在地を設定" }));
    fireEvent.click(
      screen.getByRole("button", { name: "この道の状況を報告する" }),
    );

    // 黄色（--caution）に白文字はコントラスト比 2.02:1 で AA を満たさない
    const cautionSurface = screen
      .getByRole("radio", { name: "注意が必要" })
      .closest("div");
    expect(cautionSurface?.className).toContain("bg-caution");
    expect(cautionSurface?.className).toContain("text-caution-contrast");
    expect(cautionSurface?.className).not.toContain("text-white");

    // 濃い面は白文字のままでよい
    const impassableSurface = screen
      .getByRole("radio", { name: "通れない" })
      .closest("div");
    expect(impassableSurface?.className).toContain("bg-impassable");
    expect(impassableSurface?.className).toContain("text-white");
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
