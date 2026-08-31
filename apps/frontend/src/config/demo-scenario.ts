/**
 * 発表で見せる操作の並び（FE-21）。
 *
 * CO-03（デモシナリオを決める）がまだ未着手のため、この並びは叩き台である。
 * 決まったらここを直し、docs/demo/scenario.md と合わせる。
 *
 * 台本を文章だけで持つと、画面が増減したときに古くなったことに誰も気づかない。
 * ステップを配列で持ち、行き先の画面が実在するかをテストで検査する。
 */

export type DemoStep = {
  /** 通し確認の記録に使う。並びを変えても記録が壊れないよう order とは別に持つ */
  id: string;
  order: number;
  title: string;
  /** 開く画面。src/app 配下に実在することをテストで検査する */
  route: string;
  /** 実際に指を動かす操作 */
  operation: string;
  /** そのとき口で言うこと */
  talkingPoint: string;
  /** この画面を見せるのに要るデータ。BE-26 が入るまでは手で用意する */
  requires: string;
  /** まだ実装が無いときに代わりに見せるもの。実装済みなら null */
  fallback: string | null;
};

export const demoScenario: readonly DemoStep[] = [
  {
    id: "map-overview",
    order: 1,
    title: "地図で近所の状況を見る",
    route: "/",
    operation: "アプリを開き、地図の3色（通行可・注意・通行不可）を指し示す",
    talkingPoint:
      "災害時に最初に知りたいのは『いま、その道が通れるか』です。予報でも避難所の場所でもなく、目の前の道です。",
    requires: "対象地区の道路状態（BE-16 の推定、または手で入れた投稿）",
    fallback: "推定データが無い場合は、固定で描いている3本の道を説明に使う",
  },
  {
    id: "post-report",
    order: 2,
    title: "その場の状況を投稿する",
    route: "/posts",
    operation: "『通れない』を選んで送信する（3タップ）",
    talkingPoint:
      "一次情報は住民しか持っていません。文章を書かせず、3タップで送れることが投稿数を決めます。",
    requires: "ログイン済みのアカウントと、自宅地区の登録",
    fallback: "投稿画面が未接続の場合は、投稿の設計（3タップ）だけを説明する",
  },
  {
    id: "map-after-post",
    order: 3,
    title: "投稿が地図に反映される",
    route: "/",
    operation: "地図へ戻り、同じ地点のピンを開く",
    talkingPoint:
      "同じ場所への複数の投稿は1つのカードにまとまります。件数が多い地点ほど、状態の確からしさが上がります。",
    requires: "手順2の投稿が保存されていること",
    fallback: "反映が間に合わない場合は、あらかじめ入れた投稿のピンを開く",
  },
  {
    id: "evacuation-options",
    order: 4,
    title: "避難の選択肢を見る",
    route: "/evacuation",
    operation: "自宅待機・徒歩・車の3つと、切り替えの基準を読み上げる",
    talkingPoint:
      "AIは『避難してください』とは言いません。選択肢と、どうなったら切り替えるかを出します。決めるのは本人です。",
    requires: "世帯の登録（人数・車の有無）と、周辺の道路状態",
    fallback: "生成が間に合わない場合は、決定論的な3つの選択肢を見せる",
  },
  {
    id: "family-status",
    order: 5,
    title: "家族の状況を共有する",
    route: "/family",
    operation: "家族の一覧と、それぞれの状況を見せる",
    talkingPoint:
      "地図は出しません。居場所ではなく『無事かどうか』だけを共有します。",
    requires: "家族の登録",
    fallback: "未実装の場合は画面の設計だけを見せる",
  },
] as const;

/** 発表の持ち時間（分）。1 周がこの中に収まるかを通し確認で計る */
export const demoTimeboxMinutes = 5;
