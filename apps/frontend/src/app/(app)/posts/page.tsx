"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import { MapView } from "@/components/map/map-view";
import { toQuarterMeshCode } from "@/lib/location/mesh-code";
import { api } from "@/lib/trpc/client";

const REPORT_REGION = {
  name: "千代田区周辺",
  center: [35.6938, 139.753] as [number, number],
};

// 道路の通行状態を表す画面内の選択値
type RoadCondition = "passable" | "caution" | "impassable";
// 注意・通行不可の原因として選択できる状態種別
type HazardType =
  | "flood"
  | "landslide"
  | "collapse"
  | "congestion"
  | "restriction"
  | "other";
// 状態選択欄に表示する原因の一覧
const hazards: ReadonlyArray<{ type: HazardType; label: string }> = [
  { type: "flood", label: "冠水" },
  { type: "landslide", label: "土砂・崩落" },
  { type: "collapse", label: "倒木・倒壊" },
  { type: "congestion", label: "渋滞" },
  { type: "restriction", label: "交通規制" },
  { type: "other", label: "その他" },
];

// ページ：投稿地図と道路状況入力を切り替えて表示できる
export default function PostsPage() {
  const [view, setView] = useState<"map" | "report">("map");
  const [condition, setCondition] = useState<RoadCondition | null>(null);
  const [expanded, setExpanded] = useState<"caution" | "impassable" | null>(
    null,
  );
  const [hazard, setHazard] = useState<HazardType | null>(null);
  const [draftPosition, setDraftPosition] = useState<[number, number] | null>(
    null,
  );
  const [mapPosition, setMapPosition] = useState<[number, number] | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // DBから道路投稿を取得し、投稿成功後に同じキャッシュを再取得する。
  const nearbyMeshPrefix = toQuarterMeshCode(
    ...(mapPosition ?? REPORT_REGION.center),
  ).slice(0, 6);
  const reportList = api.fieldReport.list.useQuery({ limit: 100 });
  const apiUtils = api.useUtils();
  const createReport = api.fieldReport.create.useMutation();
  const visibleReports = (reportList.data ?? []).flatMap((report) =>
    report.roadCondition && report.meshCode.startsWith(nearbyMeshPrefix)
      ? [{ ...report, roadCondition: report.roadCondition }]
      : [],
  );
  const displayedRegionName = mapPosition
    ? "取得した現在地周辺"
    : REPORT_REGION.name;

  // 通行状態の選択を切り替えるための関数。
  const chooseCondition = (next: RoadCondition) => {
    setSubmitError(null);
    if (next === "passable") {
      setCondition("passable");
      setExpanded(null);
      return;
    }
    setCondition(next);
    setExpanded((current) => (current === next ? null : next));
    setHazard(null);
  };

  // 注意・通行不可の原因アイコンを選択する関数
  const chooseHazard = (type: HazardType) => {
    if (!expanded) return;
    setCondition(expanded);
    setHazard(type);
    setExpanded(null);
    setSubmitError(null);
  };

  // 選択済みの通行状態を保ったまま原因一覧の開閉だけを切り替える関数。
  const toggleHazardChoices = (target: "caution" | "impassable") => {
    setExpanded((current) => (current === target ? null : target));
  };

  // 現在の選択内容で投稿可能かを判定する値
  const canSubmit = condition !== null;

  // 地図を残したまま投稿フォームを開き、投稿対象地点を確定する関数。
  const openReportForm = async () => {
    setSuccessMessage(null);
    setSubmitError(null);
    setView("report");
    try {
      const position = await getCurrentPosition();
      const coordinates: [number, number] = [
        position.coords.latitude,
        position.coords.longitude,
      ];
      setDraftPosition(coordinates);
      setMapPosition(coordinates);
    } catch (error) {
      setSubmitError(getSubmitErrorMessage(error));
    }
  };

  // 投稿をキャンセルして入力状態を破棄し、地図画面へ戻る関数。
  const closeReportForm = () => {
    setCondition(null);
    setExpanded(null);
    setHazard(null);
    setDraftPosition(null);
    setSubmitError(null);
    setView("map");
  };

  // 投稿ボタン押下時に入力を検証し、完了後に地図へ戻す関数
  const submitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || !condition || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const position = draftPosition ?? (await getCurrentPosition()).coords;
      // 正確なGPS座標は送らず、約250mのメッシュコードだけを投稿APIへ渡す。
      const meshCode = toQuarterMeshCode(
        "latitude" in position ? position.latitude : position[0],
        "longitude" in position ? position.longitude : position[1],
      );
      await createReport.mutateAsync({
        meshCode,
        roadCondition: condition,
      });
      await apiUtils.fieldReport.list.invalidate();

      setSuccessMessage("投稿しました");
      setCondition(null);
      setExpanded(null);
      setHazard(null);
      setDraftPosition(null);
      setView("map");
    } catch (error) {
      setSubmitError(getSubmitErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
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
              <p className="text-xs font-bold text-brand">
                {mapPosition ? "現在地周辺" : "表示地域"}
              </p>
              <h1
                id="posts-map-title"
                className="mt-0.5 text-xl font-black text-ink"
              >
                {displayedRegionName}
              </h1>
            </div>
            <p className="pt-1 text-right text-[0.6875rem] font-bold text-muted">
              {formatUpdatedAt(reportList.dataUpdatedAt)}更新
              <br />
              投稿{visibleReports.length}件
            </p>
          </div>
          <p className="mt-2 inline-flex min-h-8 items-center rounded-lg bg-caution-soft px-3 py-1 text-xs font-black text-caution-ink">
            （サンプル）警戒情報
          </p>
        </div>

        {successMessage ? (
          <output className="relative z-[600] bg-passable px-4 py-2 text-center text-xs font-black text-white">
            {successMessage}
          </output>
        ) : null}
        {reportList.isError ? (
          <p
            role="alert"
            className="relative z-[600] bg-impassable px-4 py-2 text-center text-xs font-black text-white"
          >
            投稿一覧を取得できませんでした。再読み込みしてください。
          </p>
        ) : null}
        {reportList.isPending ? (
          <output className="relative z-[600] bg-surface px-4 py-2 text-center text-xs font-bold text-muted">
            投稿一覧を読み込んでいます
          </output>
        ) : null}

        {/* 現在地周辺と既存の道路情報を表示する地図。 */}
        <MapView
          center={REPORT_REGION.center}
          regionName={displayedRegionName}
          reports={visibleReports}
          onPositionChange={setMapPosition}
        />

        {/* 道路状況の入力画面を開くボタン。 */}
        <div className="absolute inset-x-3 bottom-3 z-[700]">
          <button
            type="button"
            onClick={openReportForm}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-xs font-black text-white shadow-card"
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
      <header className="flex min-h-12 shrink-0 items-center bg-brand px-4 text-white">
        <button
          type="button"
          onClick={closeReportForm}
          className="min-h-10 rounded-lg px-2 text-xs font-black"
        >
          ← 戻る
        </button>
        <span className="ml-auto flex items-center gap-2">
          <PinIcon />
          <h1 id="posts-title" className="text-xs font-black">
            この道の状況を報告する
          </h1>
        </span>
        <span className="ml-auto w-12" aria-hidden="true" />
      </header>

      <div className="min-h-52 shrink-0 border-b border-outline">
        <MapView
          center={REPORT_REGION.center}
          compact
          regionName={displayedRegionName}
          reports={visibleReports}
          selectedPosition={draftPosition}
          onPositionChange={setMapPosition}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-3">
        {/* 通れる・注意が必要・通れないの選択欄。 */}
        <div
          className="space-y-2.5"
          role="radiogroup"
          aria-label="道路の通行状態"
        >
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
            selectedHazard={condition === "caution" ? hazard : null}
            expanded={expanded === "caution"}
            onClick={() => chooseCondition("caution")}
            onToggleExpanded={() => toggleHazardChoices("caution")}
          >
            <HazardChoices
              selected={hazard}
              color="caution"
              onSelect={chooseHazard}
            />
          </ConditionCard>

          <ConditionCard
            condition="impassable"
            label="通れない"
            selected={condition === "impassable"}
            selectedHazard={condition === "impassable" ? hazard : null}
            expanded={expanded === "impassable"}
            onClick={() => chooseCondition("impassable")}
            onToggleExpanded={() => toggleHazardChoices("impassable")}
          >
            <HazardChoices
              selected={hazard}
              color="impassable"
              onSelect={chooseHazard}
            />
          </ConditionCard>
        </div>

        <p className="mt-2 text-[0.6875rem] font-bold text-muted">
          原因の選択は任意です。現在DBに保存されるのは通行状態と投稿地点のメッシュのみです。
        </p>
      </div>

      {/* 投稿処理とエラー表示をまとめた画面下部の操作欄。 */}
      <div className="shrink-0 space-y-2 bg-white px-3 pb-3 pt-2">
        <button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className={`min-h-12 w-full rounded-lg border text-xs font-black transition-colors ${
            canSubmit && !isSubmitting
              ? "border-brand bg-brand text-white"
              : "border-brand bg-white text-brand"
          }`}
        >
          {isSubmitting ? "送信中..." : "投稿する"}
        </button>
        {submitError ? (
          <p
            aria-live="polite"
            className="text-center text-xs font-bold text-impassable"
            role="alert"
          >
            {submitError}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function getCurrentPosition() {
  // 投稿地点を確定する時だけ、ブラウザから最新の現在地を1回取得する。
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("位置情報を取得できない端末です"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "投稿には現在地が必要です。位置情報の利用を許可してください。"
            : "現在地を取得できませんでした。時間をおいてもう一度お試しください。";
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30_000,
        timeout: 10_000,
      },
    );
  });
}

function getSubmitErrorMessage(error: unknown) {
  if (
    error !== null &&
    typeof error === "object" &&
    "data" in error &&
    error.data !== null &&
    typeof error.data === "object" &&
    "code" in error.data &&
    error.data.code === "UNAUTHORIZED"
  ) {
    return "投稿にはログインが必要です。開発環境では開発用ログイン設定を確認してください。";
  }
  if (error instanceof Error && error.message) return error.message;
  return "投稿を保存できませんでした。時間をおいてもう一度お試しください。";
}

// 投稿一覧を最後に取得した時刻を日本時間で表示する関数。
function formatUpdatedAt(updatedAt: number) {
  if (!updatedAt) return "--:--";
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(updatedAt));
}

