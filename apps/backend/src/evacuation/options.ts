import type { Database } from "@michinavi/db";

/**
 * 避難の選択肢の候補を、世帯の条件と周辺の投稿状況から決定論的に組み立てる（BE-19）。
 *
 * ここに AI を挟まないのは、候補集合そのものを AI に作らせないためである
 * （docs/er/07-safety-moderation.md#プロンプトインジェクションへの対策 の
 * 「選択肢の限定」と「決定論的な絞り込み」の層）。
 * 車を持たない世帯に車の選択肢を出さない、といった足切りはすべてこの関数が行い、
 * AI には並び順と文面だけを任せる。
 *
 * DB に触らない純粋な関数なので、条件ごとの分岐は単体テストで直接検証できる。
 */

export type OptionKey =
  | "stay_home"
  | "vertical"
  | "walk_shelter"
  | "car_shelter";

export type EvacuationOptionType =
  Database["public"]["Enums"]["evacuation_option_type"];
export type TravelMode = Database["public"]["Enums"]["travel_mode"];
export type SwitchTriggerType =
  Database["public"]["Enums"]["switch_trigger_type"];

/** 世帯の側の事実。要配慮の自由記述（detail）は持たない */
export type HouseholdFacts = {
  memberCount: number;
  infantCount: number;
  seniorCount: number;
  needsAssistanceCount: number;
  /** care_needs のキー。件数と種類だけを見る */
  careNeedKeys: string[];
  petCount: number;
  carCount: number;
  hasCar: boolean;
};

/** 自宅の周辺（同じ 1km メッシュ）の道路状態。BE-16 の推定を数えたもの */
export type RoadFacts = {
  /** 推定のある区画の数 */
  meshCount: number;
  passable: number;
  caution: number;
  impassable: number;
  /** 推定の根拠になった投稿の総数 */
  reportCount: number;
};

export type SwitchCriterion = {
  triggerType: SwitchTriggerType;
  description: string;
  thresholdValue: number | null;
  thresholdUnit: string | null;
  comparator: "gte" | "lte" | null;
  /** 切り替え先。同じ提案に含まれるキーだけを指す */
  switchToKey: OptionKey | null;
  displayOrder: number;
};

export type EvacuationCandidate = {
  key: OptionKey;
  /** 推奨順。1 が最も勧める選択肢 */
  rank: number;
  optionType: EvacuationOptionType;
  travelMode: TravelMode;
  title: string;
  reason: string;
  riskNote: string | null;
  switchCriteria: SwitchCriterion[];
};

/** 徒歩での避難に時間がかかる可能性がある世帯か */
export function hasMobilityConstraint(facts: HouseholdFacts): boolean {
  return (
    facts.needsAssistanceCount > 0 ||
    facts.infantCount > 0 ||
    facts.seniorCount > 0 ||
    facts.careNeedKeys.length > 0
  );
}

function stayHomeReason(road: RoadFacts): string {
  if (road.impassable > 0) {
    return `自宅の周辺${road.meshCount}区画のうち${road.impassable}区画で「通れない」という報告が出ています。移動の途中で引き返せなくなる恐れがある間は、自宅にとどまる判断が現実的です。`;
  }

  if (road.reportCount === 0) {
    return "自宅の周辺からはまだ現地の報告が届いていません。外の状況が分からないうちは、自宅の安全を確かめながらとどまる選択肢を残します。";
  }

  return `自宅の周辺${road.meshCount}区画に「通れない」という報告はありません（${road.reportCount}件の報告）。建物の被害が無く、浸水の恐れが低い場合の選択肢として残します。`;
}

function walkReason(facts: HouseholdFacts, road: RoadFacts): string {
  return `世帯${facts.memberCount}人。徒歩は渋滞の影響を受けず、危ないと感じた場所で引き返せます。周辺の報告は通れる${road.passable}区画・注意${road.caution}区画・通れない${road.impassable}区画です。`;
}

function carReason(facts: HouseholdFacts, road: RoadFacts): string {
  return `車${facts.carCount}台で移動できます。歩くのが難しい家族やペットを一緒に運べる一方、通れない報告は${road.impassable}区画あります。`;
}

