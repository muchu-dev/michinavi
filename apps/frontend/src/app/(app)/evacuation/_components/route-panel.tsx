"use client";

import type { AppRouter } from "@michinavi/backend";
import type { inferRouterOutputs } from "@trpc/server";
import { MapView } from "@/components/map/map-view";
import { api } from "@/lib/trpc/client";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type NearbyShelter = RouterOutputs["shelter"]["nearby"][number];
type AssignmentResult = RouterOutputs["shelterAssignment"]["assign"];

type RouteShelter = Pick<NearbyShelter, "id" | "name" | "distanceM"> & {
  expectedPeople?: number;
  occupancyRate?: number | null;
};

// DBのデモ避難所を確認できる地点と、徒歩時間の概算に使う歩行速度を定義する。
const demoLocation = { latitude: 34.6383, longitude: 133.6903 };
const walkingMetersPerMinute = 80;

function getWalkingMinutes(distanceM: number) {
  return Math.max(1, Math.ceil(distanceM / walkingMetersPerMinute));
}

// 小さい表示でも歩行姿勢を判別できる単純なシルエットを表示する。
function WalkingIcon() {
  return (
    <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-passable/10 text-passable">
      <svg
        viewBox="0 0 24 24"
        className="size-6 fill-current"
        aria-hidden="true"
      >
        <circle cx="12.4" cy="4.3" r="1.6" />
        <path d="M10.8 6.5 H13.4 V12.8 H10.8 Z" />
        <path d="m10.8 7-3.2 1.7v4H6.2V8l4.3-2.2Z" />
        <path d="m13.1 6.6 2.2 2.3 3.4 1.2v1.5l-4.1-1.1-2.7-2.4Z" />
        <path d="m10.2 11.7-1.7 7.6H6.6l2.2-8.6Z" />
        <path d="m11.8 12.2 2.8 2.3v4.8h-1.8v-3.9l-2.5-1.9Z" />
      </svg>
    </span>
  );
}

// DBから取得した避難所を1つの経路候補として表示する。
function RouteOptionCard({
  shelter,
  recommended,
  recommendationReason,
}: {
  shelter: RouteShelter;
  recommended: boolean;
  recommendationReason?: string;
}) {
  const distanceKm = shelter.distanceM / 1000;
  const walkingMinutes = getWalkingMinutes(shelter.distanceM);

  return (
    <article
      className={`flex items-center gap-3 rounded-2xl border bg-white px-3 py-3 shadow-card ${recommended ? "border-passable" : "border-outline"}`}
    >
      <WalkingIcon />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-black text-ink">
            徒歩で{shelter.name}へ
          </h3>
          {recommended && (
            <span className="rounded-md bg-passable px-2 py-1 text-[0.6875rem] font-black text-white">
              推奨
            </span>
          )}
        </div>
        <p className="mt-1 text-xs font-bold text-muted">
          約{walkingMinutes}分・直線距離約
          {distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)}km /{" "}
          {shelter.name}
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-muted">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-muted" />
          経路上の投稿情報は未連携
        </p>
        {shelter.expectedPeople !== undefined && (
          <p className="mt-1 text-[0.6875rem] font-bold text-muted">
            想定避難者 {shelter.expectedPeople}人
            {shelter.occupancyRate === null ||
            shelter.occupancyRate === undefined
              ? "・定員不明"
              : `・定員の${Math.round(shelter.occupancyRate * 100)}%`}
          </p>
        )}
        {recommended && (
          <p className="mt-1 text-[0.6875rem] font-bold text-passable">
            {recommendationReason ?? "デモ位置から直線距離が最短のため推奨"}
          </p>
        )}
      </div>
    </article>
  );
}

