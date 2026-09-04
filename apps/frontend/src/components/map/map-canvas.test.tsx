import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getZoom, invalidateSize, mapInstance, setView } = vi.hoisted(() => {
  const setView = vi.fn();
  const getZoom = vi.fn(() => 13);
  const invalidateSize = vi.fn();
  return {
    getZoom,
    invalidateSize,
    mapInstance: { getZoom, invalidateSize, setView },
    setView,
  };
});

const createDivIcon = vi.hoisted(() => vi.fn((options: unknown) => options));

vi.mock("leaflet", () => ({
  divIcon: createDivIcon,
}));

vi.mock("react-leaflet", () => ({
  CircleMarker: ({ children }: PropsWithChildren) => (
    <div data-testid="map-marker">{children}</div>
  ),
  MapContainer: ({
    children,
    className,
  }: PropsWithChildren<{ className?: string }>) => (
    <div className={className} data-testid="leaflet-map">
      {children}
    </div>
  ),
  Marker: ({
    children,
    icon,
    position,
  }: PropsWithChildren<{ icon?: { html?: string }; position?: unknown }>) => (
    <div
      data-icon-html={icon?.html}
      data-position={JSON.stringify(position)}
      data-testid="report-marker"
    >
      {children}
    </div>
  ),
  // 経路を描く実装が入ったらこの testid で拾えるようにしておく。
  // モックに無いままだと queryAllByTestId("map-route") が常に0件になり、
  // 「経路を描かない」という検証が空振りする
  Polyline: ({ children }: PropsWithChildren) => (
    <div data-testid="map-route">{children}</div>
  ),
  Popup: ({ children }: PropsWithChildren) => <div>{children}</div>,
  TileLayer: ({ attribution, url }: { attribution: string; url: string }) => (
    <div
      data-attribution={attribution}
      data-testid="map-tiles"
      data-url={url}
    />
  ),
  useMap: () => mapInstance,
}));

// ReportButton がぶら下がるので、通報の API を差し替える。
// 通報そのものの検証は components/report/report-button.test.tsx で行う
vi.mock("@/lib/trpc/client", () => ({
  api: {
    contentFlag: {
      create: {
        useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
      },
      mine: { useQuery: () => ({ data: [] }) },
    },
    useUtils: () => ({ contentFlag: { mine: { invalidate: vi.fn() } } }),
  },
}));

import { MapCanvas } from "./map-canvas";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setView.mockClear();
  getZoom.mockClear();
  invalidateSize.mockClear();
});

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(
    new Date("2026-08-29T02:00:00.000Z").getTime(),
  );
});

