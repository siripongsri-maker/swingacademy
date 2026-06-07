import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/paths")({
  component: () => (
    <PlaceholderPage
      eyebrow={{ th: "เส้นทางเรียนรู้", en: "Learning paths" }}
      title={{ th: "เส้นทางเรียนรู้กำลังจะมา", en: "Learning paths coming soon" }}
      body={{
        th: "เส้นทางที่จัดเรียงเป็นลำดับ ช่วยให้คุณค่อยๆ เรียนรู้ทีละขั้น",
        en: "Curated step-by-step journeys so you can learn at your own pace.",
      }}
    />
  ),
});
