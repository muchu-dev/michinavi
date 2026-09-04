import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const nearbyShelters = ["第一避難所", "第二避難所", "第三避難所"].map(
  (name, index) => ({
    id: `shelter-${index}`,
    name,
    latitude: 43.69 + index * 0.001,
    longitude: 142.51 + index * 0.001,
    distanceM: 1000 + index * 500,
    acceptances: [],
  }),
);

const shelterDetail = {
  id: "shelter-0",
  externalCode: "demo-001",
  name: "第一避難所",
  nameKana: "ダイイチヒナンジョ",
  address: "岡山県倉敷市真備町箭田123",
  areaId: null,
  category: "designated_shelter" as const,
  capacity: 250,
  floors: 2,
  elevationM: 12.5,
  operator: "倉敷市",
  phone: "086-000-0000",
  source: "倉敷市オープンデータ",
  sourceUpdatedAt: "2026-08-01",
  isActive: true,
  acceptances: [
    {
      key: "pet",
      label: "ペット同行",
      status: "limited",
      note: "ケージ必須",
      confirmedAt: null,
    },
  ],
  hazardSupports: [{ hazardType: "flood", isSupported: true, note: null }],
};

vi.mock("@/components/map/map-view", () => ({
  MapView: () => <section aria-label="地図" />,
}));

vi.mock("@/lib/trpc/client", () => ({
  api: {
    shelter: {
      nearby: {
        useQuery: (_input: unknown, options: { enabled: boolean }) => ({
          data: options.enabled ? nearbyShelters : undefined,
          error: null,
          isLoading: false,
          isFetching: false,
        }),
      },
      byId: {
        useQuery: (input: { id: string }, options: { enabled: boolean }) => ({
          data:
            options.enabled && input.id === shelterDetail.id
              ? shelterDetail
              : undefined,
          error: null,
          isLoading: false,
        }),
      },
    },
  },
}));

import { ShelterPanel } from "./shelter-panel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ShelterPanel", () => {
  it("provides at least 44px tap targets for location controls", () => {
    render(<ShelterPanel />);

    expect(
      screen.getByRole("button", { name: "デモ位置" }).className,
    ).toContain("min-h-11");
    expect(
      screen.getByRole("button", { name: "近隣の避難所を更新" }).className,
    ).toContain("min-h-11");
  });

  it("shows seeded shelters from the explicitly labelled demo location", () => {
    render(<ShelterPanel />);

    fireEvent.click(screen.getByRole("button", { name: "デモ位置" }));

    expect(screen.getByText("デモ位置：岡山県倉敷市真備町箭田")).toBeTruthy();
    for (const shelter of nearbyShelters) {
      expect(screen.getByText(shelter.name)).toBeTruthy();
    }
  });

  it("shows all shelters after obtaining the actual location without OSRM", () => {
    const externalFetch = vi.fn();
    vi.stubGlobal("fetch", externalFetch);
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (success: PositionCallback) =>
          success({
            coords: { latitude: 43.7, longitude: 142.5 },
          } as GeolocationPosition),
      },
    });

    render(<ShelterPanel />);
    fireEvent.click(screen.getByRole("button", { name: "近隣の避難所を更新" }));

    for (const shelter of nearbyShelters) {
      expect(screen.getByText(shelter.name)).toBeTruthy();
    }
    expect(externalFetch).not.toHaveBeenCalled();
  });

  it("provides at least a 44px tap target for returning to the list", () => {
    render(<ShelterPanel />);
    fireEvent.click(screen.getByRole("button", { name: "デモ位置" }));
    fireEvent.click(
      screen.getByRole("button", { name: "第一避難所の詳細を表示" }),
    );

    expect(
      screen.getByRole("button", { name: "一覧へ戻る" }).className,
    ).toContain("min-h-11");
  });

  it("shows the selected shelter's main details", () => {
    render(<ShelterPanel />);
    fireEvent.click(screen.getByRole("button", { name: "デモ位置" }));
    fireEvent.click(
      screen.getByRole("button", { name: "第一避難所の詳細を表示" }),
    );

    expect(screen.getByText("指定避難所")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "第一避難所" })).toBeTruthy();
    expect(screen.getByText("ダイイチヒナンジョ")).toBeTruthy();
    expect(screen.getByText("岡山県倉敷市真備町箭田123")).toBeTruthy();
    expect(screen.getByText("250人")).toBeTruthy();
    expect(screen.getByText("2階")).toBeTruthy();
    expect(screen.getByText("12.5m")).toBeTruthy();
    expect(screen.getByText("ペット同行（ケージ必須）")).toBeTruthy();
    expect(screen.getByText("条件付き")).toBeTruthy();
    expect(screen.getByText("洪水 対応")).toBeTruthy();
    expect(screen.getByText("倉敷市")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "086-000-0000" }).getAttribute("href"),
    ).toBe("tel:086-000-0000");
    expect(screen.getByText("倉敷市オープンデータ")).toBeTruthy();
  });
});
