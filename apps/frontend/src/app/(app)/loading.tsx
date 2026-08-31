import { StateMessage } from "@/components/state/state-message";

/**
 * 画面の読み込み中に出す表示（FE-20）。
 *
 * 中身の形を真似た骨組みではなく、文言を出す。災害時は回線が細く、
 * 骨組みだけが長く出ていると「壊れて止まった」と読まれる。
 */
export default function AppSegmentLoading() {
  return (
    <StateMessage
      symbol="⏳"
      title="読み込んでいます"
      description="通信が不安定なときは時間がかかることがあります。そのままお待ちください。"
    />
  );
}
