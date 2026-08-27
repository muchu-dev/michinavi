"use client";

import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { MapView } from "@/components/map/map-view";

// 道路の通行状態を表す画面内の選択値
type RoadCondition = "passable" | "caution" | "blocked";
// 注意・通行不可の原因として選択できる状態種別
type HazardType =
  | "flood"
  | "landslide"
  | "collapse"
  | "congestion"
  | "restriction"
  | "other";
// 冠水時に選択する水深の区分
type WaterDepth = "under-ankle" | "ankle-to-knee" | "over-knee";

// 状態選択欄に表示する原因の一覧
const hazards: ReadonlyArray<{ type: HazardType; label: string }> = [
  { type: "flood", label: "冠水" },
  { type: "landslide", label: "土砂・崩落" },
  { type: "collapse", label: "倒木・倒壊" },
  { type: "congestion", label: "渋滞" },
  { type: "restriction", label: "交通規制" },
  { type: "other", label: "その他" },
];

// 水深選択欄に表示する3段階の一覧
const waterDepths: ReadonlyArray<{
  value: WaterDepth;
  label: string;
  detail: string;
}> = [
  { value: "under-ankle", label: "くるぶし未満", detail: "〜10cm" },
  { value: "ankle-to-knee", label: "くるぶし〜ひざ", detail: "10〜50cm" },
  { value: "over-knee", label: "ひざ以上", detail: "50cm〜" },
];

