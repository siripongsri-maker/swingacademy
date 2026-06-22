## ภาพรวม

ปรับ SWING Academy ให้เป็น **Learning Classroom + Community Knowledge Platform** แนว Google Classroom — เรียบง่าย ใช้งานจริง รองรับทีมภาคสนาม โดย **ไม่ลบ** ระบบเดิม (knowledge_products, trainings, knowledge_translations, user_roles, storage buckets) และไม่แตะ RLS เดิมที่ทำงานอยู่

งานแบ่งเป็น 4 เฟส เพื่อให้ตรวจรับทีละขั้น ไม่พังของเดิม

---

## เฟส 1 — Database & RLS (migration เดียว, ปลอดภัย, idempotent)

เพิ่มตารางใหม่ด้วย `CREATE TABLE IF NOT EXISTS` พร้อม GRANT + RLS ตาม policy แต่ละ role (`learner`, `trainer`, `staff`, `admin`). ใช้ฟังก์ชัน `public.has_role()` ที่มีอยู่แล้ว

ตารางใหม่:
- **classrooms** — id, title, description, cover_url, owner_id, created_at, updated_at
- **courses** — id, classroom_id, title, slug (unique per classroom, auto-suffix กัน duplicate), description, cover_url, order_index, owner_id, …
- **lessons** — id, course_id, title, body_md, order_index, owner_id, …
- **assignments** — id, lesson_id, title, instructions, due_at, …
- **enrollments** — id, classroom_id, user_id, role_in_class ('learner'|'trainer'), unique(classroom_id, user_id)
- **lesson_notes** — id, lesson_id, course_id, user_id, body, visibility ('private'|'class'), created_at
- **voice_records** — id, lesson_id, course_id, user_id, title, file_path (training-attachments bucket), duration_sec, mime, created_at
- **course_files** — id, course_id, lesson_id (nullable), file_path, file_name, size, mime, uploaded_by

**RLS รวบสั้น:**
- learner เห็น/แก้ของตัวเอง + อ่าน classroom/course/lesson ที่ enroll
- trainer/staff จัดการ classroom/course/lesson ที่ตัวเองเป็น owner หรือถูก assign
- admin จัดการได้ทุกอย่างผ่าน `has_role(uid,'admin')`
- `lesson_notes.visibility='private'` → เห็นเฉพาะเจ้าของ + staff/admin
- `voice_records` → learner เห็นเฉพาะของตัวเอง, staff/admin/trainer ที่เป็น owner ของ course เห็นทั้งหมด

ใช้ storage bucket **`training-attachments`** เดิมสำหรับเสียง + ไฟล์ (เพิ่ม object-level RLS path-based: `lesson-notes/<user_id>/...`, `voice/<user_id>/...`)

---

## เฟส 2 — Server functions (createServerFn)

ไฟล์ใหม่ใน `src/lib/`:
- `classrooms.functions.ts` — CRUD classroom + enroll/unenroll
- `courses.functions.ts` — CRUD course (slug-uniqueness ตามที่ทำใน knowledge-assets แล้ว)
- `lessons.functions.ts` — CRUD lesson + list by course
- `lesson-notes.functions.ts` — list/create/update/delete note ของผู้ใช้ + staff list ทั้งหมด
- `voice-records.functions.ts` — upload (signed upload URL), list, delete, get signed playback URL
- `assignments.functions.ts` — CRUD + submission (เฟสนี้แค่โครง, full submission ค่อยทำต่อ)

ทุกฟังก์ชันใช้ `requireSupabaseAuth` + ตรวจ role ก่อนการเขียน

---

## เฟส 3 — Public/Learner UI (Google-Classroom-like)

Routes ใหม่ (ทั้งหมดอยู่ใต้ `_authenticated/` ที่มีอยู่):
- `/classroom` — กริดการ์ดห้องเรียนที่ฉัน enroll (Classroom-style cover + title)
- `/classroom/$id` — แท็บ: Stream / Courses / People
- `/classroom/$id/course/$courseId` — รายการ Lesson + ปุ่ม "เข้าเรียน"
- `/classroom/$id/course/$courseId/lesson/$lessonId` — เนื้อหา + sidebar:
  - **Notes panel** (จดโน้ต inline, autosave)
  - **Voice recorder** (MediaRecorder API: เริ่ม/หยุด/ฟัง/บันทึก)
  - **Files** (download list)
  - **Assignment** (ส่งงาน — โครง)
- `/my/notes` — โน้ตของฉันทั้งหมด (filter ตาม course/lesson)
- `/my/voice` — เสียงบันทึกของฉัน

Component ใหม่:
- `<ClassroomCard />`, `<LessonSidebar />`, `<NoteEditor />` (textarea + autosave debounce), `<VoiceRecorder />` (ปุ่ม record/stop/preview/save), `<FileList />`
- ทุกข้อความผ่าน `useLanguage().t({th, en})` ตาม core rule

---

## เฟส 4 — Staff Console (ลดความซับซ้อน + เพิ่มหน้าใหม่)

ปรับ `staff-sidebar.tsx` จัดกลุ่มใหม่ให้เหมือน Classroom admin:
- **ห้องเรียน** — `/staff/classrooms` (จัดการ classroom/course/lesson แบบ tree)
- **งานและส่งงาน** — `/staff/assignments`
- **โน้ตทั้งหมด** — `/staff/notes` (ใหม่ — ดู lesson_notes ทุกคน, filter)
- **เสียงบันทึกทั้งหมด** — `/staff/voice` (ใหม่ — ดู voice_records ทุกคน + play)
- **คลังความรู้ (เดิม)** — รวมเมนู knowledge/product-knowledge/translation เข้ากลุ่มเดียว
- **ไฟล์ Storage** — คงเดิม (`/staff/storage`)
- **ผู้ใช้/บทบาท** — คงเดิม

หน้า capture, knowledge-hub, transfer, talent, trainings เดิม **ไม่ลบ** แค่จัดกลุ่มให้เรียบ

---

## เทคนิคสำคัญ

- **Voice upload**: ใช้ `supabase.storage.from('training-attachments').upload()` ฝั่ง client (มี session อยู่แล้ว) แล้วเรียก server fn บันทึก row ใน `voice_records`
- **Slug**: ใช้ pattern เดียวกับ `knowledge-assets.functions.ts` (`-2`, `-3` …)
- **ไม่แตะ**: `src/integrations/supabase/*` (auto-gen), policies เดิมบน knowledge_products / trainings / user_roles
- **Mobile**: Tailwind responsive, card grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- **Style**: คงโทน SWING เดิม (warm, clean) — ใช้ semantic tokens เท่านั้น

---

## ลำดับ deliverable

1. Migration → ขอ approval ก่อน
2. Server functions
3. Learner UI + recorder/note
4. Staff console refactor + 2 หน้าใหม่ (notes, voice)

ขอ approve plan แล้วเริ่มจาก migration (เฟส 1) ก่อนครับ
