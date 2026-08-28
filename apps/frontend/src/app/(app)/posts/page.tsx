import { FeaturePlaceholder } from "@/components/app-shell/feature-placeholder";

export default function PostsPage() {
  return (
    <FeaturePlaceholder
      eyebrow="Field reports"
      title="地域の状況を共有"
      description="通れた道、注意が必要な場所、通れない道を、迷わず短い操作で共有する画面です。"
      plannedFeatures={["3タップ投稿", "写真の添付", "投稿詳細と信頼度表示"]}
      taskIds="FE-09〜FE-13、FE-18"
    />
  );
}
