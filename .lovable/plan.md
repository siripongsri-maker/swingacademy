# แผน: เชื่อม Knowledge จาก Backend → Public Front End

## 1. Database (Lovable Cloud / Supabase)

สร้างตาราง `knowledge_products` เก็บข้อมูล Knowledge Asset:
- ฟิลด์หลัก: `slug` (unique), `title_th`, `title_en`, `summary`, `key_message`, `content_md`, `language`, `categories[]`, `tags[]`, `audiences[]`, `product_service`, `source`, `source_type`, `cover_url`
- ฟิลด์สถานะ: `status` (draft/in_review/published), `visibility` (internal/public), `is_featured` (boolean), `featured_order` (int), `published_at`, `owner_id`, `approved_by`
- ฟิลด์ sponsor: `sponsors` (jsonb array `{name, role, logo_url}`)
- มาตรฐาน: `id`, `created_at`, `updated_at` + trigger `update_updated_at_column`

**RLS / GRANT**:
- `anon` + `authenticated` อ่านได้เฉพาะแถว `visibility='public' AND status='published'`
- `staff` หรือ `admin` (ใช้ `has_role()`) จัดการได้ทุกแถว (insert/update/delete)
- `service_role` ทำได้ทุกอย่าง

Seed: insert HIVST Community-Led Model 1 แถว `visibility=public, status=published, is_featured=true`

## 2. Server Functions (TanStack Start)

สร้างที่ `src/lib/knowledge.functions.ts`:
- `listPublicKnowledge()` — public, ไม่ต้อง auth (ใช้ supabaseAdmin หรือ anon select) คืนเฉพาะ published+public
- `getPublicKnowledgeBySlug(slug)` — public, 1 แถว
- `listFeaturedKnowledge(limit)` — published+public+featured, sort by `featured_order`
- `listAllKnowledge()` — admin/staff, ทุกแถว (auth middleware)
- `upsertKnowledge(payload)` — admin/staff สร้าง/แก้ไข
- `setKnowledgePublishState({id, status, visibility, is_featured, featured_order})` — toggle publish + featured

## 3. Staff Console (Backend UI)

ที่ `src/routes/staff.knowledge-hub.tsx` (หรือ product knowledge editor ปัจจุบัน):
- เพิ่ม Switch **"Publish to Public"** (เซต `visibility='public' + status='published'` พร้อม `published_at`)
- เพิ่ม Switch **"Feature on Home"** + ช่องลำดับ `featured_order`
- ปุ่ม Save → เรียก `upsertKnowledge` + `setKnowledgePublishState`
- ตารางลิสต์แสดงคอลัมน์ Status / Visibility / Featured

## 4. Public Front End

**Home (`/`)** — Section "Featured Knowledge":
- Loader prime `listFeaturedKnowledge(3)` ผ่าน TanStack Query
- การ์ดแสดง cover / title / summary → ลิงก์ไป `/knowledge/$slug`
- ถ้าว่าง: hide section ทั้งบล็อก

**Index (`/knowledge`)** — สร้างใหม่:
- Loader prime `listPublicKnowledge()`
- Grid list ทุกชิ้นที่ published+public พร้อม filter ตาม category/audience
- Empty state เป็นมิตรถ้ายังไม่มี

**`/knowledge/$slug`** (มีอยู่แล้ว):
- เปลี่ยน loader จาก seed file → เรียก `getPublicKnowledgeBySlug` แทน
- Fallback ไป HIVST seed เฉพาะตอน DB ว่าง (ช่วงเปลี่ยนผ่าน)
- Sponsor footer อ่านจาก `sponsors` column; ถ้าว่าง → DEFAULT_SPONSORS (SWING)

**`/courses` และ `/paths`**:
- เพิ่มแถบ "Knowledge Products" ด้านบน list courses (เรียก `listPublicKnowledge()`)
- การ์ดเล็ก ๆ ชี้ไป `/knowledge/$slug`

## 5. Technical Notes

- ใช้ `createServerFn` + TanStack Query (`ensureQueryData` loader + `useSuspenseQuery` component) ตามรูปแบบของโปรเจกต์
- Public reads ใน loader → ห้ามใช้ `requireSupabaseAuth` (SSR ไม่มี bearer). ใช้ server fn ธรรมดาที่ภายใน `await import("@/integrations/supabase/client.server")` แล้ว query ด้วย service role + filter `visibility='public' AND status='published'`
- Staff writes → ใช้ `requireSupabaseAuth` middleware + ตรวจ role ผ่าน `has_role()` ใน RLS
- Store edit metadata ใน DB; ค่อย ๆ ลด dependency บน localStorage `swing.product-knowledge.v4` (ยังเก็บไว้ก่อนเป็น cache UI ฝั่ง staff)

## 6. ลำดับการทำ

1. Migration: ตาราง + RLS + GRANT + seed HIVST
2. Server fns (`knowledge.functions.ts`)
3. แก้ Staff editor: เพิ่ม Publish/Feature toggle + เรียก server fn
4. แก้ `/knowledge/$slug` ให้อ่านจาก DB
5. สร้าง `/knowledge` index + Featured section บน `/`
6. เพิ่มแถบ Knowledge ใน `/courses` และ `/paths`
7. ทดสอบ: สร้าง draft → toggle publish → ดูบน Public

ยืนยันให้ผมเริ่มได้เลยไหมครับ?
