import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OfflineBanner } from "./offline-banner";

function setOnline(isOnline: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    value: isOnline,
    configurable: true,
  });

  act(() => {
    window.dispatchEvent(new Event(isOnline ? "online" : "offline"));
  });
}

afterEach(() => {
  cleanup();
  setOnline(true);
});

describe("OfflineBanner", () => {
  it("stays out of the way while the connection works", () => {
    const { container } = render(<OfflineBanner />);

    expect(container.firstChild).toBeNull();
  });

  it("explains that the shown information may be stale while offline", () => {
    render(<OfflineBanner />);

    setOnline(false);

    expect(screen.getByRole("status").textContent).toContain(
      "通信が切れています",
    );
  });

  it("disappears again once the connection comes back", () => {
    render(<OfflineBanner />);

    setOnline(false);
    expect(screen.getByRole("status")).toBeTruthy();

    setOnline(true);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
