"use client";

import type { AppRouter } from "@michinavi/backend";
import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import { api } from "@/lib/trpc/client";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type EvacuationAdvice = RouterOutputs["evacuation"]["latest"];
type EvacuationOption = EvacuationAdvice["options"][number];
type AssignedShelter = RouterOutputs["shelterAssignment"]["assign"];
type RoadSnapshot = {
  reportCount: number;
  caution: number;
  impassable: number;
};

function errorCode(error: unknown) {
  if (
    error !== null &&
    typeof error === "object" &&
    "data" in error &&
    error.data !== null &&
    typeof error.data === "object" &&
    "code" in error.data
  ) {
    return error.data.code;
  }

  return undefined;
}

function formatGeneratedAt(generatedAt: string) {
  const date = new Date(generatedAt);
  if (Number.isNaN(date.getTime())) return "--:--";

  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function readRoadSnapshot(inputSnapshot: unknown): RoadSnapshot | null {
  if (
    inputSnapshot === null ||
    typeof inputSnapshot !== "object" ||
    !("surroundings" in inputSnapshot)
  ) {
    return null;
  }

  const surroundings = inputSnapshot.surroundings;
  if (
    surroundings === null ||
    typeof surroundings !== "object" ||
    !("reportCount" in surroundings) ||
    !("caution" in surroundings) ||
    !("impassable" in surroundings) ||
    typeof surroundings.reportCount !== "number" ||
    typeof surroundings.caution !== "number" ||
    typeof surroundings.impassable !== "number"
  ) {
    return null;
  }

  return {
    reportCount: surroundings.reportCount,
    caution: surroundings.caution,
    impassable: surroundings.impassable,
  };
}

function OptionIcon({ option }: { option: EvacuationOption }) {
  if (option.travelMode === "walk") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="size-6 fill-current"
        aria-hidden="true"
      >
        <circle cx="12.4" cy="4.3" r="1.6" />
        <path d="M10.8 6.5h2.6v6.3h-2.6zM10.8 7 7.6 8.7v4H6.2V8l4.3-2.2ZM13.1 6.6l2.2 2.3 3.4 1.2v1.5l-4.1-1.1-2.7-2.4ZM10.2 11.7l-1.7 7.6H6.6l2.2-8.6ZM11.8 12.2l2.8 2.3v4.8h-1.8v-3.9l-2.5-1.9Z" />
      </svg>
    );
  }

  if (option.travelMode === "car") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="size-7 fill-none stroke-current stroke-2"
        aria-hidden="true"
      >
        <path d="m5 11 1.5-4h11l1.5 4M4 11h16v7H4z" />
        <path d="M7 18v2M17 18v2" />
        <circle cx="7.5" cy="14.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="16.5" cy="14.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="size-7 fill-none stroke-current stroke-2"
      aria-hidden="true"
    >
      <path d="m4 11 8-7 8 7v9H4z" />
      {option.optionType === "vertical" ? (
        <path d="M9 16h6M12 17V9m0 0-3 3m3-3 3 3" />
      ) : (
        <path d="M9 20v-7h6v7" />
      )}
    </svg>
  );
}

function roadStatusText(road: RoadSnapshot | null) {
  // 「読めなかった」と「報告が無い」は別のこと。読めなかったのに
  // 「報告なし」と言い切ると、確認できていない状態が安全に見えてしまう
  if (!road) return "周辺の状況を取得できませんでした";
  if (road.reportCount === 0) return "周辺の報告なし";
  if (road.impassable > 0) {
    return `周辺に通行不可あり・投稿${road.reportCount}件`;
  }
  if (road.caution > 0) {
    return `周辺に注意情報あり・投稿${road.reportCount}件`;
  }
  return `周辺に通行不可の報告なし・投稿${road.reportCount}件`;
}

function travelTimeText(
  option: EvacuationOption,
  assignedShelter?: AssignedShelter,
) {
  if (option.estimatedMinutes !== null) {
    return `約${option.estimatedMinutes}分`;
  }
  if (option.travelMode === "walk" && assignedShelter) {
    // 道のりではなく直線距離を 80m/分で割った概算。実際の道のりは
    // 直線の 1.3〜1.5 倍になるので、サーバ由来の値と区別が付く書き方にする
    return `直線距離での目安 約${Math.max(1, Math.ceil(assignedShelter.distanceM / 80))}分`;
  }
  return null;
}