// ページ：投稿地図と道路状況入力を切り替えて表示できる
export default function PostsPage() {
  const [view, setView] = useState<"map" | "report">("map");
  const [condition, setCondition] = useState<RoadCondition | null>(null);
  const [expanded, setExpanded] = useState<"caution" | "blocked" | null>(null);
  const [hazard, setHazard] = useState<HazardType | null>(null);
  const [waterDepth, setWaterDepth] = useState<WaterDepth | null>(null);
  const [showBody, setShowBody] = useState(false);
  const [body, setBody] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const appHeader =
      document.getElementById("main-content")?.previousElementSibling;
    if (!(appHeader instanceof HTMLElement)) return;
    const originalDisplay = appHeader.style.display;
    appHeader.style.display = view === "report" ? "none" : originalDisplay;
    return () => {
      appHeader.style.display = originalDisplay;
    };
  }, [view]);

  const chooseCondition = (next: RoadCondition) => {
    setSubmitted(false);
    if (next === "passable") {
      setCondition("passable");
      setExpanded(null);
      setHazard(null);
      return;
    }
    setExpanded((current) => (current === next ? null : next));
    setCondition(null);
    setHazard(null);
  };

  // 注意・通行不可の原因アイコンを選択する関数
  const chooseHazard = (type: HazardType) => {
    if (!expanded) return;
    setCondition(expanded);
    setHazard(type);
    setSubmitted(false);
  };

  // 現在の選択内容で投稿可能かを判定する値
  const canSubmit =
    condition === "passable" ||
    (condition === "caution" && hazard !== null && waterDepth !== null) ||
    (condition === "blocked" && hazard !== null && waterDepth !== null);

  // 投稿ボタン押下時に入力を検証し、完了後に地図へ戻す関数
  const submitReport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    // 現在はDB保存も写真アップロードも行わず、画面状態だけを初期化する。
    // TODO: field_reports 作成APIとStorage連携の完成後、選択値と写真をここから送信する。
    setSubmitted(true);
    setCondition(null);
    setExpanded(null);
    setHazard(null);
    setWaterDepth(null);
    setShowBody(false);
    setBody("");
    setPhotoName("");
    setView("map");
  };

  // 投稿ページを開いた直後に表示する地図画面。
  if (view === "map") {
    return (
      <section
        className="relative flex min-h-0 flex-1 flex-col pb-18"
        aria-labelledby="posts-map-title"
      >
        <div className="relative z-[600] border-b border-outline bg-surface px-4 py-3 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-brand">現在地周辺</p>
              <h1
                id="posts-map-title"
                className="mt-0.5 text-xl font-black text-ink"
              >
                東川町 周辺
              </h1>
            </div>
            <p className="pt-1 text-right text-[0.6875rem] font-bold text-muted">
              9:41更新
              <br />
              投稿24件
            </p>
          </div>
          <p className="mt-2 inline-flex min-h-8 items-center rounded-lg bg-caution-soft px-3 py-1 text-xs font-black text-caution-ink">
            警戒レベル4　避難指示発令中
          </p>
        </div>

        {/* 現在地周辺と既存の道路情報を表示する地図。 */}
        <MapView />

        {/* 道路状況の入力画面を開くボタン。 */}
        <div className="absolute inset-x-3 bottom-3 z-[700]">
          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setView("report");
            }}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#597EBF] px-4 text-xs font-black text-white shadow-[0_8px_20px_rgb(35_62_104/0.22)]"
          >
            <PinIcon />
            この道の状況を報告する
          </button>
        </div>
      </section>
    );
  }

  // 道路状況を選んで投稿する入力画面
  return (
    <form
      className="flex min-h-0 flex-1 flex-col bg-white"
      aria-labelledby="posts-title"
      onSubmit={submitReport}
    >
      <header className="flex min-h-12 shrink-0 items-center justify-center gap-2 bg-[#597EBF] px-4 text-white">
        <PinIcon />
        <h1 id="posts-title" className="text-xs font-black">
          この道の状況を報告する
        </h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-3">
        {/* 通れる・注意が必要・通れないの選択欄。 */}
        <div className="space-y-2.5">
          <ConditionCard
            condition="passable"
            label="通れる"
            selected={condition === "passable"}
            onClick={() => chooseCondition("passable")}
          />

          <ConditionCard
            condition="caution"
            label="注意が必要"
            selected={condition === "caution"}
            expanded={expanded === "caution"}
            onClick={() => chooseCondition("caution")}
          >
            <HazardChoices
              selected={hazard}
              color="caution"
              onSelect={chooseHazard}
            />
          </ConditionCard>

          <ConditionCard
            condition="blocked"
            label="通れない"
            selected={condition === "blocked"}
            expanded={expanded === "blocked"}
            onClick={() => chooseCondition("blocked")}
          >
            <HazardChoices
              selected={hazard}
              color="blocked"
              onSelect={chooseHazard}
            />
          </ConditionCard>
        </div>

        {/* 通れる場合は任意、それ以外では必須となる水深選択欄。 */}
        <fieldset className="mt-3 rounded-xl border border-[#909EB8] bg-white px-2.5 pb-3 pt-2.5">
          <legend className="px-1 text-xs font-black text-ink">
            水深
            <span className="ml-1 font-medium text-muted">
              {condition === "passable" ? "任意" : "選択してください"}
            </span>
          </legend>
          <div className="mt-1 grid grid-cols-3 gap-1.5">
            {waterDepths.map((depth) => {
              const selected = waterDepth === depth.value;
              return (
                <button
                  key={depth.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setWaterDepth((current) =>
                      current === depth.value ? null : depth.value,
                    );
                    setSubmitted(false);
                  }}
                  className={`min-h-14 rounded-lg border px-1 py-1.5 text-center transition-colors ${selected ? "border-[#597EBF] bg-[#597EBF] text-white" : "border-[#909EB8]/60 bg-white text-ink"}`}
                >
                  <span className="block text-[0.625rem] font-black leading-tight">
                    {depth.label}
                  </span>
                  <span
                    className={`mt-1 block text-[0.5625rem] font-bold ${selected ? "text-white/85" : "text-muted"}`}
                  >
                    {depth.detail}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      {/* 任意項目と投稿ボタンをまとめた画面下部の操作欄。 */}
      <div className="shrink-0 space-y-2 bg-white px-3 pb-3 pt-2">
        {showBody && (
          <label className="block">
            <span className="sr-only">文章を追加</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={2}
              maxLength={400}
              placeholder="道路の状況を入力（任意）"
              className="w-full resize-none rounded-lg border border-[#909EB8] px-3 py-2 text-xs text-ink outline-none focus:border-[#597EBF] focus:ring-2 focus:ring-[#C7DCFF]"
            />
          </label>
        )}

        <button
          type="button"
          onClick={() => setShowBody((current) => !current)}
          className={`min-h-10 w-full rounded-lg text-xs font-black text-white ${showBody ? "bg-[#597EBF]" : "bg-[#a6abb0]"}`}
        >
          {showBody ? "文章を閉じる" : "文章を追加"}
        </button>

        <label
          className={`flex min-h-10 w-full cursor-pointer items-center justify-center rounded-lg text-xs font-black text-white ${photoName ? "bg-[#597EBF]" : "bg-[#a6abb0]"}`}
        >
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) =>
              setPhotoName(event.target.files?.[0]?.name ?? "")
            }
          />
          {photoName || "写真を追加"}
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          className={`min-h-12 w-full rounded-lg border text-xs font-black transition-colors ${
            canSubmit
              ? "border-[#597EBF] bg-[#597EBF] text-white"
              : "border-[#597EBF] bg-white text-[#597EBF]"
          }`}
        >
          {submitted ? "投稿しました" : "投稿する"}
        </button>
      </div>
    </form>
  );
}