describe("MapCanvas", () => {
  it("configures a Leaflet map with attributed OpenStreetMap tiles", () => {
    render(<MapCanvas />);

    expect(screen.getByTestId("leaflet-map")).toBeTruthy();
    expect(screen.getByTestId("map-tiles").getAttribute("data-url")).toContain(
      "tile.openstreetmap.org",
    );
    expect(
      screen.getByTestId("map-tiles").getAttribute("data-attribution"),
    ).toContain("OpenStreetMap");
  });

  it("uses the compact map height without clipping map controls", () => {
    render(<MapCanvas compact />);

    expect(screen.getByTestId("leaflet-map").className).toContain("min-h-full");
    expect(screen.getByTestId("map-tiles")).toBeTruthy();
  });

  it("remeasures a map when its preserved panel becomes visible", () => {
    const view = render(<MapCanvas isVisible={false} />);

    expect(invalidateSize).not.toHaveBeenCalled();
    view.rerender(<MapCanvas isVisible />);

    expect(invalidateSize).toHaveBeenCalledWith({
      animate: false,
      pan: false,
    });
    expect(setView).not.toHaveBeenCalled();
    expect(getZoom).not.toHaveBeenCalled();
  });

  it("renders recent report markers and popup details from API data", () => {
    render(
      <MapCanvas
        reports={[
          {
            id: "report-1",
            meshCode: "5133756531",
            roadCondition: "impassable",
            createdAt: "2026-08-29T00:00:00.000Z",
          },
          {
            id: "report-2",
            meshCode: "5133756531",
            roadCondition: "caution",
            createdAt: "2026-08-28T23:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getAllByTestId("report-marker")).toHaveLength(1);
    // 追跡を始めていない間は現在地のピンを出さない（"現在地（デモ）" という
    // 実装に無い文言を queryByText していたため、これまで空振りしていた）
    expect(screen.queryAllByTestId("map-marker")).toHaveLength(0);
    expect(screen.queryByText("現在地")).toBeNull();
    expect(screen.getByText("2件の投稿")).toBeTruthy();
    expect(screen.getByText("通行不可")).toBeTruthy();
    expect(screen.getByText("注意")).toBeTruthy();
    // 確認投票のような未実装の操作を紛れ込ませない。
    // 地図の上に出るボタンは現在地の追跡だけ
    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual(["現在地を追跡"]);
  });

  it("ignores expired reports and invalid mesh codes", () => {
    render(
      <MapCanvas
        reports={[
          {
            id: "expired",
            meshCode: "5133756531",
            roadCondition: "caution",
            createdAt: "2026-08-28T19:59:59.000Z",
          },
          {
            id: "invalid",
            meshCode: "5133889911",
            roadCondition: "impassable",
            createdAt: "2026-08-29T01:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.queryAllByTestId("report-marker")).toHaveLength(0);
  });

  it("previews the post bubble at the center of its saved mesh", () => {
    render(<MapCanvas previewPosition={[35.6812, 139.7671]} />);

    const preview = screen.getByTestId("report-marker");
    expect(preview.getAttribute("data-position")).toBe(
      JSON.stringify([35.68020833333334, 139.7671875]),
    );
    expect(preview.getAttribute("data-icon-html")).toContain("var(--brand)");
    expect(setView).toHaveBeenCalledWith([35.68020833333334, 139.7671875], 13);
    expect(screen.getByText("投稿後の吹き出し表示位置")).toBeTruthy();
    expect(screen.queryAllByTestId("map-marker")).toHaveLength(0);
  });

  it("merges the preview into an existing bubble in the same mesh", () => {
    render(
      <MapCanvas
        reports={[
          {
            id: "existing",
            meshCode: "5339461132",
            roadCondition: "caution",
            createdAt: "2026-08-29T01:00:00.000Z",
          },
        ]}
        previewPosition={[35.6812, 139.7671]}
      />,
    );

    expect(screen.getAllByTestId("report-marker")).toHaveLength(1);
    expect(
      screen.getByTestId("report-marker").getAttribute("data-icon-html"),
    ).toContain(">2</text>");
  });

  it("starts tracking on user action and renders the acquired current position", async () => {
    const onPositionChange = vi.fn();
    const watchPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 35.6812, longitude: 139.7671 },
      } as GeolocationPosition);
      return 1;
    });
    vi.stubGlobal("navigator", {
      geolocation: { watchPosition, clearWatch: vi.fn() },
    });

    render(<MapCanvas onPositionChange={onPositionChange} />);
    expect(watchPosition).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "現在地を追跡" }));

    expect(watchPosition).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.getByText("現在地")).toBeTruthy();
    });
    expect(screen.getAllByTestId("map-marker")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toBe(
      "現在地を追跡しています",
    );
    expect(setView).toHaveBeenCalledWith([35.6812, 139.7671], 13);
    expect(onPositionChange).toHaveBeenCalledWith([35.6812, 139.7671]);
  });

  it("automatically tracks location when permission is already granted", async () => {
    const watchPosition = vi.fn(() => 2);
    vi.stubGlobal("navigator", {
      geolocation: { watchPosition, clearWatch: vi.fn() },
      permissions: {
        query: vi.fn().mockResolvedValue({
          state: "granted",
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
      },
    });

    render(<MapCanvas />);

    await waitFor(() => expect(watchPosition).toHaveBeenCalledOnce());
  });

  it("clears the location watcher when leaving the map", () => {
    const clearWatch = vi.fn();
    const watchPosition = vi.fn(() => 7);
    vi.stubGlobal("navigator", {
      geolocation: { watchPosition, clearWatch },
    });

    const view = render(<MapCanvas />);
    fireEvent.click(screen.getByRole("button", { name: "現在地を追跡" }));
    view.unmount();

    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it("releases a watcher that fails after registration", async () => {
    const clearWatch = vi.fn();
    let watchId = 0;
    // オブジェクト越しに持つのは、コールバック内での代入を TypeScript が
    // 型の絞り込みに使ってしまい、あとから呼べなくなるため
    const captured: { reportError?: PositionErrorCallback } = {};
    const watchPosition = vi.fn(
      (_success: PositionCallback, error: PositionErrorCallback) => {
        captured.reportError = error;
        watchId += 1;
        return watchId;
      },
    );
    vi.stubGlobal("navigator", {
      geolocation: { watchPosition, clearWatch },
    });

    render(<MapCanvas />);
    fireEvent.click(screen.getByRole("button", { name: "現在地を追跡" }));
    expect(watchPosition).toHaveBeenCalledOnce();

    // 測位できない場所では登録のあとから TIMEOUT が返るが、watchPosition の
    // 監視自体は止まらない。ID を捨てるだけだと解放されない監視が残る
    captured.reportError?.({
      code: 3,
      PERMISSION_DENIED: 1,
    } as GeolocationPositionError);

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(
        "現在地を取得できませんでした。もう一度お試しください",
      );
    });
    expect(clearWatch).toHaveBeenCalledWith(1);

    // 解放できていれば、もう一度押したときに監視を張り直せる
    fireEvent.click(screen.getByRole("button", { name: "現在地を追跡" }));
    expect(watchPosition).toHaveBeenCalledTimes(2);
  });

  it("does not start a watcher when the permission query settles after unmount", async () => {
    const watchPosition = vi.fn(() => 9);
    const addEventListener = vi.fn();
    const pending: { resolveQuery?: (status: unknown) => void } = {};
    vi.stubGlobal("navigator", {
      geolocation: { watchPosition, clearWatch: vi.fn() },
      permissions: {
        query: vi.fn(
          () =>
            new Promise((resolve) => {
              pending.resolveQuery = resolve;
            }),
        ),
      },
    });

    const view = render(<MapCanvas />);
    view.unmount();

    pending.resolveQuery?.({
      state: "granted",
      addEventListener,
      removeEventListener: vi.fn(),
    });
    await Promise.resolve();
    await Promise.resolve();

    // アンマウント後に張った監視と購読は、後片付けが済んでいるので誰も解放できない
    expect(watchPosition).not.toHaveBeenCalled();
    expect(addEventListener).not.toHaveBeenCalled();
  });

  it("does not request or draw misleading routes to reports", async () => {
    const watchPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 35.6812, longitude: 139.7671 },
      } as GeolocationPosition);
      return 4;
    });
    vi.stubGlobal("navigator", {
      geolocation: { watchPosition, clearWatch: vi.fn() },
    });
    const fetchRoute = vi.fn();
    vi.stubGlobal("fetch", fetchRoute);

    render(
      <MapCanvas
        reports={[
          {
            id: "passable",
            meshCode: "5133756531",
            roadCondition: "passable",
            createdAt: "2026-08-29T00:00:00.000Z",
          },
          {
            id: "caution",
            meshCode: "5133756532",
            roadCondition: "caution",
            createdAt: "2026-08-29T00:00:00.000Z",
          },
          {
            id: "impassable",
            meshCode: "5133756533",
            roadCondition: "impassable",
            createdAt: "2026-08-29T00:00:00.000Z",
          },
          {
            id: "recovered-passable",
            meshCode: "5133756541",
            roadCondition: "passable",
            createdAt: "2026-08-29T01:00:00.000Z",
          },
          {
            id: "previously-impassable",
            meshCode: "5133756541",
            roadCondition: "impassable",
            createdAt: "2026-08-28T23:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.queryAllByTestId("map-route")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "現在地を追跡" }));

    expect(fetchRoute).not.toHaveBeenCalled();
    expect(screen.queryAllByTestId("map-route")).toHaveLength(0);
  });

  it("shows guidance when location permission is denied", async () => {
    const clearWatch = vi.fn();
    const watchPosition = vi.fn(
      (_success: PositionCallback, error: PositionErrorCallback) => {
        error({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
        return 3;
      },
    );
    vi.stubGlobal("navigator", {
      geolocation: { watchPosition, clearWatch },
    });

    render(<MapCanvas />);
    fireEvent.click(screen.getByRole("button", { name: "現在地を追跡" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(
        "位置情報の利用が許可されませんでした",
      );
    });
    expect(screen.queryAllByTestId("map-marker")).toHaveLength(0);
    expect(clearWatch).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByRole("button", { name: "現在地を追跡" }));
    expect(watchPosition).toHaveBeenCalledTimes(2);
    expect(clearWatch).toHaveBeenCalledTimes(2);
  });

  it("renders a location supplied by an evacuation screen without its own control", () => {
    const view = render(
      <MapCanvas
        currentLocation={{ latitude: 34.6383, longitude: 133.6903 }}
        locationLabel="デモ位置（真備町箭田）"
        showLocationControl={false}
      />,
    );

    expect(screen.getByText("デモ位置（真備町箭田）")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "現在地を追跡" })).toBeNull();
    expect(screen.getAllByTestId("map-marker")).toHaveLength(1);
    expect(setView).toHaveBeenLastCalledWith([34.6383, 133.6903], 13);

    setView.mockClear();
    view.rerender(
      <MapCanvas
        currentLocation={{ latitude: 34.6383, longitude: 133.6903 }}
        locationLabel="デモ位置（真備町箭田）"
        showLocationControl={false}
      />,
    );
    expect(setView).not.toHaveBeenCalled();

    view.rerender(
      <MapCanvas
        currentLocation={{ latitude: 34.639, longitude: 133.691 }}
        locationLabel="更新後の現在地"
        showLocationControl={false}
      />,
    );
    expect(setView).toHaveBeenCalledWith([34.639, 133.691], 13);
  });

  it("shows the current-location control by default", () => {
    render(<MapCanvas />);

    expect(screen.getByRole("button", { name: "現在地を追跡" })).toBeTruthy();
  });

  it("keeps the location control usable with gloves and without zooming (FE-19)", () => {
    render(<MapCanvas />);

    // .tap-target は globals.css で --tap-min（44px）を最小の一辺にする
    const trackButton = screen.getByRole("button", { name: "現在地を追跡" });
    expect(trackButton.className).toContain("tap-target");
    expect(trackButton.className).toContain("text-sm");
    expect(screen.getByRole("status").className).toContain("text-sm");
  });

  it("prints the report count on a pin at a readable size (FE-19)", () => {
    render(
      <MapCanvas
        reports={[
          {
            id: "report-1",
            meshCode: "5133756531",
            roadCondition: "passable",
            createdAt: "2026-08-29T00:00:00.000Z",
          },
        ]}
      />,
    );

    // 52px 表示のまま font-size 10 だと実寸 8px になるので、原寸で描く
    const icon =
      screen.getByTestId("report-marker").getAttribute("data-icon-html") ?? "";
    expect(icon).toContain('viewBox="0 0 64 64" width="64" height="64"');
    expect(icon).toContain('font-size="14"');
  });

  it("exposes the report entry point on each report in the popup (FE-18)", () => {
    render(
      <MapCanvas
        reports={[
          {
            id: "report-1",
            meshCode: "5133756531",
            roadCondition: "impassable",
            createdAt: "2026-08-29T00:00:00.000Z",
          },
          {
            id: "report-2",
            meshCode: "5133756531",
            roadCondition: "caution",
            createdAt: "2026-08-28T23:00:00.000Z",
          },
        ]}
      />,
    );

    // 通報は、投稿の中身が見えている場所からしか押せないようにしている。
    // 1 件ごとに導線を出すので、まとまった 2 件ぶんのボタンが並ぶ
    expect(
      screen.getAllByRole("button", { name: "この投稿を通報する" }),
    ).toHaveLength(2);
  });
});
