import { createFileRoute, redirect } from "@tanstack/react-router";

// รวมหน้า "ผลิตภัณฑ์" เข้ากับ "จัดการความรู้" เพื่อลดความสับสน
// ความรู้สาธารณะที่จะไปโผล่บนเว็บไซต์ จัดการได้ที่ /staff/knowledge
export const Route = createFileRoute("/staff/products")({
  beforeLoad: () => {
    throw redirect({ to: "/staff/knowledge" });
  },
});
