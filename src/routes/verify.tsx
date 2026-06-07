import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/verify")({
  component: () => (
    <PlaceholderPage
      eyebrow={{ th: "ตรวจสอบใบประกาศ", en: "Verify certificate" }}
      title={{ th: "ตรวจสอบใบประกาศของเรา", en: "Verify a SWING certificate" }}
      body={{
        th: "ใส่รหัสใบประกาศเพื่อตรวจสอบว่าผ่านการอบรมจริง — เร็วๆ นี้",
        en: "Enter a certificate code to confirm it's genuine — coming soon.",
      }}
    />
  ),
});
