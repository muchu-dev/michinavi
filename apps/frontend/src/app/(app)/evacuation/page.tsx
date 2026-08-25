import { FeaturePlaceholder } from "@/components/app-shell/feature-placeholder";

export default function EvacuationPage() {
  return (
    <FeaturePlaceholder
      eyebrow="Evacuation"
      title="避難の選択肢を比較"
      description="徒歩・車・在宅避難を並べ、状況が変わったときの切り替え基準まで確認できる画面です。"
      plannedFeatures={[
        "AIが示す3つの選択肢",
        "近隣の避難所",
        "徒歩／車の経路比較",
      ]}
      taskIds="FE-14、FE-15"
    />
  );
}
