import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { submitReport } from "@/lib/report/reported-reports";
import { ReportButton } from "./report-button";

vi.mock("@/lib/report/reported-reports", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/report/reported-reports")>();

  return { ...actual, submitReport: vi.fn(actual.submitReport) };
});

const mockedSubmitReport = vi.mocked(submitReport);

afterEach(() => {
  cleanup();
  window.localStorage.clear();
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

async function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "この投稿を通報する" }));

  return screen.findByRole("dialog");
}

describe("ReportButton", () => {
  it("offers the report entry point for a report that is not reported yet", () => {
    renderButton();

    expect(
      screen.getByRole("button", { name: "この投稿を通報する" }),
    ).toBeTruthy();
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

  it("sends the selected reason and then shows the report as sent", async () => {
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
    expect(mockedSubmitReport).toHaveBeenCalledWith({
      fieldReportId: "report-1",
      reason: "privacy",
      note: "表札が読める",
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not send an empty note", async () => {
    renderButton();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "通報を送る" }));

    await screen.findByText("通報済みです");
    expect(mockedSubmitReport).toHaveBeenCalledWith({
      fieldReportId: "report-1",
      reason: "false_info",
      note: undefined,
    });
  });

  it("keeps showing the report as sent after the screen is reopened", async () => {
    renderButton();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "通報を送る" }));
    await screen.findByText("通報済みです");

    cleanup();
    renderButton();

    expect(await screen.findByText("通報済みです")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "この投稿を通報する" }),
    ).toBeNull();
  });

  it("keeps the report open and explains the failure when sending fails", async () => {
    mockedSubmitReport.mockRejectedValueOnce(new Error("network down"));
    renderButton();
    await openDialog();

    fireEvent.click(screen.getByRole("button", { name: "通報を送る" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.queryByText("通報済みです")).toBeNull();
  });

  it("closes the dialog without sending when the user backs out", async () => {
    renderButton();
    await openDialog();

    fireEvent.click(screen.getByRole("button", { name: "やめる" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mockedSubmitReport).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "この投稿を通報する" }),
    ).toBeTruthy();
  });

  it("closes the dialog with the Escape key", async () => {
    renderButton();
    await openDialog();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mockedSubmitReport).not.toHaveBeenCalled();
  });
});
