import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { StateMessage } from "./state-message";

afterEach(cleanup);

describe("StateMessage", () => {
  it("announces the state and keeps the symbol out of the reading order", () => {
    render(<StateMessage symbol="🗒" title="見出し" description="説明" />);

    const status = screen.getByRole("status");

    expect(status.textContent).toContain("見出し");
    expect(status.textContent).toContain("説明");
    expect(screen.getByText("🗒").getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps long text inside the column instead of widening the screen", () => {
    render(
      <StateMessage
        symbol="⚠"
        title={"あ".repeat(80)}
        description={"い".repeat(200)}
      />,
    );

    const heading = screen.getByRole("heading", { level: 2 });

    // 横幅を止めて折り返すことで、横スクロールが生えないようにしている
    expect(heading.className).toContain("max-w-[22rem]");
    expect(heading.className).toContain("break-words");
  });
});

describe("EmptyState", () => {
  it("tells the reader what to do next, not only that the list is empty", () => {
    render(<EmptyState />);

    expect(screen.getByText("まだこの地域の投稿がありません")).toBeTruthy();

    const action = screen.getByRole("link", { name: "いまの状況を投稿する" });
    expect(action.getAttribute("href")).toBe("/posts");
  });

  it("gives way to the caller's own next action when the screen already has one", () => {
    render(
      <EmptyState
        action={<button type="button">いまの状況を投稿する</button>}
      />,
    );

    // 既定のリンクを重ねて出さない
    expect(screen.queryByRole("link")).toBeNull();
    expect(
      screen.getByRole("button", { name: "いまの状況を投稿する" }),
    ).toBeTruthy();
  });

  it("can leave out the next action when the screen shows one elsewhere", () => {
    render(<EmptyState action={null} />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("can be reused for another list", () => {
    render(
      <EmptyState
        title="避難所の情報がありません"
        description="地域を選び直すと見つかることがあります。"
        actionHref="/evacuation"
        actionLabel="避難計画を開く"
      />,
    );

    expect(
      screen.getByRole("link", { name: "避難計画を開く" }).getAttribute("href"),
    ).toBe("/evacuation");
  });
});

describe("ErrorState", () => {
  it("is announced as an alert and does not guess the cause", () => {
    render(<ErrorState />);

    const alert = screen.getByRole("alert");

    expect(alert.textContent).toContain("情報を取得できませんでした");
    // 再試行の手段が無いときはボタンを出さない
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers a retry when the caller can retry", async () => {
    const { fireEvent } = await import("@testing-library/react");
    let retried = 0;

    render(
      <ErrorState
        onRetry={() => {
          retried += 1;
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "もう一度読み込む" }));

    expect(retried).toBe(1);
  });
});
