import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useLanguage, type Localized } from "@/lib/language-context";

type Step = { title: Localized; body: Localized };

const LEARNER_STEPS: Step[] = [
  {
    title: { th: "ยินดีต้อนรับสู่ SWING Academy", en: "Welcome to SWING Academy" },
    body: {
      th: "ที่นี่คือพื้นที่เรียนรู้เรื่องสุขภาพ สิทธิ และทักษะชีวิต — ฟรี ไม่ต้องสมัคร ไม่ตัดสิน",
      en: "A free, judgment-free space to learn about health, rights, and life skills.",
    },
  },
  {
    title: { th: "เลือกภาษาที่ถนัด", en: "Pick your language" },
    body: {
      th: "ทุกคอร์สมีทั้งภาษาไทยและอังกฤษ คลิกปุ่ม ไทย / EN ที่มุมขวาบนได้เสมอ",
      en: "Every course is bilingual. Use the ไทย / EN toggle in the top-right anytime.",
    },
  },
  {
    title: { th: "เริ่มคอร์สแรกของคุณ", en: "Start your first course" },
    body: {
      th: "ไปที่หน้า ‘คอร์ส’ เลือกคอร์สที่สนใจ แล้วกด ‘เริ่มเรียน’ — เรียนตามจังหวะตัวเอง",
      en: "Open ‘Courses’, pick one you like, and tap ‘Start’. Learn at your own pace.",
    },
  },
  {
    title: { th: "รับใบประกาศฟรี", en: "Earn a free certificate" },
    body: {
      th: "เรียนจบครบรับใบประกาศของมูลนิธิ SWING ใช้สมัครงานหรือเก็บไว้เป็นความภูมิใจ",
      en: "Finish a course to earn a SWING Foundation certificate — yours to keep.",
    },
  },
];

const STAFF_STEPS: Step[] = [
  {
    title: { th: "แดชบอร์ดเจ้าหน้าที่", en: "Staff dashboard" },
    body: {
      th: "ภาพรวมทีม คอร์ส ผู้เรียน และกิจกรรมล่าสุดของมูลนิธิ",
      en: "See team, courses, learners, and recent activity at a glance.",
    },
  },
  {
    title: { th: "อัปโหลดสื่อการสอน", en: "Upload teaching media" },
    body: {
      th: "ที่ ‘คลังความรู้’ คุณสามารถอัปโหลดสไลด์ (PDF/PPT) และวิดีโอบันทึกการสอนได้",
      en: "In ‘Knowledge’, upload slides (PDF/PPT) and recorded videos for any course.",
    },
  },
  {
    title: { th: "จัดการคน & สิทธิ์", en: "Manage people & roles" },
    body: {
      th: "แท็บ ‘Users’ ใช้เพิ่ม-แก้ไขเจ้าหน้าที่ และตั้งบทบาท (staff / admin)",
      en: "Use the ‘Users’ tab to add staff and set their roles (staff / admin).",
    },
  },
  {
    title: { th: "ต้องการความช่วยเหลือ?", en: "Need help?" },
    body: {
      th: "กดปุ่ม ‘?’ ที่มุมขวาบนเพื่อเปิดทัวร์นี้ใหม่ได้ทุกเมื่อ",
      en: "Tap the ‘?’ in the top-right to reopen this tour anytime.",
    },
  },
];

const STORAGE_KEY = "swing-academy-tour-seen";

export function OnboardingTour({
  open,
  onClose,
  variant,
}: {
  open: boolean;
  onClose: () => void;
  variant: "learner" | "staff";
}) {
  const { t, lang } = useLanguage();
  const steps = variant === "staff" ? STAFF_STEPS : LEARNER_STEPS;
  const [i, setI] = useState(0);

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  if (!open) return null;
  const step = steps[i];
  const last = i === steps.length - 1;

  const finish = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ variant, seenAt: Date.now() }));
    } catch {
      /* ignore */
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-900/40 px-4 pb-6 pt-24 backdrop-blur-sm sm:items-center sm:pb-0"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md rounded-lg bg-white p-7 shadow-lg">
        <button
          onClick={finish}
          aria-label="Close tour"
          className="absolute right-4 top-4 rounded-pill p-1.5 text-warm-500 hover:bg-warm-100 hover:text-navy-500"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-md bg-magenta-100 text-magenta-500">
          <Sparkles className="h-5 w-5" />
        </div>

        <p className="text-xs font-bold uppercase tracking-wider text-warm-500">
          {t({ th: "ขั้นที่", en: "Step" })} {i + 1} / {steps.length}
        </p>
        <h2 lang={lang} className="mt-1 text-xl font-semibold text-navy-500">
          {t(step.title)}
        </h2>
        <p lang={lang} className="mt-3 text-sm leading-relaxed text-warm-700">
          {t(step.body)}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            onClick={finish}
            className="text-xs font-medium text-warm-500 underline-offset-2 hover:underline"
          >
            {t({ th: "ข้าม", en: "Skip tour" })}
          </button>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button
                onClick={() => setI((v) => v - 1)}
                className="inline-flex items-center gap-1 rounded-pill border border-warm-300 bg-white px-3 py-1.5 text-xs font-semibold text-navy-500 hover:border-magenta-500"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> {t({ th: "ก่อนหน้า", en: "Back" })}
              </button>
            )}
            <button
              onClick={() => (last ? finish() : setI((v) => v + 1))}
              className="inline-flex items-center gap-1 rounded-pill bg-magenta-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-magenta-700"
            >
              {last ? t({ th: "เสร็จสิ้น", en: "Done" }) : t({ th: "ถัดไป", en: "Next" })}
              {!last && <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <div className="mt-5 flex gap-1.5">
          {steps.map((_, n) => (
            <span
              key={n}
              className={`h-1 flex-1 rounded-pill ${n <= i ? "bg-magenta-500" : "bg-warm-200"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function hasSeenTour(variant: "learner" | "staff") {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { variant?: string };
    return parsed.variant === variant;
  } catch {
    return false;
  }
}