function walkRiskNote(facts: HouseholdFacts): string {
  const notes: string[] = [];

  if (hasMobilityConstraint(facts)) {
    const slowCount =
      facts.needsAssistanceCount + facts.infantCount + facts.seniorCount;
    notes.push(
      `移動に配慮が必要な家族が${slowCount}人います。徒歩は時間がかかり、途中で戻れなくなることがあります。`,
    );
  } else {
    notes.push(
      "暗くなってからの徒歩は、足元の穴や側溝が見えず危険が増します。",
    );
  }

  if (facts.petCount > 0) {
    notes.push(`ペット${facts.petCount}匹の受入条件は避難所ごとに違います。`);
  }

  return notes.join("");
}

function carRiskNote(facts: HouseholdFacts): string {
  const base =
    "冠水した道路は車では通れません。渋滞で車内に閉じ込められると、徒歩に切り替えることも難しくなります。";

  return facts.petCount > 0
    ? `${base}ペット${facts.petCount}匹の受入条件は避難所ごとに違います。`
    : base;
}

/**
 * 世帯と周辺の状況から、出してよい選択肢だけを推奨順に並べて返す。
 *
 * 決め方は次のとおり。
 * - 車の選択肢は車を持つ世帯にだけ出す
 * - 上階へ移る選択肢は、外へ出る経路に「通れない」報告があるときだけ出す
 * - 「通れない」報告がある間は、動かない選択肢を上に置く
 * - 報告が落ち着いていて、移動に配慮が必要な家族がいる世帯では車を徒歩より上に置く
 */
export function buildCandidates(
  facts: HouseholdFacts,
  road: RoadFacts,
): EvacuationCandidate[] {
  const available = new Set<OptionKey>(["stay_home", "walk_shelter"]);

  if (facts.hasCar) {
    available.add("car_shelter");
  }
  if (road.impassable > 0) {
    available.add("vertical");
  }

  const order: OptionKey[] =
    road.impassable > 0
      ? ["stay_home", "vertical", "walk_shelter", "car_shelter"]
      : hasMobilityConstraint(facts) && facts.hasCar
        ? ["car_shelter", "walk_shelter", "stay_home"]
        : ["walk_shelter", "car_shelter", "stay_home"];

  const keys = order.filter((key) => available.has(key));

  return keys.map((key, index) => ({
    key,
    rank: index + 1,
    ...describe(key, facts, road),
    switchCriteria: switchCriteriaFor(key, keys),
  }));
}

function describe(
  key: OptionKey,
  facts: HouseholdFacts,
  road: RoadFacts,
): Pick<
  EvacuationCandidate,
  "optionType" | "travelMode" | "title" | "reason" | "riskNote"
> {
  switch (key) {
    case "stay_home":
      return {
        optionType: "stay_home",
        travelMode: "none",
        title: "自宅にとどまる",
        reason: stayHomeReason(road),
        riskNote:
          "助けが必要になったとき、道路が塞がれていると救助が届くまで時間がかかります。水と食料、明かりの備えを確かめてください。",
      };
    case "vertical":
      return {
        optionType: "vertical",
        travelMode: "none",
        title: "建物の上階へ移る",
        reason: `外へ出る経路のうち${road.impassable}区画で「通れない」という報告が出ています。移動が難しい状況では、建物の上階へ移る判断が残ります。`,
        riskNote:
          "上階でも浸水が届く高さでは避けられません。停電と孤立に備え、飲み水と連絡手段を持って上がってください。",
      };
    case "walk_shelter":
      return {
        optionType: "designated_shelter",
        travelMode: "walk",
        title: "徒歩で避難する",
        reason: walkReason(facts, road),
        riskNote: walkRiskNote(facts),
      };
    case "car_shelter":
      return {
        optionType: "designated_shelter",
        travelMode: "car",
        title: "車で避難する",
        reason: carReason(facts, road),
        riskNote: carRiskNote(facts),
      };
  }
}

