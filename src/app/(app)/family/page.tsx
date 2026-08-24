import { FeaturePlaceholder } from "@/components/app-shell/feature-placeholder";

export default function FamilyPage() {
  return (
    <FeaturePlaceholder
      eyebrow="Household"
      title="家族の備えと状況"
      description="家族構成や要配慮事項を登録し、災害時には家族それぞれの状況を確認する画面です。"
      plannedFeatures={["家族構成・自宅情報", "個人情報の編集", "家族の避難状況共有"]}
      taskIds="FE-07、FE-16"
    />
  );
}
