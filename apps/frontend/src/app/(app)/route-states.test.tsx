import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NotFound from "../not-found";
import AppSegmentError from "./error";
import AppSegmentLoading from "./loading";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("route level states (FE-20)", () => {
  it("shows a retry that re-fetches the segment when rendering fails", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();

    render(<AppSegmentError error={new Error("boom")} retry={retry} />);

    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "もう一度読み込む" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("records the error so it is not lost silently", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("boom");

    render(<AppSegmentError error={error} retry={() => {}} />);

    expect(logged).toHaveBeenCalledWith(error);
  });

  it("says that loading is still in progress", () => {
    render(<AppSegmentLoading />);

    expect(screen.getByRole("status").textContent).toContain(
      "読み込んでいます",
    );
  });

  it("offers a way back to the map from an unknown screen", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("link", { name: "地図に戻る" }).getAttribute("href"),
    ).toBe("/");
  });
});
