## ปัญหา
ลิงก์เก่า `https://swingacademy.life/knowledge/community-led-health-work-swing` ขึ้น "ไม่พบเนื้อหานี้" เพราะ slug ใน DB เปลี่ยนเป็น `hivst-community-led-model` แล้ว ลิงก์ที่เคยแชร์ออกไป (รวมถึง `/k/community-led-health-work-swing` ที่ถูก redirect ต่อมาที่ `/knowledge/...`) เลยเสีย

## แผนแก้

### 1) เพิ่มไฟล์ slug alias map
สร้าง `src/lib/knowledge-slug-aliases.ts` เก็บ map ของ slug เก่า → slug ปัจจุบัน ในรูป constant:
```
export const KNOWLEDGE_SLUG_ALIASES: Record<string, string> = {
  "community-led-health-work-swing": "hivst-community-led-model",
};
```
ออกแบบให้เพิ่ม alias ตัวอื่นในอนาคตได้ง่าย ที่จุดเดียว

### 2) ทำ redirect ใน route `/knowledge/$slug`
แก้ `src/routes/knowledge.$slug.tsx` — เพิ่ม `beforeLoad` ที่เช็ค `params.slug` กับ alias map ถ้าพบ → `throw redirect({ to: "/knowledge/$slug", params: { slug: aliases[params.slug] }, replace: true })`

จุดสำคัญ:
- ใช้ `replace: true` เพื่อไม่ให้กด back แล้ววนกลับมาหน้า not-found
- วาง `beforeLoad` ก่อน loader เพื่อ redirect ตั้งแต่ก่อนยิง query
- ทำงานทั้งฝั่ง SSR (link ที่แชร์ออกไป) และ client navigation

### 3) ทำเช่นเดียวกันที่ `/k/$slug`
แก้ `src/routes/k.$slug.tsx` ให้ resolve alias ก่อน redirect ไป `/knowledge/$slug` — เพื่อกัน double-hop (ตอนนี้ `/k/old` → `/knowledge/old` → not-found; หลังแก้จะเป็น `/k/old` → `/knowledge/current` ทีเดียว)

### 4) ตรวจสอบหลังทำ
- เปิด `/knowledge/community-led-health-work-swing` → ต้องเด้งไป `/knowledge/hivst-community-led-model` ทันที
- เปิด `/k/community-led-health-work-swing` → เด้งไป `/knowledge/hivst-community-led-model` (hop เดียว)
- Slug ที่ไม่มีจริงและไม่มี alias → ยังขึ้น "ไม่พบเนื้อหานี้" เหมือนเดิม

## รายละเอียดทางเทคนิค
- ไม่แก้ DB ไม่แก้ schema — เป็น redirect ระดับ route อย่างเดียว
- ไม่กระทบ slug ปัจจุบันหรือ SEO ของหน้าจริง (เป็น 307/308-style client redirect ผ่าน TanStack Router; ถ้าต้องการ 301 จริง ค่อยขยับไปทำที่ edge ภายหลัง — ไม่อยู่ในขอบเขตงานนี้)
- ไฟล์ที่แก้: `src/routes/knowledge.$slug.tsx`, `src/routes/k.$slug.tsx`; สร้าง `src/lib/knowledge-slug-aliases.ts`
