import type { KnowledgeAsset } from "@/lib/product-knowledge-store";
import contentMd from "./hivst-content.md?raw";

export const HIVST_KNOWLEDGE_ASSET: KnowledgeAsset = {
  id: "pk_hivst_community_led_model",
  slug: "hivst-community-led-model",
  titleTh: "โมเดลการตรวจเอชไอวีด้วยตนเองที่นำโดยชุมชน",
  titleEn: "A Community-Led Model for HIV Self-Testing",
  summary:
    "โมเดล HIVST ของ SWING ที่นำโดยชุมชน · บทเรียนเก้าปีจากการเข้าถึง สู่การดูแล · ฉบับ testD (มิถุนายน 2026)",
  type: "research_summary",
  categories: ["health", "community"],
  productService: "testD · HIV Self-Testing",
  audiences: ["staff", "partners", "funders", "community"],
  keyMessage:
    "การเข้าถึงเป็นเพียงครึ่งทาง โมเดลนี้จะได้ผลก็ต่อเมื่อ ‘การรู้สถานะของตัวเอง’ กับ ‘การได้รับการดูแล’ เชื่อมถึงกัน",
  contentMd,
  source: "SWING · testD Platform",
  sourceType: "internal",
  tags: ["HIVST", "community-led", "testD", "harm-reduction", "SWING"],
  language: "th",
  status: "published",
  visibility: "public",
  ownerId: "swing_academy",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-08T00:00:00.000Z",
  versionHistory: [
    { v: "1.0", at: "2026-06-01T00:00:00.000Z", by: "SWING Academy", note: "เผยแพร่ฉบับแรก" },
  ],
  attachments: [],
  learningObjectives: [
    "เข้าใจหลักการ Community-Led ของบริการ HIVST",
    "เห็นเส้นทางบริการจาก ‘ขอรับชุดตรวจ’ จนถึง ‘การได้รับการดูแล’",
    "อ่านตัวเลขแดชบอร์ด testD ได้ในฐานะโอกาสในการออกแบบ ไม่ใช่ความล้มเหลว",
    "นำบทเรียน 6 ข้อไปใช้ปรับบริการของทีมตัวเอง",
  ],
  competencyTags: ["HIVST", "Care & Support", "Privacy by design", "Community ownership"],
  qaChecklist: {
    titleClear: true,
    keyMessageOk: true,
    sourceCited: true,
    languageOk: true,
    nonStigmatizing: true,
    expertReviewed: true,
  },
  approvedAt: "2026-06-08T00:00:00.000Z",
  approvedBy: "SWING Academy",
};

export type Sponsor = { name: string; logoUrl?: string; role?: string };

// Default sponsor block when a knowledge product has no specific funders
export const DEFAULT_SPONSORS: Sponsor[] = [
  { name: "SWING Academy", role: "ผู้เผยแพร่ / Publisher" },
];

export const HIVST_SPONSORS: Sponsor[] = [
  { name: "SWING", role: "องค์กรหลัก / Lead organization" },
  { name: "testD Platform", role: "แพลตฟอร์มบริการ / Service platform" },
];
