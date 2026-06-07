import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/resources")({
  component: () => (
    <PlaceholderPage
      eyebrow={{ th: "คลังความรู้", en: "Resources" }}
      title={{ th: "คลังความรู้กำลังจะมา", en: "Resource library coming soon" }}
      body={{
        th: "คู่มือ วิดีโอสั้น และแผนที่บริการ — บันทึกสิ่งที่อยากกลับมาดูได้",
        en: "Guides, short videos, and service maps — save anything to come back to it later.",
      }}
    />
  ),
});
