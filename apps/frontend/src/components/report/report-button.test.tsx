import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MyFlag = { targetType: string; targetId: string };

const { createUseMutation, mineInvalidate, mineUseQuery, mutateAsync } =
  vi.hoisted(() => {
    const mutateAsync = vi.fn(async () => ({ id: "flag-1", status: "open" }));

    return {
      createUseMutation: vi.fn(() => ({ mutateAsync, isPending: false })),
      mineInvalidate: vi.fn(async () => undefined),
      mineUseQuery: vi.fn<() => { data: MyFlag[] | undefined }>(() => ({
        data: [],
      })),
      mutateAsync,
    };
  });

vi.mock("@/lib/trpc/client", () => ({
  api: {
    contentFlag: {
      create: { useMutation: createUseMutation },
      mine: { useQuery: mineUseQuery },
    },
    useUtils: () => ({ contentFlag: { mine: { invalidate: mineInvalidate } } }),
  },
}));

import { ReportButton } from "./report-button";

/** tRPC のクライアント側エラーは data.code に tRPC のコードを載せて返る */
function trpcError(code: string) {
  return Object.assign(new Error(code), { data: { code } });
}

beforeEach(() => {
  mineUseQuery.mockReturnValue({ data: [] });
  createUseMutation.mockReturnValue({ mutateAsync, isPending: false });
  mutateAsync.mockResolvedValue({ id: "flag-1", status: "open" });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderButton() {
  return render(
    <ReportButton
      fieldReportId="report-1"
      targetSummary="白川橋付近／通行不可の報告があります"
    />,
  );
}

function trigger() {
  return screen.getByRole("button", { name: "この投稿を通報する" });
}

async function openDialog() {
  fireEvent.click(trigger());

  return screen.findByRole("dialog");
}

describe("ReportButton", () => {
  it("offers the report entry point for a report that is not reported yet", () => {
    renderButton();

    expect(trigger()).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows what is being reported before asking for a reason", async () => {
    renderButton();
    const dialog = await openDialog();

    expect(
      screen.getByText("白川橋付近／通行不可の報告があります"),
    ).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByRole("radio", { name: /内容がちがう/ })).toBeTruthy();
  });

  it("sends the report to the server and only then shows it as sent", async () => {
    renderButton();
    await openDialog();

    fireEvent.click(
      screen.getByRole("radio", { name: /個人情報が写っている/ }),
    );
    fireEvent.change(screen.getByLabelText("補足（任意）"), {
      target: { value: "  表札が読める  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "通報を送る" }));

    expect(await screen.findByText("通報済みです")).toBeTruthy();
    expect(mutateAsync).toHaveBeenCalledWith({
      targetType: "field_report",
      targetId: "report-1",
      reason: "privacy",
      detail: "表札が読める",
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("refetches the reports the user has flagged after a successful send", async () => {
    renderButton();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "通報を送る" }));

    await screen.findByText("通報済みです");
    await waitFor(() => expect(mineInvalidate).toHaveBeenCalled());
  });

  it("does not send an empty note", async () => {
    renderButton();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "通報を送る" }));

    await screen.findByText("通報済みです");
    expect(mutateAsync).toHaveBeenCalledWith({
      targetType: "field_report",
      targetId: "report-1",
      reason: "false_info",
      detail: undefined,
    });
  });

  it("shows the report as sent when the server already knows about it", () => {
    mineUseQuery.mockReturnValue({
      data: [{ targetType: "field_report", targetId: "report-1" }],
    });
    renderButton();

    expect(screen.getByText("通報済みです")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "この投稿を通報する" }),
    ).toBeNull();
  });

  it("still offers the entry point when another report was flagged", () => {
    mineUseQuery.mockReturnValue({
      data: [{ targetType: "field_report", targetId: "report-2" }],
    });
    renderButton();

    expect(trigger()).toBeTruthy();
  });

  it("keeps the dialog open and explains the failure without claiming the report was sent", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("network down"));
    renderButton();
    await openDialog();

    fireEvent.click(screen.getByRole("button", { name: "通報を送る" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "通信の状態",
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.queryByText("通報済みです")).toBeNull();
    expect(mineInvalidate).not.toHaveBeenCalled();
  });

  it("tells a signed-out user to sign in instead of showing the report as sent", async () => {
    mutateAsync.mockRejectedValueOnce(trpcError("UNAUTHORIZED"));
    renderButton();
    await openDialog();

    fireEvent.click(screen.getByRole("button", { name: "通報を送る" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "ログイン",
    );
    expect(screen.queryByText("通報済みです")).toBeNull();
  });

  it("treats the server's conflict as a report that already reached the operators", async () => {
    mutateAsync.mockRejectedValueOnce(trpcError("CONFLICT"));
    renderButton();
    await openDialog();

    fireEvent.click(screen.getByRole("button", { name: "通報を送る" }));

    expect(await screen.findByText("通報済みです")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears an earlier failure when the dialog is opened again", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("network down"));
    renderButton();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "通報を送る" }));
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "やめる" }));
    await openDialog();

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("disables the send button while the report is on its way", async () => {
    createUseMutation.mockReturnValue({ mutateAsync, isPending: true });
    renderButton();
    await openDialog();

    const send = screen.getByRole("button", { name: "送信中…" });
    expect(send.hasAttribute("disabled")).toBe(true);
  });

  it("closes the dialog without sending when the user backs out", async () => {
    renderButton();
    await openDialog();

    fireEvent.click(screen.getByRole("button", { name: "やめる" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(trigger()).toBeTruthy();
  });

  it("closes the dialog with the Escape key", async () => {
    renderButton();
    await openDialog();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});

describe("ReportButton のキーボード操作", () => {
  /** ダイアログの中で Tab が止まる場所。ラジオは選ばれている 1 つだけ */
  function tabStops() {
    return [
      screen.getByRole("radio", { checked: true }),
      screen.getByLabelText("補足（任意）"),
      screen.getByRole("button", { name: "やめる" }),
      screen.getByRole("button", { name: "通報を送る" }),
    ];
  }

  it("moves focus into the dialog when it opens", async () => {
    renderButton();
    await openDialog();

    expect(document.activeElement).toBe(
      screen.getByRole("radio", { name: /内容がちがう/ }),
    );
  });

  it("wraps from the last control back to the first instead of leaving the dialog", async () => {
    renderButton();
    await openDialog();
    const stops = tabStops();
    stops[stops.length - 1].focus();

    const notPrevented = fireEvent.keyDown(document, { key: "Tab" });

    expect(notPrevented).toBe(false);
    expect(document.activeElement).toBe(stops[0]);
  });

  it("wraps backwards from the first control to the last", async () => {
    renderButton();
    await openDialog();
    const stops = tabStops();
    stops[0].focus();

    const notPrevented = fireEvent.keyDown(document, {
      key: "Tab",
      shiftKey: true,
    });

    expect(notPrevented).toBe(false);
    expect(document.activeElement).toBe(stops[stops.length - 1]);
  });

  it("counts a radio group as one stop, so the selected reason is the first one", async () => {
    renderButton();
    await openDialog();
    const selected = screen.getByRole("radio", { name: /宣伝や無関係な内容/ });
    fireEvent.click(selected);
    selected.focus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "通報を送る" }),
    );
  });

  it("leaves the browser to move focus between controls in the middle", async () => {
    renderButton();
    await openDialog();
    const note = screen.getByLabelText("補足（任意）");
    note.focus();

    const notPrevented = fireEvent.keyDown(document, { key: "Tab" });

    expect(notPrevented).toBe(true);
    expect(document.activeElement).toBe(note);
  });

  it("returns focus to the report button after Escape", async () => {
    renderButton();
    await openDialog();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(document.activeElement).toBe(trigger()));
  });

  it("returns focus to the report button after backing out", async () => {
    renderButton();
    await openDialog();

    fireEvent.click(screen.getByRole("button", { name: "やめる" }));

    await waitFor(() => expect(document.activeElement).toBe(trigger()));
  });

  it("moves focus to the sent notice when the report goes through", async () => {
    renderButton();
    await openDialog();

    fireEvent.click(screen.getByRole("button", { name: "通報を送る" }));

    const notice = await screen.findByText("通報済みです");
    await waitFor(() => expect(document.activeElement).toBe(notice));
  });
});