function CompactOptionCard({
  option,
  assignedShelter,
  roadSnapshot,
  onSelect,
}: {
  option: EvacuationOption;
  assignedShelter?: AssignedShelter;
  roadSnapshot: RoadSnapshot | null;
  onSelect: () => void;
}) {
  const recommended = option.rank === 1;
  const travelTime = travelTimeText(option, assignedShelter);
  // 取得できなかったときと報告が0件のときは、緑（安全）に倒さず中立にする。
  // 確認できていないことを「大丈夫そう」と読ませない
  const statusTone =
    !roadSnapshot || roadSnapshot.reportCount === 0
      ? "bg-muted"
      : roadSnapshot.impassable > 0
        ? "bg-impassable"
        : roadSnapshot.caution > 0
          ? "bg-caution"
          : "bg-passable";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-h-24 w-full items-center gap-3 rounded-2xl border bg-surface px-3 py-3 text-left shadow-card ${
        recommended ? "border-passable" : "border-outline"
      }`}
      aria-label={`${option.title}の詳細を表示`}
    >
      <span
        aria-hidden="true"
        className={`grid size-12 shrink-0 place-items-center rounded-xl ${
          recommended
            ? "bg-passable/10 text-passable"
            : "bg-app-surface text-muted"
        }`}
      >
        <OptionIcon option={option} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-base font-black text-ink">{option.title}</span>
          {recommended && (
            <span className="rounded-md bg-passable px-2 py-1 text-[0.6875rem] font-black text-white">
              推奨
            </span>
          )}
        </span>
        <span className="mt-1 block text-xs font-bold text-muted">
          {option.optionType === "designated_shelter" &&
          assignedShelter?.shelterName
            ? travelTime
              ? `${travelTime}／${assignedShelter.shelterName}`
              : `所要時間未取得／${assignedShelter.shelterName}`
            : option.optionType === "designated_shelter"
              ? "所要時間未取得／避難先未選択"
              : option.optionType === "vertical"
                ? "即時／現在いる建物"
                : "即時／自宅"}
        </span>
        <span className="mt-1.5 flex items-center gap-2 text-[0.6875rem] font-bold text-muted">
          <span
            aria-hidden="true"
            className={`size-2.5 shrink-0 rounded-full ${statusTone}`}
          />
          {roadStatusText(roadSnapshot)}
        </span>
      </span>
      <span aria-hidden="true" className="text-2xl font-light text-ink">
        ›
      </span>
    </button>
  );
}

function AdviceOptionDetails({
  option,
  assignedShelter,
}: {
  option: EvacuationOption;
  assignedShelter?: AssignedShelter;
}) {
  const recommended = option.rank === 1;
  const travelTime = travelTimeText(option, assignedShelter);

  return (
    <article
      className={`rounded-2xl border bg-surface px-4 py-4 shadow-card ${
        recommended ? "border-passable" : "border-outline"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.6875rem] font-bold text-muted">
            選択肢 {option.rank}
          </p>
          <h3 className="mt-0.5 text-base font-black text-ink">
            {option.title}
          </h3>
        </div>
        {recommended && (
          <span className="shrink-0 rounded-md bg-passable px-2 py-1 text-[0.6875rem] font-black text-white">
            推奨
          </span>
        )}
      </div>

      <p className="mt-3 text-sm font-bold leading-relaxed text-ink">
        {option.reason}
      </p>

      {option.optionType === "designated_shelter" &&
        assignedShelter?.shelterName && (
          <p className="mt-3 rounded-xl bg-passable/10 px-3 py-3 text-xs font-black text-passable">
            混雑状況を考慮した避難先：{assignedShelter.shelterName}
            {(travelTime || assignedShelter.isOverCapacity) && (
              <span className="mt-1 block font-bold">
                {travelTime}
                {travelTime && assignedShelter.isOverCapacity ? "・" : null}
                {assignedShelter.isOverCapacity ? "定員超過の可能性あり" : null}
              </span>
            )}
          </p>
        )}

      {/* 選択肢の根拠と避難先で基準にしている地点が違う。
          画面に出さないと、ひとつの根拠から出た結論に見えてしまう */}
      {option.optionType === "designated_shelter" &&
        assignedShelter?.shelterName && (
          <p className="mt-2 text-xs font-bold leading-relaxed text-muted">
            避難先は地図で選んだ位置、選択肢の根拠は登録した自宅を基準にしています。
          </p>
        )}

      {option.riskNote && (
        <div className="mt-3 rounded-xl bg-caution-soft px-3 py-3">
          <p className="text-xs font-black text-caution-ink">注意点</p>
          <p className="mt-1 text-xs font-bold leading-relaxed text-caution-ink">
            {option.riskNote}
          </p>
        </div>
      )}

      {option.switchCriteria.length > 0 && (
        <div className="mt-3 border-t border-outline pt-3">
          <p className="text-xs font-black text-ink">切り替えを考える目安</p>
          <ul className="mt-2 space-y-2">
            {option.switchCriteria.map((criterion) => (
              <li
                key={criterion.id}
                className="flex gap-2 text-xs font-bold leading-relaxed text-muted"
              >
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-2 shrink-0 rounded-full bg-caution"
                />
                {criterion.description}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function PanelMessage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-outline bg-surface px-4 py-5 text-center shadow-card">
      <h2 className="text-base font-black text-ink">{title}</h2>
      <div className="mt-2 text-xs font-bold leading-relaxed text-muted">
        {children}
      </div>
    </div>
  );
}

export function ChoicePanel({
  isActive = true,
  assignedShelter,
  isAssigningShelter = false,
  shelterAssignmentError = null,
}: {
  isActive?: boolean;
  assignedShelter?: AssignedShelter;
  isAssigningShelter?: boolean;
  shelterAssignmentError?: unknown;
}) {
  const [generatedAdvice, setGeneratedAdvice] = useState<EvacuationAdvice>();
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const latestQuery = api.evacuation.latest.useQuery(undefined, {
    enabled: isActive,
    retry: false,
  });
  const generateMutation = api.evacuation.generate.useMutation({
    onSuccess: (advice) => setGeneratedAdvice(advice),
  });
  const advice = generatedAdvice ?? latestQuery.data;
  const latestErrorCode = errorCode(latestQuery.error);
  const generateErrorCode = errorCode(generateMutation.error);
  const isUnauthorized =
    latestErrorCode === "UNAUTHORIZED" || generateErrorCode === "UNAUTHORIZED";
  // generate の NOT_FOUND は、現在のAPI契約では主世帯が未登録の場合だけ返る。
  const hasNoHousehold = generateErrorCode === "NOT_FOUND";
  // latest の NOT_FOUND は追加通信をせず、まず生成操作を案内する。
  const canGenerateAdvice = latestErrorCode === "NOT_FOUND";

  const generate = () => {
    generateMutation.reset();
    generateMutation.mutate(undefined);
  };

  if (latestQuery.isLoading) {
    return (
      <div className="px-3 py-5">
        <output className="rounded-2xl border border-outline bg-surface px-4 py-6 text-center text-sm font-bold text-muted">
          避難の選択肢を読み込んでいます
        </output>
      </div>
    );
  }

  if (isUnauthorized) {
    return (
      <div className="px-3 py-5">
        <PanelMessage title="ログインが必要です">
          選択肢を確認するにはログインしてください。
        </PanelMessage>
      </div>
    );
  }

  if (hasNoHousehold) {
    return (
      <div className="px-3 py-5">
        <PanelMessage title="世帯情報が必要です">
          選択肢を作る前に、世帯情報の登録を完了してください。
        </PanelMessage>
      </div>
    );
  }

  if (!advice && canGenerateAdvice) {
    return (
      <div className="px-3 py-5">
        <PanelMessage title="避難の選択肢はまだありません">
          <p>世帯と周辺の状況をもとに、判断材料を作成できます。</p>
          <button
            type="button"
            onClick={generate}
            disabled={generateMutation.isPending}
            className="mt-4 min-h-11 rounded-xl bg-brand px-5 py-2 text-sm font-black text-white disabled:opacity-60"
          >
            {generateMutation.isPending ? "作成しています" : "選択肢を作る"}
          </button>
          {generateMutation.error && (
            <p role="alert" className="mt-3 text-impassable">
              選択肢を作成できませんでした。時間をおいてお試しください。
            </p>
          )}
        </PanelMessage>
      </div>
    );
  }

  if (!advice) {
    return (
      <div className="px-3 py-5">
        <PanelMessage title="選択肢を取得できませんでした">
          <p>通信状況を確認して、もう一度お試しください。</p>
          <button
            type="button"
            onClick={() => latestQuery.refetch()}
            className="mt-4 min-h-11 rounded-xl border border-brand bg-surface px-5 py-2 text-sm font-black text-brand"
          >
            再読み込み
          </button>
        </PanelMessage>
      </div>
    );
  }

  const isExpired = Date.parse(advice.expiresAt) <= Date.now();
  const selectedOption = advice.options.find(
    (option) => option.id === selectedOptionId,
  );
  const roadSnapshot = readRoadSnapshot(advice.inputSnapshot);
  return (
    <section
      className="min-h-0 flex-1 overflow-y-auto px-3 pb-5 pt-3"
      aria-labelledby="advice-title"
    >
      {selectedOption ? (
        <div>
          <button
            type="button"
            onClick={() => setSelectedOptionId(null)}
            className="mb-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-black text-brand"
          >
            <span aria-hidden="true">‹</span>
            選択肢一覧へ戻る
          </button>
          <h2 id="advice-title" className="sr-only">
            避難の選択肢の詳細
          </h2>
          <AdviceOptionDetails
            option={selectedOption}
            assignedShelter={assignedShelter}
          />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <h2
                id="advice-title"
                className="truncate text-xs font-black text-ink"
              >
                AIが提案する避難の選択肢
              </h2>
              <button
                type="button"
                onClick={generate}
                disabled={generateMutation.isPending}
                className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-outline px-2 text-[0.625rem] font-bold text-muted disabled:opacity-60"
              >
                <span aria-hidden="true">↻</span>
                {generateMutation.isPending ? "更新中" : "更新"}
              </button>
            </div>
            <span className="shrink-0 text-[0.625rem] font-bold text-muted">
              {advice.options.length}件/{formatGeneratedAt(advice.generatedAt)}
              時点
            </span>
          </div>

          {isExpired && (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-caution bg-caution-soft px-3 py-3 text-xs font-bold leading-relaxed text-caution-ink"
            >
              この情報は古くなっています。現在の状況で選択肢を作り直してください。
            </p>
          )}

          {isAssigningShelter && (
            <output className="mt-3 block rounded-xl border border-outline bg-surface px-3 py-3 text-center text-xs font-bold text-muted">
              避難先を確認しています
            </output>
          )}
          {shelterAssignmentError !== null &&
            shelterAssignmentError !== undefined && (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-caution bg-caution-soft px-3 py-3 text-xs font-bold text-caution-ink"
              >
                選択した位置の周辺で避難先を決められませんでした。
              </p>
            )}

          <div className="mt-3 space-y-2.5">
            {advice.options.map((option) => (
              <CompactOptionCard
                key={option.id}
                option={option}
                assignedShelter={assignedShelter}
                roadSnapshot={roadSnapshot}
                onSelect={() => setSelectedOptionId(option.id)}
              />
            ))}
          </div>

          {generateMutation.error && (
            <p
              role="alert"
              className="mt-3 text-center text-xs font-bold text-impassable"
            >
              選択肢を作成できませんでした。時間をおいてお試しください。
            </p>
          )}

          <p className="mt-3 flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-outline bg-surface px-2.5 py-3 text-[0.625rem] font-bold leading-none tracking-tight text-muted">
            <span
              aria-hidden="true"
              className="grid size-4 shrink-0 place-items-center rounded-full border border-current text-[0.625rem]"
            >
              i
            </span>
            決めるのはあなたです。状況が変わったら再確認してください。
          </p>
        </>
      )}
    </section>
  );
}
