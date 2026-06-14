
## ปัญหาที่เจอจริงในโค้ด

1. **"เชื่อมแล้วหายอยู่เรื่อยๆ"** — `talentMappings` ในไฟล์ `src/lib/product-knowledge-store.tsx` เก็บใน **localStorage** เท่านั้น (key `swing.product-knowledge.local.v1`) ไม่ได้อยู่ใน DB จึง:
   - หายเมื่อล้าง cache / เปลี่ยน browser / ใช้ device อื่น
   - คนละเครื่องเห็นไม่ตรงกัน
   - หน้าบ้าน/หลังบ้านไม่ sync เพราะ mapping ผูกกับเครื่องผู้ใช้
2. **ลิงก์ `/k/community-led-health-work-swing`** มี alias redirect ไป `hivst-community-led-model` (มีจริงใน DB) อยู่แล้ว → ใช้ได้ แต่ยังไม่มีการผูกความรู้ตัวนี้กับ Sakda (`p-sakda-unkarnkamol`)
3. **หน้า `/staff/talent` โชว์ทุกคนใน `seed.staffConsole.people`** (รวมคนที่ไม่มี mapping เลย) — ผู้ใช้อยากให้โชว์เฉพาะคนที่มีการเชื่อมความรู้/อบรมจริง

## สิ่งที่จะทำ

### 1) สร้างตารางใน DB (1 migration)

`public.knowledge_talent_mappings`
- `id uuid pk`
- `person_id text not null` — อ้างอิง id ของคนใน `seed-data.json` (เช่น `p-sakda-unkarnkamol`)
- `asset_id uuid not null references knowledge_products(id) on delete cascade`
- `role text not null check in ('contributor','reviewer','trainer','practitioner','expert')`
- `evidence jsonb not null default '[]'` — เก็บ array ของ {id, type, note, date}
- `created_at`, `updated_at` (trigger `update_updated_at_column`)
- `unique (person_id, asset_id)`

RLS + GRANT:
- `GRANT SELECT ON ... TO anon` (สำหรับโชว์บนหน้าบ้านในอนาคต/หน้า talent map สาธารณะ)
- `GRANT ALL TO authenticated, service_role`
- Policy: SELECT public, INSERT/UPDATE/DELETE เฉพาะ staff/admin (`has_role`)

### 2) Server functions ใหม่ — `src/lib/talent-mappings.functions.ts`
- `listTalentMappings()` — SELECT ทั้งหมด (public read)
- `upsertTalentMapping({ personId, assetId, role })` — staff guard
- `removeTalentMapping({ id })` — staff guard
- `addTalentEvidence({ mappingId, evidence })` / `removeTalentEvidence({ mappingId, evidenceId })` — staff guard, แก้ jsonb

### 3) แก้ `src/lib/product-knowledge-store.tsx`
- ย้าย `talentMappings` ออกจาก `LocalState` (localStorage)
- เปลี่ยนเป็น `useQuery(['talent-mappings'])` + `useServerFn`
- mutation ทั้งหมด invalidate query → sync ทุก surface ทันที
- Translations/Collections ยังอยู่ใน localStorage เหมือนเดิม (ไม่ใช่ scope ครั้งนี้)

### 4) เชื่อม Sakda กับความรู้ "HIVST Community-led Model" (seed ผ่าน migration)
- INSERT mapping: `person_id='p-sakda-unkarnkamol'`, `asset_id=eb37dbe4-c78e-4f1c-810a-c35261f96157`, `role='practitioner'`
- (ผู้ใช้ปรับ role/เพิ่ม evidence ผ่าน UI ภายหลังได้)

### 5) หน้า `/staff/talent` — โชว์เฉพาะคนที่ "ถูกเชื่อม/เคยอบรม"
- คำนวณ `linkedPersonIds = Set(km.talentMappings.map(m => m.personId))`
- เพิ่ม union กับ trainings: ดึง `trainings` ที่มี `person_id` ใน participants (ถ้ามี field นี้) — *ต้องเช็คโครงสร้าง `trainings` ก่อนใน implementation; ถ้ายังไม่มีการผูกคน ให้ใช้เฉพาะ mapping ก่อน*
- เปลี่ยน `people` base list → `people.filter(p => linkedPersonIds.has(p.id))`
- เพิ่ม toggle "แสดงทุกคน" (default ปิด) เพื่อให้ staff ยังเพิ่มคนใหม่เข้ามาผูกได้
- ใน Drawer ของแต่ละคน: ปุ่ม "เพิ่มการเชื่อมความรู้" ยังทำงานปกติ (เรียก server fn)

### 6) Verify
- เปิด `/k/community-led-health-work-swing` → redirect → เห็น Sakda ใน "ผู้รู้/practitioner" (ถ้าหน้า detail แสดง linked people — ตรวจดู ถ้าไม่มีจะเพิ่มภายหลังตามขอ)
- เปิด `/staff/talent` → เห็น Sakda card (เพราะมี mapping) ไม่เห็นคนที่ไม่มี mapping
- เพิ่ม mapping ใหม่ → reload หน้า → ยังอยู่ (ไม่หาย)
- เปิดอีก browser / incognito → เห็นเหมือนกัน

## หมายเหตุเทคนิค

- ตอนนี้ `people` ยังเป็น seed JSON ฝั่ง client — ใช้ `person_id text` ในตารางใหม่จึงไม่ผูก FK กับ DB (ยืดหยุ่นพอ); ถ้าต้องการย้าย people เข้า DB ค่อยทำเป็นรอบถัดไป
- ไม่แก้ไฟล์ auto-gen (`types.ts`, `routeTree.gen.ts`) — TanStack/Supabase regen เอง
- ไม่กระทบ knowledge sync ที่เพิ่งแก้ไป
