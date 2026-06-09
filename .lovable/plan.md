
# แปลทั้งแอปเป็นไทย + ตัวสลับภาษา TH/EN

ตอนนี้ `LanguageProvider` มีอยู่แล้วใน `src/lib/language-context.tsx` ใช้รูปแบบ `t({th, en})` แต่ใช้แค่บางหน้า ส่วนคอนโซลเจ้าหน้าที่ (`/staff/*`) ส่วนใหญ่เขียนข้อความไว้แบบฝังในไฟล์ (ผสมไทย-อังกฤษ) ยังไม่ได้รองรับสลับภาษา

ขอบเขตงานใหญ่มาก (27 หน้า + คอมโพเนนต์ รวม ~11,000 บรรทัด) จะแบ่งเป็นเฟส และเริ่มจากโครงสร้าง + หน้าสาธารณะก่อน

## เฟส 1 — โครงสร้าง i18n และตัวสลับภาษา
- ขยาย `language-context.tsx`: เพิ่ม dictionary แบบ namespace `t("nav.home")` ควบคู่ของเดิม `t({th, en})` ที่ยังใช้ได้
- สร้าง `src/lib/i18n/dictionaries.ts` แยกเป็น namespace: `common`, `nav`, `auth`, `home`, `courses`, `paths`, `trainings`, `resources`, `dashboard`, `verify`, `staff.*`
- สร้างคอมโพเนนต์ `<LanguageToggle />` (ปุ่มสลับ TH/EN) วางไว้:
  - หน้าสาธารณะ: `site-header.tsx` (มุมขวาบน เคียงปุ่มล็อกอิน)
  - คอนโซลเจ้าหน้าที่: `staff-topbar.tsx`
- ตั้งค่าเริ่มต้นเป็น **ไทย** (ปัจจุบันเป็นไทยอยู่แล้ว ✓)
- บันทึกค่าใน `localStorage` (มีอยู่แล้ว ✓)

## เฟส 2 — หน้าสาธารณะ (frontend ผู้ใช้)
แปลให้ครบทุกข้อความ + เชื่อมกับ `t()`:
- `index.tsx` (หน้าแรก)
- `courses.tsx`, `courses.$id.tsx`
- `paths.tsx`, `trainings.tsx`, `resources.tsx`
- `knowledge.index.tsx`, `knowledge.$slug.tsx`, `k.$slug.tsx`
- `dashboard.tsx`, `verify.tsx`, `auth.tsx`
- คอมโพเนนต์: `site-header`, `site-footer`, `sign-in-modal`, `course-card`, `placeholder-page`, `certificate-preview-modal`, `onboarding-tour`, `featured-knowledge-section`

## เฟส 3 — คอนโซลเจ้าหน้าที่ (backend)
แปลทุกหน้า `/staff/*` พร้อมเมนู sidebar (ตอนนี้แสดง EN + คำบรรยายไทย ทั้งคู่ — จะรวมเป็นภาษาเดียวตามสวิตช์):
- `staff.index.tsx`, `staff.dashboard.tsx`
- `staff.knowledge-hub.tsx`, `staff.knowledge.tsx`, `staff.product-knowledge.tsx`
- `staff.knowledge-translation.tsx`, `staff.capture.tsx`
- `staff.talent.tsx`, `staff.trainings.tsx`, `staff.transfer.tsx`
- `staff.products.tsx`, `staff.users.tsx`, `staff.admin.tsx`
- คอมโพเนนต์ staff: sidebar, topbar, drawer-host, certificate-modal, funder-export-modal

## เฟส 4 — ข้อมูลและฝั่งเซิร์ฟเวอร์
- ข้อความใน `src/data/seed-data.json` (ชื่อคอร์ส/ความรู้/ฯลฯ): เพิ่มฟิลด์ `titleEn/title` หรือใช้รูปแบบ `{th, en}` ที่หน้าจอเลือกอ่านตามภาษา
- ข้อความ error/return จาก server functions (`*.functions.ts`): ส่งคีย์ i18n กลับมาให้ฝั่ง client แปล แทนการส่งสตริงตายตัว
- Toast / sonner: แปลข้อความทั้งหมด

## เฟส 5 — ตรวจสอบและเก็บรายละเอียด
- รันแอปสลับภาษา ตรวจหน้าสำคัญทุกหน้า
- ตรวจ format วันที่ (ใช้ `toLocaleDateString("th-TH" | "en-GB")` ตามภาษา)
- เพิ่ม `lang` attribute ที่ `<html>` ให้ตรง (มีอยู่แล้ว ✓)
- บันทึก memory: "Default ไทย, มีสวิตช์ TH/EN, dictionary ที่ src/lib/i18n/"

## เทคนิค
```ts
// language-context.tsx (ขยาย)
const t = (key: string | Localized) =>
  typeof key === "string" ? (dict[lang][key] ?? key) : key[lang];
```
หน้าใช้งาน:
```tsx
const { t } = useLanguage();
<h1>{t("home.hero.title")}</h1>
```

## ข้อสังเกต / คำถาม
งานนี้ใหญ่มาก จะใช้หลายรอบของการแก้ไข อยากให้ผมเริ่มทำเลย หรือมีบางส่วนที่อยากให้ทำก่อน เช่น:
- **ทำทั้งหมดเป็นชุด** — เริ่มเฟส 1+2 (โครงสร้าง + หน้าผู้ใช้) ก่อนในรอบนี้ แล้วค่อยทำคอนโซลเจ้าหน้าที่รอบถัดไป
- **เน้นหน้าสาธารณะก่อน** — แปลและทำสวิตช์ครบเฉพาะหน้าผู้ใช้ ส่วนคอนโซลค่อยทำ
- **เน้นคอนโซลก่อน** — ทำสวิตช์ + แปล `/staff/*` ก่อน เพราะใช้งานภายในบ่อย

ผมแนะนำ **เริ่มเฟส 1+2** ก่อน (โครงสร้าง i18n + หน้าผู้ใช้แปลครบ + สวิตช์ใช้งานได้ทั้งสองฝั่ง) แล้วแปลคอนโซลในรอบถัดไป เพื่อให้แต่ละรอบจบเป็นชิ้นใช้งานได้จริง ไม่กระจัดกระจาย
