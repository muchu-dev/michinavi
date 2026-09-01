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
    selectedPosition,
  }: {
    onPositionChange?: (position: [number, number]) => void;
    reports?: unknown[];
    selectedPosition?: [number, number] | null;
  }) => (
    <div role="img" aria-label="投稿地点の地図">
      <span data-report-count={reports.length} />
      <span data-selected-position={JSON.stringify(selectedPosition)} />
      {onPositionChange ? (
        <button
          type="button"
          onClick={() => onPositionChange([35.6812, 139.7671])}
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
  it("keeps the existing report list API contract", () => {
    render(<PostsPage />);

    expect(listUseQuery).toHaveBeenCalledWith({ limit: 100 });
  });

  it("shows only reports in the current regional mesh", () => {
    listUseQuery.mockReturnValueOnce({
      data: [
        {
          id: "nearby",
          meshCode: "5339461132",
          roadCondition: "passable" as const,
          createdAt: new Date().toISOString(),
        },
        {
          id: "distant",
          meshCode: "5133756531",
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
    ).toBe("1");
  });

  it("previews the post position before opening a map-free form", () => {
    render(<PostsPage />);

    const reportButton = screen.getByRole("button", {
      name: "現在地を取得して投稿地点を確認",
    }) as HTMLButtonElement;
    expect(reportButton.disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "テスト現在地を設定" }));
    expect(
      screen
        .getByRole("img", { name: "投稿地点の地図" })
        .querySelector("[data-selected-position]")
        ?.getAttribute("data-selected-position"),
    ).toBe(JSON.stringify([35.6812, 139.7671]));

    fireEvent.click(
      screen.getByRole("button", { name: "この道の状況を報告する" }),
    );
    expect(screen.queryByRole("img", { name: "投稿地点の地図" })).toBeNull();
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

    expect(screen.getAllByRole("radio")).toHaveLength(9);
    expect(
      (screen.getByRole("button", { name: "投稿する" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
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