// 通行状態ごとの大きな選択カードを表示する関数。
function ConditionCard({
  condition,
  label,
  selected,
  selectedHazard = null,
  expanded = false,
  onClick,
  onToggleExpanded,
  children,
}: {
  condition: RoadCondition;
  label: string;
  selected: boolean;
  selectedHazard?: HazardType | null;
  expanded?: boolean;
  onClick: () => void;
  onToggleExpanded?: () => void;
  children?: ReactNode;
}) {
  const colorClass =
    condition === "passable"
      ? "border-passable bg-passable"
      : condition === "caution"
        ? "border-caution bg-caution"
        : "border-impassable bg-impassable";
  return (
    <section
      className={`overflow-hidden rounded-xl border-2 bg-white transition-colors ${expanded ? colorClass : "border-transparent"}`}
    >
      <div
        className={`flex min-h-[4.5rem] items-center text-white ${colorClass}`}
      >
        <label className="flex min-h-[4.5rem] min-w-0 flex-1 cursor-pointer items-center gap-5 px-5 has-focus-visible:outline-2 has-focus-visible:outline-offset-[-4px] has-focus-visible:outline-white">
          <input
            type="radio"
            name="road-condition"
            value={condition}
            checked={selected}
            onChange={onClick}
            className="sr-only"
          />
          <ConditionIcon condition={condition} />
          <span className="text-base font-black">{label}</span>
          {selectedHazard ? (
            <span className="ml-auto grid size-10 place-items-center rounded-lg bg-brand text-white">
              <span className="sr-only">
                {hazards.find((item) => item.type === selectedHazard)?.label}
              </span>
              <HazardIcon type={selectedHazard} />
            </span>
          ) : null}
        </label>
        {condition !== "passable" && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${label}の原因一覧を${expanded ? "閉じる" : "開く"}`}
            onClick={onToggleExpanded}
            className="grid min-h-[4.5rem] w-12 shrink-0 place-items-center focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
          >
            <svg
              viewBox="0 0 24 24"
              className={`size-5 fill-none stroke-current stroke-[2.5] transition-transform ${expanded ? "rotate-90" : ""}`}
              aria-hidden="true"
            >
              <path d="m9 5 7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
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
  color: "caution" | "impassable";
  onSelect: (type: HazardType) => void;
}) {
  const selectedColor = color === "caution" ? "bg-brand" : "bg-impassable";
  return (
    <fieldset className="px-2.5 pb-2.5 pt-2">
      <legend className="sr-only">道路状況の原因（任意）</legend>
      <div className="grid grid-cols-3 gap-x-2 gap-y-2">
        {hazards.map((item) => {
          const isSelected = selected === item.type;
          return (
            <label
              key={item.type}
              className="group min-w-0 cursor-pointer text-center has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand"
            >
              <input
                type="radio"
                name="road-hazard"
                value={item.type}
                checked={isSelected}
                onChange={() => onSelect(item.type)}
                className="sr-only"
              />
              <span className="mb-1 block truncate text-[0.6875rem] font-black text-ink">
                {item.label}
              </span>
              <span
                className={`mx-auto grid aspect-square w-full max-w-14 place-items-center rounded-lg text-white transition-colors ${isSelected ? selectedColor : "bg-muted"}`}
              >
                <HazardIcon type={item.type} />
              </span>
            </label>
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
  if (condition === "impassable")
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
      className="size-5 fill-none stroke-current stroke-[2.5]"
      aria-hidden="true"
    >
      <path d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2" />
    </svg>
  );
}