// 通行状態ごとの大きな選択カードを表示する関数。
function ConditionCard({
  condition,
  label,
  selected,
  expanded = false,
  onClick,
  children,
}: {
  condition: RoadCondition;
  label: string;
  selected: boolean;
  expanded?: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  const color =
    condition === "passable"
      ? "#2E5D4E"
      : condition === "caution"
        ? "#F0A92E"
        : "#C7362A";
  return (
    <section
      className="overflow-hidden rounded-xl border-2 bg-white transition-colors"
      style={{ borderColor: expanded ? color : "transparent" }}
    >
      <button
        type="button"
        aria-expanded={children ? expanded : undefined}
        aria-pressed={selected}
        onClick={onClick}
        className="flex min-h-[4.5rem] w-full items-center gap-5 px-5 text-white"
        style={{ backgroundColor: color }}
      >
        <ConditionIcon condition={condition} />
        <span className="text-base font-black">{label}</span>
        {condition !== "passable" && (
          <svg
            viewBox="0 0 24 24"
            className={`ml-auto size-5 fill-none stroke-current stroke-2.5 transition-transform ${expanded ? "rotate-90" : ""}`}
            aria-hidden="true"
          >
            <path d="m9 5 7 7-7 7" />
          </svg>
        )}
      </button>
      {expanded && children}
    </section>
  );
}

// 注意・通行不可の原因をアイコンの一覧で表示する関数。
function HazardChoices({
  selected,
  color,
  onSelect,
}: {
  selected: HazardType | null;
  color: "caution" | "blocked";
  onSelect: (type: HazardType) => void;
}) {
  const selectedColor = color === "caution" ? "#597EBF" : "#C7362A";
  return (
    <fieldset className="px-2.5 pb-2.5 pt-2">
      <legend className="sr-only">道路の状態を選択</legend>
      <div className="grid grid-cols-3 gap-x-2 gap-y-2">
        {hazards.map((item) => {
          const isSelected = selected === item.type;
          return (
            <button
              key={item.type}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(item.type)}
              className="group min-w-0 text-center"
            >
              <span className="mb-1 block truncate text-[0.6875rem] font-black text-ink">
                {item.label}
              </span>
              <span
                className="mx-auto grid aspect-square w-full max-w-14 place-items-center rounded-lg text-white transition-colors"
                style={{
                  backgroundColor: isSelected ? selectedColor : "#a6abb0",
                }}
              >
                <HazardIcon type={item.type} />
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

// 通れる・注意が必要・通れないを表すアイコンを描画する関数。
function ConditionIcon({ condition }: { condition: RoadCondition }) {
  if (condition === "passable")
    return (
      <svg
        viewBox="0 0 48 48"
        className="size-9 fill-none stroke-current stroke-[4]"
        aria-hidden="true"
      >
        <path d="m9 25 10 10L40 13" />
      </svg>
    );
  if (condition === "blocked")
    return (
      <svg
        viewBox="0 0 48 48"
        className="size-9 fill-none stroke-current stroke-[4]"
        aria-hidden="true"
      >
        <path d="m10 10 28 28M38 10 10 38" />
      </svg>
    );
  return (
    <svg
      viewBox="0 0 48 48"
      className="size-10 fill-none stroke-current stroke-[3]"
      aria-hidden="true"
    >
      <path d="M24 5 44 41H4Z" />
      <path d="M24 17v12M24 35v1" />
    </svg>
  );
}

// 冠水や土砂など、道路状態の原因を表すアイコンを描画する関数。
function HazardIcon({ type }: { type: HazardType }) {
  const common = "size-11 fill-none stroke-current stroke-[2.5]";
  if (type === "flood")
    return (
      <svg viewBox="0 0 48 48" className={common} aria-hidden="true">
        <path d="M4 16c5-6 9 6 14 0s9 6 14 0 8 5 12 1M4 26c5-6 9 6 14 0s9 6 14 0 8 5 12 1M4 36c5-6 9 6 14 0s9 6 14 0 8 5 12 1" />
      </svg>
    );
  if (type === "landslide")
    return (
      <svg viewBox="0 0 48 48" className={common} aria-hidden="true">
        <path d="m6 40 12-31 24 31Z" />
        <circle cx="31" cy="18" r="3" />
        <circle cx="37" cy="27" r="3" />
      </svg>
    );
  if (type === "collapse")
    return (
      <svg viewBox="0 0 48 48" className={common} aria-hidden="true">
        <path d="M7 40V9h34v31ZM13 16l8 6-5 8 12 10M31 9l-3 12 13 6" />
      </svg>
    );
  if (type === "congestion")
    return (
      <svg viewBox="0 0 48 48" className={common} aria-hidden="true">
        <path d="m8 24 4-10h24l4 10M6 24h36v15H6ZM12 39v4M36 39v4" />
        <circle cx="14" cy="31" r="3" />
        <circle cx="34" cy="31" r="3" />
      </svg>
    );
  if (type === "restriction")
    return (
      <svg viewBox="0 0 48 48" className={common} aria-hidden="true">
        <circle cx="24" cy="24" r="18" />
        <path d="m11 37 26-26" />
      </svg>
    );
  return (
    <svg viewBox="0 0 48 48" className={common} aria-hidden="true">
      <path d="M24 5 44 41H4Z" />
      <path d="M24 17v12M24 35v1" />
    </svg>
  );
}

// 報告地点を示すピンアイコンを描画する関数。
function PinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5 fill-none stroke-current stroke-2.5"
      aria-hidden="true"
    >
      <path d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2" />
    </svg>
  );
}
