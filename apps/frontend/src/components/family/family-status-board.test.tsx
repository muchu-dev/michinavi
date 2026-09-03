import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Member = {
  memberId: string;
  displayName: string;
  ageGroup: string;
  isSelf: boolean;
  hasAccount: boolean;
  status: string | null;
  needsHelp: boolean;
  message: string | null;
  statusUpdatedAt: string | null;
};

type MemberListResult = {
  data: Member[] | undefined;
  error: unknown;
  isError: boolean;
  isPending: boolean;
};

const { listUseQuery, mutateAsync, invalidate, setUseMutation } = vi.hoisted(
  () => ({
    listUseQuery: vi.fn<() => MemberListResult>(),
    mutateAsync: vi.fn(),
    invalidate: vi.fn(),
    setUseMutation: vi.fn(),
  }),
);

vi.mock("@/lib/trpc/client", () => ({
  api: {
    memberStatus: {
      listForHousehold: { useQuery: listUseQuery },
      set: { useMutation: setUseMutation },
    },
    useUtils: () => ({
      memberStatus: { listForHousehold: { invalidate } },
    }),
  },
}));

import { FamilyStatusBoard } from "./family-status-board";

function member(overrides: Partial<Member> = {}): Member {
  return {
    memberId: "member-self",
    displayName: "テスト太郎",
    ageGroup: "adult",
    isSelf: true,
    hasAccount: true,
    status: "safe_home",
    needsHelp: false,
    message: null,
    statusUpdatedAt: null,
    ...overrides,
  };
}

function mockList(overrides: Partial<MemberListResult> = {}) {
  listUseQuery.mockReturnValue({
    data: [],
    error: null,
    isError: false,
    isPending: false,
    ...overrides,
  });
}

beforeEach(() => {
  // 状態更新の mutation は、テストが明示しない限り待機中ではない
  setUseMutation.mockReturnValue({ mutateAsync, isPending: false });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FamilyStatusBoard", () => {
  it("shows a loading state while the household is being fetched", () => {
    mockList({ data: undefined, isPending: true });

    render(<FamilyStatusBoard />);

    expect(screen.getByText("家族の安否を読み込んでいます")).toBeDefined();
  });

  it("keeps the screen usable when the API fails", () => {
    mockList({ data: undefined, isError: true, error: new Error("boom") });

    render(<FamilyStatusBoard />);

    expect(screen.getByRole("alert").textContent).toContain(
      "家族の安否を取得できませんでした",
    );
  });

  it("explains a missing household instead of showing a generic failure", () => {
    mockList({
      data: undefined,
      isError: true,
      error: { data: { code: "NOT_FOUND" } },
    });

    render(<FamilyStatusBoard />);

    expect(screen.getByRole("alert").textContent).toContain(
      "世帯がまだ登録されていません",
    );
  });

  it("shows an empty state when the household has no members", () => {
    mockList({ data: [] });

    render(<FamilyStatusBoard />);

    expect(screen.getByText(/家族がまだ登録されていません/)).toBeDefined();
  });

  it("renders each member with the status returned by the API", () => {
    mockList({
      data: [
        member({
          memberId: "self",
          displayName: "母",
          status: "at_shelter",
          statusUpdatedAt: "2026-09-04T00:30:00.000Z",
        }),
        member({
          memberId: "father",
          displayName: "父",
          isSelf: false,
          hasAccount: true,
          status: "needs_help",
          needsHelp: true,
          message: "薬が切れそうです",
        }),
      ],
    });

    render(<FamilyStatusBoard />);

    const statusList = screen.getByRole("list", { name: "家族の避難状況" });
    const items = within(statusList).getAllByRole("listitem");

    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("母")).toBeDefined();
    expect(
      within(items[0]).getByRole("button", {
        name: "母の安否は避難済み。変更する",
      }),
    ).toBeDefined();
    expect(within(items[0]).getByText("09:30更新")).toBeDefined();
    expect(within(items[1]).getByText("父")).toBeDefined();
    expect(within(items[1]).getByText("支援が必要")).toBeDefined();
    expect(within(items[1]).getByText("薬が切れそうです")).toBeDefined();
  });

  it("falls back to 未確認 for members whose status is not shared", () => {
    mockList({ data: [member({ status: null })] });

    render(<FamilyStatusBoard />);

    expect(screen.getByRole("button", { name: /未確認/ })).toBeDefined();
  });

  it("does not offer status editing for family members who have their own account", () => {
    mockList({
      data: [member({ memberId: "sister", isSelf: false, hasAccount: true })],
    });

    render(<FamilyStatusBoard />);

    expect(screen.queryByRole("button", { name: /変更する/ })).toBeNull();
  });

  it("sends the chosen status and refreshes the list", async () => {
    mockList({ data: [member({ memberId: "self", displayName: "母" })] });
    mutateAsync.mockResolvedValue({});

    render(<FamilyStatusBoard />);

    fireEvent.click(
      screen.getByRole("button", { name: "母の安否は自宅で無事。変更する" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "避難済み" }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        memberId: "self",
        status: "at_shelter",
        needsHelp: false,
      });
    });
    expect(invalidate).toHaveBeenCalled();
  });

  it("reports needing help without losing the current status", async () => {
    mockList({
      data: [member({ memberId: "grandma", isSelf: false, hasAccount: false })],
    });
    mutateAsync.mockResolvedValue({});

    render(<FamilyStatusBoard />);

    fireEvent.click(screen.getByRole("button", { name: /変更する/ }));
    fireEvent.click(screen.getByRole("button", { name: "支援が必要と伝える" }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        memberId: "grandma",
        status: "safe_home",
        needsHelp: true,
      });
    });
  });

  it("shows an alert when the status update fails", async () => {
    mockList({ data: [member({ memberId: "self", displayName: "母" })] });
    mutateAsync.mockRejectedValue({ data: { code: "FORBIDDEN" } });

    render(<FamilyStatusBoard />);

    fireEvent.click(screen.getByRole("button", { name: /変更する/ }));
    fireEvent.click(screen.getByRole("button", { name: "避難中" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "この家族の安否は本人だけが登録できます。",
      );
    });
  });
});
