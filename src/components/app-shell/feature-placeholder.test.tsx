import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FeaturePlaceholder } from "./feature-placeholder";

afterEach(cleanup);

describe("FeaturePlaceholder", () => {
  it("explains the planned scope without presenting unfinished actions", () => {
    render(
      <FeaturePlaceholder
        eyebrow="Field reports"
        title="地域の状況を共有"
        description="説明文"
        plannedFeatures={["3タップ投稿", "写真の添付"]}
        taskIds="FE-09〜FE-13"
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "地域の状況を共有" }),
    ).toBeDefined();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/FE-09〜FE-13/)).toBeDefined();
  });
});