/**
 * 切り替え基準。切り替え先が候補に無い場合はその基準を落とす。
 *
 * ここで作るしきい値は画面に出して人が判断するための値であり、
 * これを条件に何かを自動実行しない
 * （docs/er/07-safety-moderation.md#プロンプトインジェクションへの対策 の「実行の抑止」）。
 */
function switchCriteriaFor(
  key: OptionKey,
  availableKeys: readonly OptionKey[],
): SwitchCriterion[] {
  const evacuateKey = availableKeys.find(
    (candidate) => candidate === "walk_shelter" || candidate === "car_shelter",
  );

  const criteria: (SwitchCriterion | null)[] = (() => {
    switch (key) {
      case "stay_home":
        return [
          criterion({
            triggerType: "alert_level",
            description:
              "警戒レベル4（避難指示）が出たら、避難する選択肢に切り替えます。",
            thresholdValue: 4,
            thresholdUnit: "レベル",
            comparator: "gte",
            switchToKey: evacuateKey ?? null,
          }),
          criterion({
            triggerType: "observation",
            description:
              "自宅の周りで水が足首より上まで来たら、外へ出ずに上階へ移ります。",
            thresholdValue: 10,
            thresholdUnit: "cm",
            comparator: "gte",
            switchToKey: "vertical",
          }),
        ];
      case "vertical":
        return [
          criterion({
            triggerType: "alert_level",
            description:
              "警戒レベル5（緊急安全確保）が出ている間は、外へ出る判断に戻しません。",
            thresholdValue: 5,
            thresholdUnit: "レベル",
            comparator: "gte",
            switchToKey: null,
          }),
        ];
      case "walk_shelter":
        return [
          criterion({
            triggerType: "daylight",
            description:
              "日没までに避難先へ着けないと判断したら、自宅にとどまる判断へ戻します。",
            switchToKey: "stay_home",
          }),
          criterion({
            triggerType: "observation",
            description:
              "歩く道に膝より上の水があれば、その先へ進まず引き返します。",
            thresholdValue: 50,
            thresholdUnit: "cm",
            comparator: "gte",
            switchToKey: "stay_home",
          }),
        ];
      case "car_shelter":
        return [
          criterion({
            triggerType: "congestion",
            description:
              "渋滞で車が動かなくなったら、車を離れて徒歩に切り替えます。",
            switchToKey: "walk_shelter",
          }),
          criterion({
            triggerType: "rainfall",
            description:
              "1時間雨量が30mmを超えたら、車での移動をやめて自宅にとどまる判断へ戻します。",
            thresholdValue: 30,
            thresholdUnit: "mm/h",
            comparator: "gte",
            switchToKey: "stay_home",
          }),
        ];
    }
  })();

  return criteria
    .filter((entry): entry is SwitchCriterion => entry !== null)
    .filter(
      (entry) =>
        entry.switchToKey === null || availableKeys.includes(entry.switchToKey),
    )
    .map((entry, index) => ({ ...entry, displayOrder: index }));
}

function criterion(
  input: Omit<
    SwitchCriterion,
    "thresholdValue" | "thresholdUnit" | "comparator" | "displayOrder"
  > &
    Partial<
      Pick<SwitchCriterion, "thresholdValue" | "thresholdUnit" | "comparator">
    >,
): SwitchCriterion {
  return {
    thresholdValue: null,
    thresholdUnit: null,
    comparator: null,
    displayOrder: 0,
    ...input,
  };
}

/** 全体の見立て。AI が使えないときはこの文がそのまま summary になる */
export function buildSummary(
  facts: HouseholdFacts,
  road: RoadFacts,
  candidates: readonly EvacuationCandidate[],
): string {
  const head =
    road.impassable > 0
      ? `自宅の周辺で${road.impassable}区画に「通れない」報告が出ています。`
      : road.reportCount === 0
        ? "自宅の周辺からはまだ現地の報告が届いていません。"
        : `自宅の周辺${road.meshCount}区画に「通れない」報告はありません。`;

  const titles = candidates.map((candidate) => candidate.title).join("／");

  return `${head}世帯${facts.memberCount}人・車${facts.carCount}台の条件では、${titles}の順で検討できます。`;
}
