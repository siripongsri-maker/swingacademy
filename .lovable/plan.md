
# Visualize & Publish Knowledge Translation

ทำให้หน้า `/staff/knowledge-translation` แสดงผล "ตามรูปแบบจริง" (Social Caption, Carousel, Infographic, FAQ, Flow Chart, Poster, Slide, HTML, Learning Card, Video Script ฯลฯ) มี **Preview** ก่อน Publish และพอ Publish จะไป **แสดงบนหน้าเว็บความรู้จริง** (`/k/<slug>` / `/knowledge/<slug>`) เป็นส่วนหนึ่งของเนื้อหา พร้อม **ระบุผู้สร้างเป็น Contributor**

## สิ่งที่จะทำ

### 1) Format renderers (Visualize)
สร้าง `src/components/translation-renderers/` แต่ละไฟล์รับ markdown + meta แล้ว render เป็น UI จริง:
- **social_caption / campaign_message** → การ์ดโพสต์โซเชียล (avatar SWING, ข้อความ, hashtag)
- **carousel** → สไลด์เลื่อนซ้าย-ขวา (1 ## = 1 สไลด์)
- **infographic_text / poster_concept** → กรอบโปสเตอร์แนวตั้ง gradient + bullets
- **short_article / training_handout / micro_learning** → บทความ prose
- **learning_card** → flip card หน้า/หลัง
- **faq** → accordion (Q: / A: คู่)
- **chatbot_script / script / short_video_script** → bubble chat / scene blocks
- **slide_outline** → 16:9 slide deck (## = title, bullets = body)
- **flow_chart** → ถ้า output มี mermaid block → render mermaid, ไม่มีก็ ordered steps
- **html_page** → iframe sandbox preview ของ HTML block
- fallback → ReactMarkdown

ทุก renderer มีปุ่ม "ดูเป็น Markdown" toggle

### 2) Preview ในหน้า Editor
- เพิ่ม Tabs: **Edit / Preview** (default Preview หลัง generate)
- Preview เรียก renderer ตาม `format` ที่เลือก เห็นหน้าตาเหมือนตอน publish จริง
- ปุ่ม "Preview on site" เปิด modal เต็มจอจำลองหน้า `/knowledge/<slug>` พร้อม section translation นี้

### 3) Publish → ขึ้นหน้าเว็บจริง
ตอนนี้ translations เก็บใน localStorage เท่านั้น จึงไม่มีทางขึ้นหน้า public ต้องย้ายเป็น DB-backed:

**Migration** `knowledge_translations`:
```
id uuid pk, asset_id uuid fk knowledge_products(id) on delete cascade,
audience text, format text, tone text, language text,
instruction text, output_md text, status text check (draft|ready|published),
title text null, contributor_id text null (person id ใน seed),
owner_id uuid references auth.users, published_at timestamptz,
created_at, updated_at
```
- GRANT SELECT to anon (เฉพาะ published), GRANT ALL to authenticated/service_role
- RLS: anon อ่าน `status='published'` + asset.visibility='public'; staff/admin เขียน

**Server functions** `src/lib/knowledge-translations.functions.ts`:
- `listTranslations({assetId?})` — staff
- `saveTranslation({id?, patch})` — staff/admin
- `removeTranslation({id})` — staff/admin
- `listPublishedTranslationsForAsset({slug})` — public (admin client + filter)

**Store** `product-knowledge-store.tsx`: ย้าย translations จาก localStorage ไป useQuery + server fn (รูปแบบเดียวกับ talent mappings ที่เพิ่งทำ) — optimistic update เพื่อความลื่น

### 4) แสดงบนหน้า Public
ใน `src/routes/knowledge.$slug.tsx` (และ `k.$slug.tsx` ที่ render เดียวกัน) หลัง section บทเรียน เพิ่ม:

**"📣 รูปแบบเผยแพร่ · Published Formats"** — แสดง translations ที่ `status='published'` ของ asset นี้ เป็นการ์ดเรียง grid โดย render ด้วย renderer เดียวกับ Preview (social card, carousel, slide ฯลฯ) ผู้ใช้กดเปิดดูเต็มได้

**Contributor**: แต่ละการ์ดมี chip "โดย <ชื่อคน>" ดึงจาก:
1. `contributor_id` ถ้าเลือกใน editor (จาก seed people เช่น Sakda)
2. ถ้าไม่เลือก → fallback เป็น owner ของ translation (จาก auth user / profile) หรือ owner ของ asset

ในหน้า editor เพิ่ม dropdown "Contributor" เลือก person จาก `seed.staffConsole.people` (เลือกหลายคนได้ในรอบต่อไป รอบนี้เอา 1 คน)

### 5) UX เล็กน้อย
- การ์ดในลิสต์ `/staff/knowledge-translation` แสดง thumbnail mini ตาม format แทนที่จะเป็นข้อความล้วน
- ปุ่ม Publish เปลี่ยนเป็น disabled เมื่อ output ว่าง + toast บอก "เผยแพร่ไปที่ /knowledge/<slug> แล้ว" พร้อม link

## รายละเอียดเทคนิค

- Mermaid: ใช้ `mermaid` package (lazy import, client-only ผ่าน `<ClientOnly>` หรือ effect) ถ้าไม่มีก็ install
- HTML preview: `<iframe sandbox srcDoc={html} />` ดึง code block ` ```html ` ตัวแรก
- Carousel: ใช้ `@/components/ui/carousel` ที่มีอยู่แล้ว
- Renderer dispatcher: `<TranslationRenderer format=... outputMd=... />` map id → component
- Public read: server fn ใช้ `supabaseAdmin` + filter `status='published'` และ asset.visibility='public' (เหมือน pattern ที่มีอยู่)
- localStorage cleanup: ลบ translations ออกจาก LS_KEY หลัง migrate

## ที่จะแก้/สร้าง
- **New**: `supabase/migrations/<ts>_knowledge_translations.sql`, `src/lib/knowledge-translations.functions.ts`, `src/components/translation-renderers/{index.tsx, social-card.tsx, carousel-deck.tsx, slide-deck.tsx, faq-accordion.tsx, infographic.tsx, learning-card.tsx, chat-script.tsx, html-preview.tsx, flow-chart.tsx}`
- **Edit**: `src/lib/product-knowledge-store.tsx` (translations → DB), `src/routes/staff.knowledge-translation.tsx` (tabs Edit/Preview, contributor select, thumbnails), `src/routes/knowledge.$slug.tsx` + `src/routes/k.$slug.tsx` (section "Published Formats"), `src/lib/knowledge.functions.ts` (publicGetBySlug รวม translations หรือเพิ่ม fn แยก)

## คำถามก่อนเริ่ม
1. ฟิลด์ **Contributor** ให้เลือกได้กี่คน — 1 คน (เริ่มต้น) หรือหลายคน?
2. Translation ที่ publish แล้วให้แสดง "ในหน้าความรู้เดิม" (รวมเป็น section ใหม่ใต้บทเรียน) หรือ "หน้าย่อยใหม่" `/knowledge/<slug>/formats/<translation-id>` ด้วย?
