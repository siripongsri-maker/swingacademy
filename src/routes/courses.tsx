import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/courses")({
  component: () => (
    <PlaceholderPage
      eyebrow={{ th: "คอร์ส", en: "Courses" }}
      title={{ th: "คอร์สเรียนกำลังจะมา", en: "Courses coming soon" }}
      body={{
        th: "เร็วๆ นี้ คุณจะพบคอร์สเรื่องสุขภาพทางเพศ สิทธิ ทักษะชีวิต และการดูแลใจ ฟรีทั้งหมด",
        en: "Soon you'll find free courses on sexual health, rights, life skills, and wellbeing.",
      }}
    />
  ),
});