// デモ位置から近い避難所をDBで取得し、距離順の3候補を表示する。
export function RoutePanel() {
  // nearby APIが返す距離順の先頭3件を候補とし、先頭だけを推奨扱いにする。
  const nearbyQuery = api.shelter.nearby.useQuery({
    ...demoLocation,
    radiusM: 50_000,
    limit: 3,
  });
  const apiUtils = api.useUtils();
  const currentAssignment = api.shelterAssignment.current.useQuery();
  const assignShelter = api.shelterAssignment.assign.useMutation({
    onSuccess: async () => {
      await apiUtils.shelterAssignment.current.invalidate();
    },
  });
  const assignment = assignShelter.data;
  const assignedShelter = toAssignedShelter(assignment);
  const routeOptions: RouteShelter[] = assignment
    ? [
        ...(assignedShelter ? [assignedShelter] : []),
        ...assignment.alternatives.slice(0, 2),
      ]
    : (nearbyQuery.data ?? []);

  const requestAssignment = () => {
    assignShelter.mutate({
      ...demoLocation,
      radiusM: 50_000,
      candidateLimit: 3,
    });
  };

  return (
    <>
      <div className="relative h-[19rem] shrink-0 overflow-hidden border-b border-outline">
        <MapView
          currentLocation={demoLocation}
          locationLabel="デモ位置（真備町箭田）"
        />
      </div>
      <section className="px-3 pb-5 pt-3" aria-labelledby="route-options-title">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <div>
            <h2
              id="route-options-title"
              className="text-sm font-black text-ink"
            >
              避難先の選択肢
            </h2>
            <p className="mt-0.5 text-[0.625rem] font-bold text-muted">
              デモ位置：岡山県倉敷市真備町箭田
            </p>
          </div>
          <span className="whitespace-nowrap text-[0.625rem] font-bold text-muted">
            {nearbyQuery.isLoading ? "--" : routeOptions.length}件
          </span>
        </div>
        {currentAssignment.data && !assignment && (
          <p className="mb-2 rounded-xl border border-passable/40 bg-passable/10 px-3 py-2 text-xs font-bold text-passable">
            現在の避難先：{currentAssignment.data.shelterName ?? "名称不明"}
            （世帯{currentAssignment.data.partySize}人）
          </p>
        )}
        <button
          type="button"
          onClick={requestAssignment}
          disabled={assignShelter.isPending}
          className="mb-3 min-h-11 w-full rounded-xl bg-brand px-4 text-xs font-black text-white disabled:cursor-wait disabled:opacity-60"
        >
          {assignShelter.isPending
            ? "避難先を計算しています…"
            : assignment
              ? "混雑状況を更新して再割り当て"
              : "混雑を考慮して避難先を決める"}
        </button>
        {assignShelter.error && (
          <p
            role="alert"
            className="mb-3 rounded-xl border border-impassable bg-white px-3 py-3 text-center text-xs font-bold text-impassable"
          >
            避難先を割り当てられませんでした。ログインと家族構成を確認してください。
          </p>
        )}
        {assignment && (
          <p
            className={`mb-3 rounded-xl border px-3 py-3 text-xs font-bold ${
              assignment.isOverCapacity
                ? "border-caution bg-caution-soft text-caution-ink"
                : "border-passable/40 bg-passable/10 text-passable"
            }`}
          >
            {assignment.shelterName ?? "選択された避難所"}を、世帯
            {assignment.partySize}人の避難先に設定しました。
            {assignment.isOverCapacity
              ? "周辺の避難所が混雑しているため、代替候補も確認してください。"
              : "距離と現在の想定人数をもとに分散しています。"}
          </p>
        )}
        {/* DB通信中・失敗・0件を区別し、候補がない理由を利用者へ示す。 */}
        {nearbyQuery.isLoading && (
          <p className="rounded-xl border border-outline bg-white px-3 py-5 text-center text-xs font-bold text-muted">
            避難所情報を読み込んでいます
          </p>
        )}
        {nearbyQuery.error && (
          <p
            role="alert"
            className="rounded-xl border border-impassable bg-white px-3 py-5 text-center text-xs font-bold text-impassable"
          >
            避難先の候補を取得できませんでした
          </p>
        )}
        {!nearbyQuery.isLoading &&
          !nearbyQuery.error &&
          routeOptions.length === 0 && (
            <p className="rounded-xl border border-outline bg-white px-3 py-5 text-center text-xs font-bold text-muted">
              デモ位置の周辺に避難所が見つかりませんでした
            </p>
          )}
        {/* APIの距離順を維持し、最も近い1件だけに推奨表示を付ける。 */}
        <div className="space-y-2.5">
          {routeOptions.map((shelter, index) => (
            <RouteOptionCard
              key={shelter.id}
              shelter={shelter}
              recommended={index === 0}
              recommendationReason={
                assignment && index === 0
                  ? "距離と避難所の混雑状況を考慮して割り当て"
                  : undefined
              }
            />
          ))}
        </div>
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-outline bg-white px-3 py-3 text-[0.6875rem] font-bold leading-relaxed text-muted">
          <span
            aria-hidden="true"
            className="grid size-4 shrink-0 place-items-center rounded-full border border-current text-[0.625rem]"
          >
            i
          </span>
          所要時間は直線距離を徒歩80m/分で換算した概算です。実際の道路状況と避難情報を確認してください。
        </p>
      </section>
    </>
  );
}

function toAssignedShelter(
  assignment: AssignmentResult | undefined,
): RouteShelter | null {
  if (!assignment) return null;

  return {
    id: assignment.shelterId,
    name: assignment.shelterName ?? "名称不明の避難所",
    distanceM: assignment.distanceM,
    expectedPeople: assignment.expectedPeopleBefore + assignment.partySize,
  };
}
