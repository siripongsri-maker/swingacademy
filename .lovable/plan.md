
## ปัญหาที่ตรวจพบ

ระบบความรู้ตอนนี้มี **2 แหล่งข้อมูลแยกกันโดยสิ้นเชิง** ไม่ sync กัน:

### แหล่งที่ 1 — Database (Supabase `knowledge_products`)
- หน้าบ้านอ่านจากตรงนี้ทั้งหมด: `/knowledge`, `/knowledge/$slug`, FeaturedKnowledgeSection (ใช้ `listPublicKnowledge`, `getPublicKnowledgeBySlug`, `listFeaturedKnowledge`)
- ปัจจุบันมีแค่ 2 รายการ: `thailand-gender-justice-hiv-tb-2025`, `hivst-community-led-model`

### แหล่งที่ 2 — localStorage (`swing.product-knowledge.v4`)
- หลังบ้านอ่าน/เขียนจากตรงนี้: `/staff/knowledge`, `/staff/product-knowledge`, `/staff/capture`, `/staff/knowledge-hub` ทั้งหมดใช้ `useProductKnowledge()` ซึ่งเป็น React context + localStorage
- เริ่มต้นด้วย seed `HIVST_KNOWLEDGE_ASSET` ตัวเดียว
- **เก็บแยกตามเครื่อง/เบราว์เซอร์** — staff คนละเครื่องเห็นข้อมูลคนละชุด

### จุดที่ "พยายาม" sync (แต่ไม่ครบ)
มีเฉพาะใน `src/routes/staff.knowledge.tsx` ตอนกด Approve / Publish / Unpublish ที่เรียก `publishKnowledgeBySlug` ส่งขึ้น DB

### ผลกระทบจริง
1. ความรู้ที่เพิ่มผ่าน `/staff/product-knowledge` หรือ `/staff/capture` → ถูกเก็บแค่ใน localStorage ของเครื่องนั้น **ไม่มีทางขึ้นหน้าบ้าน** เว้นแต่จะเปิดหน้า `/staff/knowledge` แล้วกด Approve/Publish ด้วยตัวเอง (ซึ่งหลายคนไม่รู้)
2. ความรู้ที่อยู่ใน DB (เช่น `thailand-gender-justice-hiv-tb-2025`) → หลังบ้านไม่เห็น เพราะหลังบ้านไม่เคยอ่าน DB เลย เห็นแค่ HIVST seed ในเครื่องตัวเอง
3. Staff คนละเครื่อง → เห็น draft คนละชุด รีวิวกันไม่ได้
4. เคลียร์ cache เบราว์เซอร์ = ข้อมูลหายหมด

---

## แผนแก้: ใช้ DB เป็น Single Source of Truth

### A. ฝั่ง Server (server functions)
1. ขยาย `src/lib/knowledge.functions.ts`:
   - ปรับ `listAllKnowledge` ให้คืน field ครบสำหรับ staff view (มี contentMd, sponsors, audiences, source ฯลฯ อยู่แล้ว — ตรวจให้ครบ)
   - เพิ่ม `createKnowledgeDraft` — สร้าง row ใหม่ใน DB จากหน้า `/staff/product-knowledge` และ `/staff/capture` (status=`draft`, visibility=`internal`)
   - เพิ่ม `updateKnowledgeContent` — อัปเดต field ทั่วไป (titleTh, summary, contentMd, categories, tags, audiences ฯลฯ) โดยไม่แตะ status/visibility
   - ใช้ `requireSupabaseAuth` ทุก write; `owner_id = context.userId`
2. ตรวจ RLS / GRANT บน `knowledge_products` ว่ารองรับ insert/update ของ role `authenticated` ที่เป็น staff (ถ้ายังไม่มี policy ให้เพิ่ม migration)

### B. ฝั่ง Client (เลิกใช้ localStorage เป็นแหล่งหลัก)
1. แปลง `useProductKnowledge()` ให้เป็น wrapper รอบ **TanStack Query** ที่:
   - `assets` มาจาก `listAllKnowledge` (queryKey `["knowledge","staff","all"]`)
   - `createAsset` → เรียก `createKnowledgeDraft` แล้ว invalidate ทั้ง staff list และ public list
   - `updateAsset` → เรียก `updateKnowledgeContent` / `setKnowledgePublishState` ตามฟิลด์ที่เปลี่ยน
   - `removeAsset` → เรียก `deleteKnowledge`
   - ส่วน `translations` / `collections` / `talentMappings` (ที่ยังไม่มีตาราง DB) คงไว้ที่ localStorage ชั่วคราว และทำ TODO note
2. ใน mutation success ทุกตัว → invalidate `["knowledge","public","all"]`, `["knowledge","featured"]`, `["knowledge","public",slug]`, `["knowledge","staff","all"]` พร้อมกัน เพื่อให้หน้าบ้าน/หลังบ้านเห็นทันทีโดยไม่ต้อง refresh
3. ลบ logic seed `HIVST_KNOWLEDGE_ASSET` ออกจาก initial state (ตัวจริงอยู่ใน DB แล้ว) แต่คงไฟล์ seed ไว้สำหรับ fallback content

### C. Migration ข้อมูลเก่า (one-time, optional)
- เพิ่มปุ่มเล็กๆ ใน `/staff/knowledge` "นำเข้า draft จากเครื่องนี้ขึ้น cloud" — อ่าน localStorage เก่า เรียก `createKnowledgeDraft` ทีละรายการ แล้วล้าง key เพื่อไม่ให้ขัดกับ DB ในอนาคต

### D. ตรวจสอบหลังทำ
- เพิ่มความรู้ใหม่ที่ `/staff/product-knowledge` → ต้องเห็นใน `/staff/knowledge` ทันที (ทั้งบนเครื่องอื่นด้วย)
- กด Approve → เห็นใน `/knowledge` ภายในวินาที (ไม่ต้อง reload)
- ความรู้ใน DB ที่ไม่ได้เพิ่มผ่าน UI ก็เห็นในหลังบ้าน

---

## รายละเอียดทางเทคนิค

- ตาราง `knowledge_products` มี field ครบสำหรับทุก use case ใน staff store แล้ว ยกเว้น: `type`, `learningObjectives`, `competencyTags`, `relatedServices`, `relatedCourses`, `linkedCurriculum`, `qaChecklist`, `attachments`, `versionHistory` — แนะนำเพิ่ม column `metadata jsonb` ใน migration เดียวเพื่อเก็บส่วน "Phase 4 KM" โดยไม่ต้องสร้างหลายคอลัมน์ (และไม่กระทบ schema สาธารณะ)
- เลิก export `slugify` จาก store แล้วใช้ slug validation ฝั่ง server เป็นหลัก (มี regex ใน UpsertSchema อยู่แล้ว)
- ระวัง: ถ้า role policies ของ `knowledge_products` ปัจจุบันอนุญาตเฉพาะ admin เขียน → ต้องเพิ่ม policy ให้ staff/trainer สร้าง draft ของตัวเองได้ (ใช้ `has_role` + `owner_id = auth.uid()`)

ผลลัพธ์: หน้าบ้านและหลังบ้านอ่าน/เขียนตารางเดียวกัน, real-time consistency, ไม่มีข้อมูลซ่อนอยู่ใน localStorage อีกต่อไป
