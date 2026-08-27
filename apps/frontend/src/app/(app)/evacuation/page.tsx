"use client";

import { useEffect, useState } from "react";
import { PageRoute } from "./page_route";
import { PageShelter } from "./page_shelter";

type EvacuationTab = "route" | "shelter";

// 避難経路画面と避難所画面の切り替え
export default function EvacuationPage() {
  const [selectedTab, setSelectedTab] = useState<EvacuationTab>("route");

  // 選択中のタブに合わせて共通ヘッダーの背景色を変更
  useEffect(() => {
    const appHeader = document.getElementById("main-content")
      ?.previousElementSibling;

    if (!(appHeader instanceof HTMLElement)) return;

    const originalBackgroundColor = appHeader.style.backgroundColor;
    appHeader.style.backgroundColor =
      selectedTab === "route" ? "#f0a92e" : "#597ebf";

    return () => {
      appHeader.style.backgroundColor = originalBackgroundColor;
    };
  }, [selectedTab]);

  return (
    <section
      className="flex min-h-0 flex-1 flex-col bg-app-surface"
      aria-labelledby="evacuation-title"
    >
      <h1 id="evacuation-title" className="sr-only">
        避難計画
      </h1>

      <div
        className={`grid min-h-14 grid-cols-2 text-sm font-black ${
          selectedTab === "route" ? "bg-[#f0a92e]" : "bg-[#597ebf]"
        }`}
        role="tablist"
        aria-label="避難情報の表示切り替え"
      >
        <button
          type="button"
          role="tab"
          id="evacuation-route-tab"
          aria-selected={selectedTab === "route"}
          aria-controls="evacuation-content"
          onClick={() => setSelectedTab("route")}
          className={`bg-[#f0a92e] px-4 text-ink ${
            selectedTab === "shelter" ? "rounded-tr-2xl" : ""
          }`}
        >
          避難経路
        </button>

        <button
          type="button"
          role="tab"
          id="evacuation-shelter-tab"
          aria-selected={selectedTab === "shelter"}
          aria-controls="evacuation-content"
          onClick={() => setSelectedTab("shelter")}
          className={`bg-[#597ebf] px-4 text-ink ${
            selectedTab === "route" ? "rounded-tl-2xl" : ""
          }`}
        >
          避難所
        </button>
      </div>

      <div
        id="evacuation-content"
        role="tabpanel"
        aria-labelledby={
          selectedTab === "route"
            ? "evacuation-route-tab"
            : "evacuation-shelter-tab"
        }
        className="flex min-h-0 flex-1 flex-col"
      >
        {selectedTab === "route" ? <PageRoute /> : <PageShelter />}
      </div>
    </section>
  );
}
