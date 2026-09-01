"use client";

import { useState } from "react";
import { RoutePanel } from "./_components/route-panel";
import { ShelterPanel } from "./_components/shelter-panel";

type EvacuationTab = "route" | "shelter";

// 避難計画画面全体で、選択中のタブと共通ヘッダーの色を同期する。
export default function EvacuationPage() {
  const [selectedTab, setSelectedTab] = useState<EvacuationTab>("route");

  return (
    <section
      className="flex min-h-0 flex-1 flex-col bg-app-surface"
      aria-labelledby="evacuation-title"
      data-app-header-tone={selectedTab === "route" ? "caution" : "brand"}
    >
      <h1 id="evacuation-title" className="sr-only">
        避難計画
      </h1>

      {/* 2つのボタンを単純な表示切り替えとして扱い、選択状態を色とaria-pressedで示す。 */}
      <div
        className={`grid min-h-14 grid-cols-2 text-sm font-black ${
          selectedTab === "route" ? "bg-caution" : "bg-brand"
        }`}
      >
        <button
          type="button"
          aria-pressed={selectedTab === "route"}
          onClick={() => setSelectedTab("route")}
          className={`bg-caution px-4 text-ink focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-ink ${
            selectedTab === "shelter" ? "rounded-tr-2xl" : ""
          }`}
        >
          避難経路
        </button>

        <button
          type="button"
          aria-pressed={selectedTab === "shelter"}
          onClick={() => setSelectedTab("shelter")}
          className={`bg-brand px-4 text-white focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white ${
            selectedTab === "route" ? "rounded-tl-2xl" : ""
          }`}
        >
          避難所
        </button>
      </div>

      {/* 選択された機能だけを描画し、各パネル内の状態を互いに分離する。 */}
      <div className="flex min-h-0 flex-1 flex-col">
        {selectedTab === "route" ? <RoutePanel /> : <ShelterPanel />}
      </div>
    </section>
  );
}
