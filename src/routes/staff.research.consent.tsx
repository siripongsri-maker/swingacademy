import { createFileRoute } from "@tanstack/react-router";
import { useDeferredValue, useId, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  Archive,
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  Copy,
  EyeOff,
  FileClock,
  FilePen,
  FileText,
  History,
  Lock,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Undo2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  applyWithdrawal,
  approveConsentForm,
  createParticipant,
  listConsentForms,
  listParticipants,
  listWithdrawals,
  recordConsent,
  retireConsentForm,
  saveConsentForm,
  updateParticipant,
  todayInThailand,
  ConsentItemsSchema,
  CONSENT_GATES,
  CONSENT_METHODS,
  EXPERIENCE_TIERS,
  ITEM_KEY_PATTERN,
  MAX_FORM_ITEMS,
  PARTICIPANT_ROLES,
  VERSION_PATTERN,
  WITHDRAWAL_SCOPES,
  type ConsentDecision,
  type ConsentForm,
  type ConsentFormItem,
  type ConsentGate,
  type ConsentMethod,
  type ExperienceTier,
  type FormStatus,
  type GateStatus,
  type Participant,
  type ParticipantRole,
  type WithdrawalEvent,
  type WithdrawalScope,
} from "@/lib/research-consent.functions";
import { useLanguage, type Lang, type Localized } from "@/lib/language-context";

export const Route = createFileRoute("/staff/research/consent")({
  component: ConsentPage,
});

// ---------------------------------------------------------------------------
// Wording. Status chips describe the record, never the person.
// ---------------------------------------------------------------------------

const GATE_LABEL: Record<ConsentGate, { short: Localized; long: Localized; about: Localized }> = {
  processing: {
    short: { th: "ประมวลผล", en: "Processing" },
    long: { th: "บันทึกเสียงและประมวลผล", en: "Recording and processing" },
    about: {
      th: "ต้องยินยอมครบทุกข้อในกลุ่มนี้ เสียงที่เขาร่วมพูดจึงถอดความและประมวลผลได้",
      en: "Every item in this group must be agreed before audio they speak in can be transcribed and processed.",
    },
  },
  research: {
    short: { th: "วิจัย", en: "Research" },
    long: { th: "ใช้ในงานวิจัย", en: "Research use" },
    about: {
      th: "ต้องยินยอมครบทุกข้อในกลุ่มนี้ ข้อมูลที่ไม่ระบุตัวตนจึงใช้วิเคราะห์และรายงานผลได้",
      en: "Every item in this group must be agreed before de-identified data can be analysed and reported.",
    },
  },
  optional: {
    short: { th: "ไม่บังคับ", en: "Optional" },
    long: { th: "ข้อไม่บังคับ", en: "Optional" },
    about: {
      th: "ไม่ยินยอมข้อนี้ก็ยังเข้าร่วมได้ตามปกติ",
      en: "People can take part fully without agreeing to these.",
    },
  },
};

const STATUS_LABEL: Record<
  GateStatus,
  { label: Localized; about: Localized; cls: string; Icon: typeof Check }
> = {
  granted: {
    label: { th: "ยินยอม", en: "Agreed" },
    about: {
      th: "ยินยอมครบทุกข้อของกลุ่มนี้ในแบบฟอร์มฉบับที่อนุมัติล่าสุดที่เขาให้ไว้",
      en: "Agreed to every item of this group on the latest approved form they gave.",
    },
    cls: "border-accuracy/40 bg-accuracy-soft text-accuracy-ink",
    Icon: Check,
  },
  refused: {
    label: { th: "ไม่ยินยอม", en: "Declined" },
    about: {
      th: "เลือกไม่ยินยอมอย่างน้อยหนึ่งข้อของกลุ่มนี้ เป็นสิทธิ์ของเขา",
      en: "Chose not to agree to at least one item of this group. This is their right.",
    },
    cls: "border-warm-300 bg-warm-100 text-warm-700",
    Icon: Minus,
  },
  withdrawn: {
    label: { th: "ถอนแล้ว", en: "Withdrawn" },
    about: {
      th: "ถอนความยินยอมของกลุ่มนี้แล้ว ระบบหยุดใช้ข้อมูลส่วนนี้",
      en: "Consent for this group was withdrawn. The system stops using this part.",
    },
    cls: "border-lavender-300 bg-lavender-100 text-lavender-900",
    Icon: Undo2,
  },
  not_recorded: {
    label: { th: "ยังไม่ได้บันทึก", en: "Not recorded yet" },
    about: {
      th: "ยังไม่มีคำตอบของกลุ่มนี้ในระบบ",
      en: "No answer for this group has been recorded.",
    },
    cls: "border-dashed border-warm-400 bg-white text-warm-600",
    Icon: CircleDashed,
  },
  form_not_approved: {
    label: { th: "แบบฟอร์มยังไม่อนุมัติ", en: "Form not approved" },
    about: {
      th: "บันทึกไว้ในฉบับร่างหรือฉบับที่เลิกใช้แล้ว จึงยังไม่นับ ต้องบันทึกในฉบับที่อนุมัติ",
      en: "Recorded on a draft or retired form, so it does not count yet. Record it on an approved form.",
    },
    cls: "border-dignity/50 bg-dignity-soft text-dignity-ink",
    Icon: FileClock,
  },
};

const DECISION_LABEL: Record<ConsentDecision, Localized> = {
  granted: { th: "ยินยอม", en: "Agree" },
  refused: { th: "ไม่ยินยอม", en: "Do not agree" },
};

const METHOD_LABEL: Record<ConsentMethod, Localized> = {
  paper: { th: "แบบฟอร์มกระดาษ", en: "Paper form" },
  e_sign: { th: "ลงนามอิเล็กทรอนิกส์", en: "E-signature" },
  verbal_recorded: { th: "ยินยอมด้วยวาจา (มีบันทึกเสียง)", en: "Verbal, recorded" },
};

const FORM_STATUS_LABEL: Record<FormStatus, { label: Localized; cls: string }> = {
  draft: {
    label: { th: "ฉบับร่าง", en: "Draft" },
    cls: "border-dignity/50 bg-dignity-soft text-dignity-ink",
  },
  approved: {
    label: { th: "อนุมัติแล้ว", en: "Approved" },
    cls: "border-accuracy/40 bg-accuracy-soft text-accuracy-ink",
  },
  retired: {
    label: { th: "เลิกใช้แล้ว", en: "Retired" },
    cls: "border-warm-300 bg-warm-100 text-warm-700",
  },
};

const TIER_LABEL: Record<ExperienceTier, Localized> = {
  high: { th: "ประสบการณ์มาก", en: "More experienced" },
  low: { th: "ประสบการณ์น้อย", en: "Less experienced" },
  manager: { th: "หัวหน้างานหรือผู้จัดการ", en: "Manager" },
  not_applicable: { th: "ไม่เกี่ยวข้อง", en: "Not applicable" },
};

const ROLE_LABEL: Record<ParticipantRole, Localized> = {
  speaker: { th: "ผู้พูดในรอบบันทึก", en: "Speaker" },
  interviewee: { th: "ผู้ให้สัมภาษณ์", en: "Interviewee" },
  round0_answerer: { th: "ผู้ตอบคำถามรอบ 0", en: "Round 0 answerer" },
  rater: { th: "ผู้ร่วมประเมิน", en: "Rater" },
  survey: { th: "ผู้ตอบแบบสำรวจ", en: "Survey respondent" },
  task: { th: "ผู้ร่วมทำแบบฝึก", en: "Task participant" },
};

const SCOPE_LABEL: Record<WithdrawalScope, { label: Localized; about: Localized }> = {
  all: {
    label: { th: "ถอนทั้งหมด", en: "Everything" },
    about: {
      th: "หยุดการบันทึก การประมวลผล การใช้ในงานวิจัย และข้อไม่บังคับทั้งหมด",
      en: "Stops recording, processing, research use and all optional items.",
    },
  },
  processing: {
    label: { th: "หยุดบันทึกและประมวลผล", en: "Stop recording and processing" },
    about: {
      th: "ถอนข้อในกลุ่มบันทึกเสียงและประมวลผล",
      en: "Withdraws the recording and processing items.",
    },
  },
  research: {
    label: { th: "หยุดใช้ในงานวิจัย", en: "Stop research use" },
    about: {
      th: "ถอนข้อในกลุ่มการใช้ในงานวิจัย",
      en: "Withdraws the research use items.",
    },
  },
  optional: {
    label: { th: "ถอนเฉพาะข้อไม่บังคับ", en: "Optional items only" },
    about: {
      th: "เช่น การนำไปพัฒนาโมเดลภาษา รอบบันทึกที่เขาร่วมพูดจะไม่ถูกพัก",
      en: "For example language model development. Sessions they spoke in are not put on hold.",
    },
  },
};

// ---------------------------------------------------------------------------
// Shared styles and helpers
// ---------------------------------------------------------------------------

const BTN_PRIMARY =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-navy-500 px-4 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50";
const BTN_SECONDARY =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-warm-300 bg-white px-4 text-sm font-medium text-navy-500 hover:bg-warm-50 disabled:opacity-50";
const BTN_ROW =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md border border-warm-300 bg-white px-3 text-xs font-medium whitespace-nowrap text-navy-500 hover:bg-warm-50 disabled:opacity-50";
const INPUT =
  "min-h-11 w-full rounded-md border border-warm-300 bg-white px-3 text-sm text-navy-900 disabled:bg-warm-100";
const TEXTAREA =
  "w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-navy-900 disabled:bg-warm-100";
const DIALOG =
  "max-h-[90dvh] w-[calc(100vw-1rem)] max-w-lg overflow-y-auto rounded-lg p-4 sm:w-full sm:p-6";

const KEYS = {
  participants: ["consent", "participants"],
  forms: ["consent", "forms"],
  withdrawals: ["consent", "withdrawals"],
} as const;

const hasThai = (s: string) => /[฀-๿]/.test(s);

function errorCode(err: unknown) {
  return err instanceof Error ? err.message : String(err ?? "");
}

function errorKind(err: unknown): "missing" | "forbidden" | "other" | null {
  if (!err) return null;
  const msg = errorCode(err);
  if (msg.includes("CONSENT_TABLE_MISSING")) return "missing";
  if (
    msg.includes("RESEARCH_FORBIDDEN") ||
    msg.includes("CONSENT_FORBIDDEN") ||
    msg.includes("Unauthorized")
  ) {
    return "forbidden";
  }
  return "other";
}

/** Friendly text for a failed save. Never echoes server details. */
function saveError(err: unknown): Localized {
  const msg = errorCode(err);
  const kind = errorKind(err);
  if (kind === "missing") {
    return {
      th: "ยังไม่ได้รัน migration ความยินยอม (20261012150000_consent_and_capture.sql)",
      en: "The consent migration (20261012150000_consent_and_capture.sql) has not been applied yet.",
    };
  }
  if (kind === "forbidden") {
    return {
      th: "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้ เฉพาะเจ้าหน้าที่ดูแลความยินยอมและผู้ดูแลข้อมูลเท่านั้น",
      en: "This account cannot do this. Only the consent officer and data steward can.",
    };
  }
  const map: Record<string, Localized> = {
    CONSENT_FORM_VERSION_TAKEN: {
      th: "มีแบบฟอร์มเลขฉบับนี้แล้ว ใช้เลขฉบับอื่น",
      en: "This version number already exists. Use another one.",
    },
    CONSENT_FORM_LOCKED: {
      th: "ฉบับนี้ไม่ใช่ฉบับร่างแล้ว จึงแก้ไขไม่ได้ ให้คัดลอกเป็นฉบับร่างใหม่",
      en: "This version is no longer a draft, so it cannot be edited. Copy it to a new draft.",
    },
    CONSENT_FORM_NOT_DRAFT: {
      th: "อนุมัติได้เฉพาะฉบับร่าง ฉบับนี้อาจถูกอนุมัติไปแล้ว ลองรีเฟรช",
      en: "Only drafts can be approved. It may already be approved. Refresh to check.",
    },
    CONSENT_FORM_NOT_APPROVED: {
      th: "เลิกใช้ได้เฉพาะฉบับที่อนุมัติแล้ว",
      en: "Only approved versions can be retired.",
    },
    CONSENT_FORM_INVALID: {
      th: "ข้อในแบบฟอร์มยังไม่ครบ ต้องมีอย่างน้อย 1 ข้อสำหรับการประมวลผล และ 1 ข้อสำหรับงานวิจัย",
      en: "The form items are incomplete. It needs at least one processing item and one research item.",
    },
    CONSENT_FORM_RETIRED: {
      th: "ฉบับนี้เลิกใช้แล้ว เลือกฉบับอื่น",
      en: "This version is retired. Choose another one.",
    },
    CONSENT_FORM_NOT_FOUND: {
      th: "ไม่พบแบบฟอร์มนี้ ลองรีเฟรช",
      en: "This form was not found. Refresh and try again.",
    },
    CONSENT_NOT_FOUND: {
      th: "ไม่พบรายการนี้ อาจมีการเปลี่ยนแปลง ลองรีเฟรช",
      en: "This record was not found. Refresh and try again.",
    },
    CONSENT_DECISIONS_INCOMPLETE: {
      th: "เลือกคำตอบให้ครบทุกข้อของแบบฟอร์ม",
      en: "Choose an answer for every item on the form.",
    },
    CONSENT_ALREADY_WITHDRAWN: {
      th: "คนนี้ถอนความยินยอมในฉบับนี้แล้ว ระบบไม่เขียนทับการถอน ถ้าเขาอยากกลับมาร่วม ให้บันทึกในฉบับอื่นที่อนุมัติแล้ว",
      en: "This person withdrew on this version. A withdrawal is never overwritten. If they want to rejoin, record consent on another approved version.",
    },
    CONSENT_FORM_HAS_RECORDS: {
      th: "ฉบับร่างนี้มีบันทึกฝึกของผู้เข้าร่วมแล้ว จึงอนุมัติไม่ได้ เพื่อไม่ให้บันทึกฝึกกลายเป็นความยินยอมจริง ให้คัดลอกเป็นฉบับร่างใหม่ แล้วอนุมัติฉบับใหม่แทน",
      en: "This draft already has practice records, so it cannot be approved: practice must never turn into real consent. Copy it to a new draft and approve that one instead.",
    },
    CONSENT_DATE_BEFORE_APPROVAL: {
      th: "วันที่ให้ความยินยอมต้องไม่ก่อนวันที่แบบฟอร์มฉบับนี้ได้รับอนุมัติ",
      en: "The consent date cannot be earlier than the date this form version was approved.",
    },
    CONSENT_REJOIN_UNCONFIRMED: {
      th: "คนนี้เคยถอนความยินยอมแล้ว ติ๊กยืนยันว่าเจ้าตัวขอให้ความยินยอมครั้งนี้ด้วยตัวเองก่อนบันทึก",
      en: "This person withdrew before. Tick to confirm they themselves asked to give consent this time.",
    },
    CONSENT_IDENTITY_SAVE_FAILED: {
      th: "บันทึกชื่อไม่สำเร็จ ข้อมูลส่วนอื่นบันทึกแล้ว ลองอีกครั้ง",
      en: "The name could not be saved. Other details were saved. Try again.",
    },
    CONSENT_DUPLICATE: {
      th: "มีรายการนี้อยู่แล้ว ลองรีเฟรช",
      en: "This already exists. Refresh to check.",
    },
  };
  for (const [code, text] of Object.entries(map)) if (msg.includes(code)) return text;
  if (msg.trim().startsWith("[")) {
    // A validation error from the server (zod issues as JSON)
    return {
      th: "ข้อมูลบางช่องไม่ถูกต้อง ตรวจอีกครั้งแล้วลองใหม่",
      en: "Some fields are not valid. Check them and try again.",
    };
  }
  return { th: "บันทึกไม่สำเร็จ ลองอีกครั้ง", en: "Could not save. Try again." };
}

function fmtDate(value: string | null | undefined, lang: Lang, withTime = false) {
  if (!value) return "-";
  const dateOnly = value.length === 10;
  const d = new Date(dateOnly ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(lang === "th" ? "th-TH" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: dateOnly ? "UTC" : "Asia/Bangkok",
    ...(withTime && !dateOnly ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(d);
}

function sortForms(forms: ConsentForm[]) {
  const rank: Record<FormStatus, number> = { approved: 0, draft: 1, retired: 2 };
  return [...forms].sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      (b.approvedAt ?? "").localeCompare(a.approvedAt ?? "") ||
      b.createdAt.localeCompare(a.createdAt),
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Tab = "participants" | "forms" | "withdrawals";

function ConsentPage() {
  const { t, lang } = useLanguage();
  const listP = useServerFn(listParticipants);
  const listF = useServerFn(listConsentForms);
  const listW = useServerFn(listWithdrawals);

  // Names and decisions are dropped from the cache as soon as the page closes (gcTime 0).
  const participantsQ = useQuery({
    queryKey: KEYS.participants,
    queryFn: () => listP(),
    retry: false,
    gcTime: 0,
  });
  const allowed = participantsQ.isSuccess;
  const formsQ = useQuery({
    queryKey: KEYS.forms,
    queryFn: () => listF(),
    retry: false,
    enabled: allowed,
  });
  const withdrawalsQ = useQuery({
    queryKey: KEYS.withdrawals,
    queryFn: () => listW(),
    retry: false,
    enabled: allowed,
    gcTime: 0,
  });

  const [tab, setTab] = useState<Tab>("participants");
  const [announce, setAnnounce] = useState("");

  const kind = errorKind(participantsQ.error);
  const participants = participantsQ.data?.participants ?? [];
  const forms = useMemo(() => sortForms(formsQ.data?.forms ?? []), [formsQ.data]);
  const withdrawals = withdrawalsQ.data?.withdrawals ?? [];
  const fetching = participantsQ.isFetching || formsQ.isFetching || withdrawalsQ.isFetching;

  const refresh = () => {
    participantsQ.refetch();
    if (allowed) {
      formsQ.refetch();
      withdrawalsQ.refetch();
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-navy-900">
            <ShieldCheck className="h-6 w-6 text-accuracy" aria-hidden />
            {t({ th: "ความยินยอม", en: "Consent" })}
          </h1>
          <p lang={lang} className="mt-1 max-w-2xl text-sm text-warm-600">
            {t({
              th: "ทะเบียนความยินยอมของการศึกษา CVSK สำหรับเจ้าหน้าที่ดูแลความยินยอมที่เป็นอิสระ (consent officer) และผู้ดูแลข้อมูล (data steward) เท่านั้น",
              en: "The CVSK consent registry. For the independent consent officer and the data steward only.",
            })}
          </p>
        </div>
        {kind !== "forbidden" && (
          <button onClick={refresh} className={BTN_SECONDARY}>
            <RefreshCw className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} aria-hidden />
            {t({ th: "รีเฟรช", en: "Refresh" })}
          </button>
        )}
      </header>

      {/* Page-level announcements for screen readers (results of saves) */}
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>

      {kind === "forbidden" && (
        <div className="rounded-lg border border-warm-200 bg-white px-6 py-12 text-center">
          <Lock className="mx-auto h-8 w-8 text-warm-500" aria-hidden />
          <p lang={lang} className="mx-auto mt-3 max-w-xl text-sm text-navy-500">
            {t({
              th: "หน้านี้เปิดได้เฉพาะเจ้าหน้าที่ดูแลความยินยอม (consent officer) และผู้ดูแลข้อมูล (data steward) ผู้ดูแลระบบและนักวิจัยก็เปิดไม่ได้ เพื่อคุ้มครองความเป็นส่วนตัวของผู้เข้าร่วมแต่ละคน ถ้าคุณมีบทบาทนี้แต่ยังเปิดไม่ได้ ติดต่อผู้ดูแลระบบ",
              en: "Only the consent officer and the data steward can open this page. Admins and researchers cannot, to protect each participant's privacy. If you hold one of these roles and still cannot open it, contact an admin.",
            })}
          </p>
        </div>
      )}

      {kind !== "forbidden" && (
        <section
          aria-labelledby="consent-notice-title"
          className="flex gap-3 rounded-lg border border-lavender-300 bg-lavender-100/60 p-4 text-sm text-navy-700"
        >
          <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-lavender-900" aria-hidden />
          <div lang={lang} className="min-w-0">
            <h2 id="consent-notice-title" className="font-semibold text-navy-900">
              {t({
                th: "หน้าจอนี้สำหรับผู้ดูแลความยินยอมเท่านั้น",
                en: "This screen is for consent keepers only",
              })}
            </h2>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>
                {t({
                  th: "อย่าเปิดหน้าจอนี้ให้นักวิจัยหรือหัวหน้างานเห็น ทีมวิจัยเห็นเพียงสถานะรวมของแต่ละรอบบันทึก ไม่เห็นว่าใครยินยอมข้อไหน",
                  en: "Do not show this screen to the researcher or to supervisors. The research team only sees an overall flag per session, never who agreed to what.",
                })}
              </li>
              <li>
                {t({
                  th: "แบบฟอร์มกระดาษตัวจริงเก็บในตู้ที่ล็อกไว้ ในระบบบันทึกแค่ว่าเก็บไว้ที่ไหน ไม่สแกนและไม่แนบไฟล์",
                  en: "Signed paper forms stay in the locked cabinet. Record only where each one is kept. Do not scan or upload them.",
                })}
              </li>
              <li>
                {t({
                  th: "การเข้าร่วมเป็นความสมัครใจ ทุกคนไม่ยินยอมหรือถอนได้ทุกเมื่อ และไม่มีผลต่องานของใคร",
                  en: "Taking part is voluntary. Anyone may decline or withdraw at any time, and it never affects their job.",
                })}
              </li>
            </ul>
          </div>
        </section>
      )}

      {(kind === "missing" || kind === "other") && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-dignity/50 bg-dignity-soft/60 p-4 text-sm text-dignity-ink"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p lang={lang}>
            {kind === "missing"
              ? t({
                  th: "ยังไม่มีตารางความยินยอมในฐานข้อมูล ให้สั่ง Lovable รัน migration 20261012150000_consent_and_capture.sql ก่อน",
                  en: "The consent tables do not exist yet. Ask Lovable to run migration 20261012150000_consent_and_capture.sql.",
                })
              : t({
                  th: "โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชอีกครั้ง",
                  en: "Could not load. Refresh to try again.",
                })}
          </p>
        </div>
      )}

      {participantsQ.isLoading && (
        <p role="status" aria-busy="true" className="text-sm text-warm-600">
          {t({ th: "กำลังโหลด...", en: "Loading..." })}
        </p>
      )}

      {allowed && (
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-lg bg-warm-100 p-1">
            {(
              [
                ["participants", { th: "ผู้เข้าร่วม", en: "Participants" }, participants.length],
                ["forms", { th: "แบบฟอร์มความยินยอม", en: "Consent forms" }, forms.length],
                ["withdrawals", { th: "บันทึกการถอน", en: "Withdrawals" }, withdrawals.length],
              ] as const
            ).map(([value, label, n]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="min-h-11 px-2 text-center text-xs leading-tight whitespace-normal text-navy-500 sm:text-sm data-[state=active]:bg-white data-[state=active]:text-navy-900"
              >
                <span>
                  {t(label)} <span className="text-warm-600">({n})</span>
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="participants" className="mt-4">
            <ParticipantsPanel
              participants={participants}
              forms={forms}
              formsLoading={formsQ.isLoading}
              formsError={formsQ.error}
              options={participantsQ.data?.options ?? { departments: [], sites: [] }}
              onAnnounce={setAnnounce}
            />
          </TabsContent>
          <TabsContent value="forms" className="mt-4">
            <FormsPanel
              forms={forms}
              participants={participants}
              isLoading={formsQ.isLoading}
              error={formsQ.error}
              onAnnounce={setAnnounce}
            />
          </TabsContent>
          <TabsContent value="withdrawals" className="mt-4">
            <WithdrawalsPanel
              withdrawals={withdrawals}
              isLoading={withdrawalsQ.isLoading}
              error={withdrawalsQ.error}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function GateChip({ gate, status }: { gate: ConsentGate; status: GateStatus }) {
  const { t } = useLanguage();
  const s = STATUS_LABEL[status];
  return (
    <span
      title={t(s.about)}
      className={`inline-flex items-center gap-1.5 rounded-pill border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${s.cls}`}
    >
      <s.Icon className="h-3.5 w-3.5" aria-hidden />
      <span>
        {t(GATE_LABEL[gate].short)}: {t(s.label)}
      </span>
    </span>
  );
}

function FormStatusChip({ status }: { status: FormStatus }) {
  const { t } = useLanguage();
  const s = FORM_STATUS_LABEL[status];
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${s.cls}`}
    >
      {t(s.label)}
    </span>
  );
}

function Field({
  id,
  label,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-navy-500">
        {label}
        {required && (
          <span aria-hidden className="text-dignity-ink">
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-warm-600">
          {hint}
        </p>
      )}
    </div>
  );
}

function ErrorNote({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md border border-dignity/50 bg-dignity-soft/60 p-3 text-sm text-dignity-ink"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{text}</span>
    </p>
  );
}

function PanelError({ error }: { error: unknown }) {
  const { t } = useLanguage();
  const kind = errorKind(error);
  if (!kind) return null;
  return (
    <ErrorNote
      text={
        kind === "missing"
          ? t({
              th: "ยังไม่มีตารางความยินยอมในฐานข้อมูล ให้สั่ง Lovable รัน migration 20261012150000_consent_and_capture.sql ก่อน",
              en: "The consent tables do not exist yet. Ask Lovable to run migration 20261012150000_consent_and_capture.sql.",
            })
          : kind === "forbidden"
            ? t({
                th: "บัญชีนี้ไม่มีสิทธิ์ดูส่วนนี้",
                en: "This account cannot see this section.",
              })
            : t({
                th: "โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชอีกครั้ง",
                en: "Could not load. Refresh to try again.",
              })
      }
    />
  );
}

/** Dialog that cannot be dismissed while a save is running. */
function SafeDialog({
  busy,
  onClose,
  className = DIALOG,
  children,
}: {
  busy: boolean;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent
        className={className}
        onEscapeKeyDown={(e) => busy && e.preventDefault()}
        onInteractOutside={(e) => busy && e.preventDefault()}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

type Options = { departments: string[]; sites: string[] };

function ParticipantsPanel({
  participants,
  forms,
  formsLoading,
  formsError,
  options,
  onAnnounce,
}: {
  participants: Participant[];
  forms: ConsentForm[];
  formsLoading: boolean;
  formsError: unknown;
  options: Options;
  onAnnounce: (s: string) => void;
}) {
  const { t, lang } = useLanguage();
  const [q, setQ] = useState("");
  const query = useDeferredValue(q);
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<Participant | "new" | null>(null);
  const [recording, setRecording] = useState<Participant | null>(null);
  const [withdrawing, setWithdrawing] = useState<Participant | null>(null);

  const formById = useMemo(() => new Map(forms.map((f) => [f.id, f])), [forms]);
  const hasApproved = forms.some((f) => f.status === "approved");
  const inactive = participants.filter((p) => !p.active).length;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return participants.filter((p) => {
      if (!showInactive && !p.active) return false;
      if (!needle) return true;
      return [p.pseudoCode, p.identity?.fullName, p.identity?.contact, p.department, p.site]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [participants, query, showInactive]);

  const active = participants.filter((p) => p.active);
  const clearedProcessing = active.filter((p) => p.gates.processing === "granted").length;
  const clearedResearch = active.filter((p) => p.gates.research === "granted").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p lang={lang} className="text-sm text-warm-600">
          {t({
            th: `เข้าร่วมอยู่ ${active.length} คน · ยินยอมให้ประมวลผลครบ ${clearedProcessing} คน · ยินยอมใช้ในงานวิจัยครบ ${clearedResearch} คน`,
            en: `${active.length} taking part · ${clearedProcessing} agreed to processing · ${clearedResearch} agreed to research use`,
          })}
        </p>
        <button onClick={() => setEditing("new")} className={BTN_PRIMARY}>
          <UserPlus className="h-4 w-4" aria-hidden />
          {t({ th: "เพิ่มผู้เข้าร่วม", en: "Add participant" })}
        </button>
      </div>

      <PanelError error={formsError} />
      {!formsLoading && !formsError && !hasApproved && (
        <div
          lang={lang}
          className="flex items-start gap-3 rounded-lg border border-dignity/50 bg-dignity-soft/60 p-4 text-sm text-dignity-ink"
        >
          <FileClock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>
            {t({
              th: "ยังไม่มีแบบฟอร์มความยินยอมที่อนุมัติแล้ว บันทึกในฉบับร่างได้เพื่อฝึกเท่านั้น บันทึกฝึกไม่นับเป็นความยินยอม และฉบับร่างที่มีบันทึกฝึกแล้วจะอนุมัติไม่ได้ ความยินยอมจริงต้องบันทึกในฉบับที่คณะกรรมการจริยธรรมอนุมัติ",
              en: "No consent form is approved yet. Drafts are for practice only: practice records never count as consent, and a draft with practice records cannot be approved. Real consent must be recorded on a version approved by the ethics committee.",
            })}
          </p>
        </div>
      )}

      <details className="group rounded-lg border border-warm-200 bg-white text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 font-medium text-navy-500 [&::-webkit-details-marker]:hidden">
          <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden />
          {t({ th: "สถานะความยินยอมหมายถึงอะไร", en: "What the consent statuses mean" })}
        </summary>
        <div lang={lang} className="space-y-3 border-t border-warm-200 px-4 py-3 text-warm-700">
          <p>
            {t({
              th: "สถานะนับจากแบบฟอร์มฉบับที่อนุมัติล่าสุดที่แต่ละคนให้ความยินยอมไว้ ฉบับร่างและฉบับที่เลิกใช้แล้วไม่นับ",
              en: "Statuses come from the latest approved form each person gave. Drafts and retired versions do not count.",
            })}
          </p>
          <ul className="grid gap-2 sm:grid-cols-3">
            {CONSENT_GATES.map((g) => (
              <li key={g}>
                <span className="font-semibold text-navy-500">{t(GATE_LABEL[g].long)}</span>
                <span className="block text-xs">{t(GATE_LABEL[g].about)}</span>
              </li>
            ))}
          </ul>
          <ul className="space-y-1.5">
            {(Object.keys(STATUS_LABEL) as GateStatus[]).map((s) => (
              <li key={s} className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-pill border px-2 py-0.5 text-xs font-medium ${STATUS_LABEL[s].cls}`}
                >
                  {(() => {
                    const Icon = STATUS_LABEL[s].Icon;
                    return <Icon className="h-3.5 w-3.5" aria-hidden />;
                  })()}
                  {t(STATUS_LABEL[s].label)}
                </span>
                <span className="text-xs">{t(STATUS_LABEL[s].about)}</span>
              </li>
            ))}
          </ul>
        </div>
      </details>

      {participants.length === 0 ? (
        <div className="rounded-lg border border-dashed border-warm-300 bg-white px-6 py-12 text-center">
          <Users className="mx-auto h-8 w-8 text-warm-400" aria-hidden />
          <p lang={lang} className="mx-auto mt-3 max-w-md text-sm text-warm-600">
            {t({
              th: "ยังไม่มีผู้เข้าร่วม เพิ่มทีมงานหรือผู้ให้ความรู้ในกลุ่มเพื่อนที่ได้พูดคุยเรื่องการศึกษาแล้ว ระบบจะออกรหัสแทนชื่อให้อัตโนมัติ",
              en: "No participants yet. Add staff or peer educators who have talked through the study. A pseudonymous code is created automatically.",
            })}
          </p>
        </div>
      ) : (
        <section className="rounded-lg border border-warm-200 bg-white">
          <div className="flex flex-wrap items-center gap-3 border-b border-warm-200 p-3">
            <label className="relative min-w-0 flex-1 basis-56">
              <span className="sr-only">{t({ th: "ค้นหา", en: "Search" })}</span>
              <Search
                className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-warm-400"
                aria-hidden
              />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t({
                  th: "ค้นหารหัส ชื่อ แผนก พื้นที่",
                  en: "Search code, name, department, site",
                })}
                className={`${INPUT} pl-9`}
              />
            </label>
            {inactive > 0 && (
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-navy-500">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="h-5 w-5 accent-[var(--color-accuracy)]"
                />
                {t({
                  th: `แสดงผู้ที่ไม่ได้เข้าร่วมแล้ว (${inactive})`,
                  en: `Show people no longer taking part (${inactive})`,
                })}
              </label>
            )}
            <span className="ml-auto text-sm text-warm-600" role="status">
              {t({ th: `${filtered.length} คน`, en: `${filtered.length} people` })}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-warm-50 text-left text-xs text-warm-600">
                <tr>
                  <th className="w-12 px-2 py-2">
                    <span className="sr-only">{t({ th: "รายละเอียด", en: "Details" })}</span>
                  </th>
                  <th className="px-3 py-2 font-semibold">{t({ th: "รหัส", en: "Code" })}</th>
                  <th className="px-3 py-2 font-semibold">{t({ th: "ชื่อ", en: "Name" })}</th>
                  <th className="px-3 py-2 font-semibold">
                    {t({ th: "แผนก · พื้นที่", en: "Department · Site" })}
                  </th>
                  <th className="px-3 py-2 font-semibold">
                    {t({ th: "บทบาทในการศึกษา", en: "Study roles" })}
                  </th>
                  <th className="px-3 py-2 font-semibold">
                    {t({ th: "ความยินยอม", en: "Consent" })}
                  </th>
                  <th className="px-3 py-2 font-semibold">{t({ th: "จัดการ", en: "Actions" })}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-warm-600">
                      {t({
                        th: "ไม่พบผู้เข้าร่วมที่ตรงกับคำค้น",
                        en: "No one matches this search",
                      })}
                    </td>
                  </tr>
                )}
                {filtered.map((p) => (
                  <ParticipantRow
                    key={p.id}
                    p={p}
                    formById={formById}
                    isOpen={open === p.id}
                    onToggle={() => setOpen(open === p.id ? null : p.id)}
                    onRecord={() => setRecording(p)}
                    onWithdraw={() => setWithdrawing(p)}
                    onEdit={() => setEditing(p)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editing && (
        <ParticipantDialog
          participant={editing === "new" ? null : editing}
          options={options}
          onClose={() => setEditing(null)}
          onAnnounce={onAnnounce}
        />
      )}
      {recording && (
        <RecordConsentDialog
          participant={recording}
          forms={forms}
          formsLoading={formsLoading}
          formsError={formsError}
          onClose={() => setRecording(null)}
          onAnnounce={onAnnounce}
        />
      )}
      {withdrawing && (
        <WithdrawDialog
          participant={withdrawing}
          onClose={() => setWithdrawing(null)}
          onAnnounce={onAnnounce}
        />
      )}
    </div>
  );
}

function ParticipantRow({
  p,
  formById,
  isOpen,
  onToggle,
  onRecord,
  onWithdraw,
  onEdit,
}: {
  p: Participant;
  formById: Map<string, ConsentForm>;
  isOpen: boolean;
  onToggle: () => void;
  onRecord: () => void;
  onWithdraw: () => void;
  onEdit: () => void;
}) {
  const { t, lang } = useLanguage();
  const detailsId = `consent-details-${p.id}`;
  const name = p.identity?.fullName;
  return (
    <>
      <tr className={`border-t border-warm-100 align-top ${p.active ? "" : "bg-warm-50/70"}`}>
        <td className="px-2 py-2">
          <button
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-controls={detailsId}
            aria-label={`${t({ th: "ดูรายละเอียด", en: "Show details" })} ${p.pseudoCode}`}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-warm-600 hover:bg-warm-100"
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden />
            )}
          </button>
        </td>
        <td className="px-3 py-3 whitespace-nowrap">
          <span className="font-mono font-semibold text-navy-900">{p.pseudoCode}</span>
          {!p.active && (
            <span className="mt-1 block text-xs text-warm-600">
              {t({ th: "ไม่ได้เข้าร่วมแล้ว", en: "No longer taking part" })}
            </span>
          )}
        </td>
        <td className="px-3 py-3">
          {name ? (
            <span lang={hasThai(name) ? "th" : "en"} className="font-medium text-navy-900">
              {name}
            </span>
          ) : (
            <span className="text-dignity-ink italic">
              {t({ th: "ยังไม่มีชื่อในระบบ", en: "No name on file yet" })}
            </span>
          )}
          {p.identity?.contact && (
            <span className="mt-0.5 block text-xs break-all text-warm-600">
              {p.identity.contact}
            </span>
          )}
        </td>
        <td className="px-3 py-3 text-warm-700">
          {p.department ?? "-"}
          <span className="block text-xs text-warm-600">{p.site ?? "-"}</span>
        </td>
        <td className="px-3 py-3 text-xs text-warm-700">
          {p.roles.length ? p.roles.map((r) => t(ROLE_LABEL[r])).join(" · ") : "-"}
        </td>
        <td className="px-3 py-3">
          <div className="flex flex-col items-start gap-1">
            {CONSENT_GATES.map((g) => (
              <GateChip key={g} gate={g} status={p.gates[g]} />
            ))}
          </div>
        </td>
        <td className="px-3 py-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={onRecord}
              className={BTN_ROW}
              aria-label={`${t({ th: "บันทึกความยินยอม", en: "Record consent" })} ${p.pseudoCode}`}
            >
              <FilePen className="h-4 w-4" aria-hidden />
              {t({ th: "บันทึกความยินยอม", en: "Record consent" })}
            </button>
            <button
              onClick={onWithdraw}
              className={BTN_ROW}
              aria-label={`${t({ th: "ถอนความยินยอม", en: "Withdraw" })} ${p.pseudoCode}`}
            >
              <Undo2 className="h-4 w-4" aria-hidden />
              {t({ th: "ถอนความยินยอม", en: "Withdraw" })}
            </button>
            <button
              onClick={onEdit}
              className={BTN_ROW}
              aria-label={`${t({ th: "แก้ไข", en: "Edit" })} ${p.pseudoCode}`}
            >
              <Pencil className="h-4 w-4" aria-hidden />
              {t({ th: "แก้ไข", en: "Edit" })}
            </button>
          </div>
        </td>
      </tr>
      {isOpen && (
        <tr id={detailsId} className="bg-warm-50/60">
          <td />
          <td colSpan={6} className="px-3 pb-4 text-xs text-warm-700">
            <dl className="grid gap-x-6 gap-y-1 pt-1 sm:grid-cols-[max-content_1fr]">
              <dt className="font-semibold">
                {t({ th: "ระดับประสบการณ์", en: "Experience tier" })}
              </dt>
              <dd>{p.experienceTier ? t(TIER_LABEL[p.experienceTier]) : "-"}</dd>
              <dt className="font-semibold">{t({ th: "หมายเหตุ", en: "Note" })}</dt>
              <dd className="break-words whitespace-pre-wrap">{p.identity?.note ?? "-"}</dd>
              <dt className="font-semibold">
                {t({ th: "สถานะอ้างอิงจาก", en: "Status based on" })}
              </dt>
              <dd>
                {p.basisForm
                  ? p.basisForm.version
                  : t({ th: "ยังไม่มีฉบับที่อนุมัติ", en: "No approved form yet" })}
              </dd>
              <dt className="font-semibold">{t({ th: "เพิ่มเมื่อ", en: "Added" })}</dt>
              <dd>{fmtDate(p.createdAt, lang)}</dd>
              {p.lastWithdrawalAt && (
                <>
                  <dt className="font-semibold">
                    {t({ th: "บันทึกการถอนล่าสุด", en: "Latest withdrawal recorded" })}
                  </dt>
                  <dd>{fmtDate(p.lastWithdrawalAt, lang)}</dd>
                </>
              )}
            </dl>
            <h3 className="mt-3 font-semibold text-navy-500">
              {t({ th: "คำตอบล่าสุดของแต่ละข้อ", en: "Latest answer per item" })}
            </h3>
            {p.consents.length === 0 ? (
              <p className="mt-1">{t({ th: "ยังไม่ได้บันทึก", en: "Nothing recorded yet" })}</p>
            ) : (
              <ul className="mt-1 space-y-1.5">
                {p.consents.map((c) => {
                  const item = formById
                    .get(c.formVersionId)
                    ?.items.find((i) => i.key === c.itemKey);
                  return (
                    <li key={c.itemKey} className="rounded-md border border-warm-200 bg-white p-2">
                      <span lang={lang} className="font-medium text-navy-900">
                        {item ? (lang === "th" ? item.label_th : item.label_en) : c.itemKey}
                      </span>
                      <span className="mt-0.5 block text-warm-600">
                        {[
                          c.withdrawnAt
                            ? `${t({ th: "ถอนแล้ว", en: "Withdrawn" })} ${fmtDate(c.withdrawnAt, lang)}`
                            : t(DECISION_LABEL[c.decision]),
                          `${c.formVersion}${c.formStatus ? ` (${t(FORM_STATUS_LABEL[c.formStatus].label)})` : ""}`,
                          fmtDate(c.givenAt, lang),
                          t(METHOD_LABEL[c.method]),
                          c.paperRef
                            ? `${t({ th: "เก็บที่", en: "Kept at" })} ${c.paperRef}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function ParticipantDialog({
  participant,
  options,
  onClose,
  onAnnounce,
}: {
  participant: Participant | null;
  options: Options;
  onClose: () => void;
  onAnnounce: (s: string) => void;
}) {
  const { t, lang } = useLanguage();
  const qc = useQueryClient();
  const createFn = useServerFn(createParticipant);
  const updateFn = useServerFn(updateParticipant);
  const id = useId();
  const isNew = !participant;

  const [fullName, setFullName] = useState(participant?.identity?.fullName ?? "");
  const [contact, setContact] = useState(participant?.identity?.contact ?? "");
  const [note, setNote] = useState(participant?.identity?.note ?? "");
  const [department, setDepartment] = useState(participant?.department ?? "");
  const [site, setSite] = useState(participant?.site ?? "");
  const [tier, setTier] = useState<ExperienceTier | "">(participant?.experienceTier ?? "");
  const [roles, setRoles] = useState<ParticipantRole[]>(participant?.roles ?? []);
  const [active, setActive] = useState(participant?.active ?? true);
  const [problem, setProblem] = useState<string | null>(null);
  // Set when the participant row was created but the identity key was not saved.
  const [orphan, setOrphan] = useState<{ participantId: string; pseudoCode: string } | null>(null);

  const identity = { fullName: fullName.trim(), contact: contact.trim(), note: note.trim() };
  const details = {
    department: department.trim(),
    site: site.trim(),
    experienceTier: tier || null,
    roles,
  };

  const done = (text: string) => {
    toast.success(text);
    onAnnounce(text);
    onClose();
  };

  const save = useMutation({
    mutationFn: async () => {
      if (orphan) {
        await updateFn({ data: { participantId: orphan.participantId, identity } });
        return { kind: "retried" as const, pseudoCode: orphan.pseudoCode };
      }
      if (isNew) {
        const res = await createFn({ data: { ...identity, ...details } });
        return { kind: "created" as const, ...res };
      }
      const p = participant!;
      const before = p.identity;
      const identityChanged =
        identity.fullName !== (before?.fullName ?? "") ||
        identity.contact !== (before?.contact ?? "") ||
        identity.note !== (before?.note ?? "");
      const detailsChanged =
        details.department !== (p.department ?? "") ||
        details.site !== (p.site ?? "") ||
        details.experienceTier !== p.experienceTier ||
        active !== p.active ||
        [...details.roles].sort().join() !== [...p.roles].sort().join();
      const sendIdentity = identityChanged && !!identity.fullName;
      if (!sendIdentity && !detailsChanged) return { kind: "unchanged" as const };
      const res = await updateFn({
        data: {
          participantId: p.id,
          details: detailsChanged ? { ...details, active } : undefined,
          identity: sendIdentity ? identity : undefined,
        },
      });
      return { kind: "updated" as const, pseudoCode: res.pseudoCode };
    },
    onSuccess: (res) => {
      if (res.kind === "created" && !res.identitySaved) {
        setOrphan({ participantId: res.participantId, pseudoCode: res.pseudoCode });
        const msg = t({
          th: `สร้างรหัส ${res.pseudoCode} แล้ว แต่บันทึกชื่อไม่สำเร็จ`,
          en: `Code ${res.pseudoCode} was created, but the name was not saved`,
        });
        onAnnounce(msg);
        return;
      }
      if (res.kind === "unchanged") {
        onClose();
        return;
      }
      done(
        res.kind === "created"
          ? t({
              th: `เพิ่มผู้เข้าร่วมแล้ว รหัส ${res.pseudoCode}`,
              en: `Participant added: ${res.pseudoCode}`,
            })
          : res.kind === "retried"
            ? t({
                th: `บันทึกชื่อของ ${res.pseudoCode} แล้ว`,
                en: `Name saved for ${res.pseudoCode}`,
              })
            : t({ th: `บันทึกการแก้ไข ${res.pseudoCode} แล้ว`, en: `Saved ${res.pseudoCode}` }),
      );
    },
    onError: (err) => setProblem(t(saveError(err))),
    onSettled: () => qc.invalidateQueries({ queryKey: ["consent"] }),
  });

  const submit = () => {
    setProblem(null);
    const needsName =
      isNew || !!orphan || !!participant?.identity || !!identity.contact || !!identity.note;
    if (needsName && !identity.fullName) {
      setProblem(t({ th: "กรอกชื่อ-นามสกุลก่อนบันทึก", en: "Enter the full name first." }));
      return;
    }
    save.mutate();
  };

  const lockDetails = !!orphan || save.isPending;
  const title = orphan
    ? t({ th: `บันทึกชื่อของ ${orphan.pseudoCode}`, en: `Save the name for ${orphan.pseudoCode}` })
    : isNew
      ? t({ th: "เพิ่มผู้เข้าร่วม", en: "Add participant" })
      : t({ th: `แก้ไข ${participant!.pseudoCode}`, en: `Edit ${participant!.pseudoCode}` });

  return (
    <SafeDialog busy={save.isPending} onClose={onClose}>
      <DialogHeader>
        <DialogTitle className="leading-snug break-words text-navy-900">{title}</DialogTitle>
        <DialogDescription lang={lang}>
          {isNew
            ? t({
                th: "เพิ่มทีมงานหรือผู้ให้ความรู้ในกลุ่มเพื่อนที่ได้พูดคุยเรื่องการศึกษาแล้ว ระบบออกรหัสแทนชื่อให้อัตโนมัติ ชื่อและช่องทางติดต่อเห็นได้เฉพาะผู้ดูแลความยินยอม",
                en: "Add staff or peer educators who have talked through the study. A pseudonymous code is created automatically. Name and contact are visible to consent keepers only.",
              })
            : t({
                th: "ชื่อและช่องทางติดต่อเห็นได้เฉพาะผู้ดูแลความยินยอม ทีมวิจัยเห็นแค่รหัส",
                en: "Name and contact are visible to consent keepers only. The research team sees the code only.",
              })}
        </DialogDescription>
      </DialogHeader>

      {orphan && (
        <div
          role="alert"
          lang={lang}
          className="rounded-md border border-dignity/50 bg-dignity-soft/60 p-3 text-sm text-dignity-ink"
        >
          {t({
            th: `สร้างรหัส ${orphan.pseudoCode} ไว้แล้ว แต่บันทึกชื่อไม่สำเร็จ ไม่ต้องเพิ่มคนนี้ซ้ำ กดลองบันทึกชื่ออีกครั้ง หรือปิดไว้ก่อนแล้วกลับมาเพิ่มชื่อจากปุ่มแก้ไขของรหัสนี้`,
            en: `Code ${orphan.pseudoCode} exists, but the name was not saved. Do not add this person again. Retry saving the name, or close and add it later from Edit on this code.`,
          })}
        </div>
      )}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field
          id={`${id}-name`}
          label={t({ th: "ชื่อ-นามสกุล", en: "Full name" })}
          required={isNew || !!orphan || !!participant?.identity}
          hint={
            !isNew && !participant?.identity && !orphan
              ? t({
                  th: "ยังไม่มีชื่อในระบบ กรอกเพื่อเพิ่ม",
                  en: "No name on file yet. Fill in to add it.",
                })
              : undefined
          }
        >
          <input
            id={`${id}-name`}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={200}
            autoComplete="off"
            aria-required={isNew || !!orphan || !!participant?.identity}
            aria-describedby={
              !isNew && !participant?.identity && !orphan ? `${id}-name-hint` : undefined
            }
            className={INPUT}
          />
        </Field>
        <Field
          id={`${id}-contact`}
          label={t({ th: "ช่องทางติดต่อ (ไม่บังคับ)", en: "Contact (optional)" })}
        >
          <input
            id={`${id}-contact`}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            maxLength={200}
            autoComplete="off"
            className={INPUT}
          />
        </Field>
        <Field
          id={`${id}-note`}
          label={t({ th: "หมายเหตุ (ไม่บังคับ)", en: "Note (optional)" })}
          hint={t({
            th: "ไม่บันทึกข้อมูลสุขภาพ สภาพจิตใจ หรือเรื่องส่วนตัวของใครไว้ตรงนี้",
            en: "Do not record anyone's health, mental wellbeing or private matters here.",
          })}
        >
          <textarea
            id={`${id}-note`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            rows={2}
            aria-describedby={`${id}-note-hint`}
            className={TEXTAREA}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${id}-dept`} label={t({ th: "แผนก", en: "Department" })}>
            <input
              id={`${id}-dept`}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              list={`${id}-dept-list`}
              maxLength={120}
              disabled={lockDetails}
              className={INPUT}
            />
            <datalist id={`${id}-dept-list`}>
              {options.departments.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </Field>
          <Field id={`${id}-site`} label={t({ th: "พื้นที่", en: "Site" })}>
            <input
              id={`${id}-site`}
              value={site}
              onChange={(e) => setSite(e.target.value)}
              list={`${id}-site-list`}
              maxLength={120}
              disabled={lockDetails}
              className={INPUT}
            />
            <datalist id={`${id}-site-list`}>
              {options.sites.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
        </div>

        <Field id={`${id}-tier`} label={t({ th: "ระดับประสบการณ์", en: "Experience tier" })}>
          <select
            id={`${id}-tier`}
            value={tier}
            onChange={(e) => setTier(e.target.value as ExperienceTier | "")}
            disabled={lockDetails}
            className={INPUT}
          >
            <option value="">{t({ th: "ไม่ระบุ", en: "Not set" })}</option>
            {EXPERIENCE_TIERS.map((x) => (
              <option key={x} value={x}>
                {t(TIER_LABEL[x])}
              </option>
            ))}
          </select>
        </Field>

        <fieldset disabled={lockDetails}>
          <legend className="text-sm font-medium text-navy-500">
            {t({ th: "บทบาทในการศึกษา", en: "Study roles" })}
          </legend>
          <div className="mt-1 grid gap-1 sm:grid-cols-2">
            {PARTICIPANT_ROLES.map((r) => (
              <label
                key={r}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-navy-500 hover:bg-warm-50"
              >
                <input
                  type="checkbox"
                  checked={roles.includes(r)}
                  onChange={(e) =>
                    setRoles((prev) =>
                      e.target.checked ? [...prev, r] : prev.filter((x) => x !== r),
                    )
                  }
                  className="h-5 w-5 accent-[var(--color-accuracy)]"
                />
                {t(ROLE_LABEL[r])}
              </label>
            ))}
          </div>
        </fieldset>

        {!isNew && (
          <label className="flex min-h-11 cursor-pointer items-start gap-2 text-sm text-navy-500">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={lockDetails}
              className="mt-0.5 h-5 w-5 accent-[var(--color-accuracy)]"
            />
            <span lang={lang}>
              {t({ th: "ยังเข้าร่วมการศึกษาอยู่", en: "Still taking part in the study" })}
              <span className="block text-xs text-warm-600">
                {t({
                  th: "เอาเครื่องหมายออกเมื่อเขาไม่ได้ร่วมแล้ว การถอนความยินยอมให้ใช้ปุ่มถอนความยินยอม",
                  en: "Untick when they no longer take part. To withdraw consent, use Withdraw.",
                })}
              </span>
            </span>
          </label>
        )}

        <ErrorNote text={problem} />

        <DialogFooter className="gap-2 sm:space-x-0">
          <button
            type="button"
            onClick={onClose}
            disabled={save.isPending}
            className={BTN_SECONDARY}
          >
            {orphan
              ? t({ th: "ปิดไว้ก่อน", en: "Close for now" })
              : t({ th: "ยกเลิก", en: "Cancel" })}
          </button>
          <button type="submit" disabled={save.isPending} className={BTN_PRIMARY}>
            {save.isPending
              ? t({ th: "กำลังบันทึก...", en: "Saving..." })
              : orphan
                ? t({ th: "ลองบันทึกชื่ออีกครั้ง", en: "Retry saving the name" })
                : isNew
                  ? t({ th: "เพิ่มผู้เข้าร่วม", en: "Add participant" })
                  : t({ th: "บันทึก", en: "Save" })}
          </button>
        </DialogFooter>
      </form>
    </SafeDialog>
  );
}

function RecordConsentDialog({
  participant,
  forms,
  formsLoading,
  formsError,
  onClose,
  onAnnounce,
}: {
  participant: Participant;
  forms: ConsentForm[];
  formsLoading: boolean;
  formsError: unknown;
  onClose: () => void;
  onAnnounce: (s: string) => void;
}) {
  const { t, lang } = useLanguage();
  const qc = useQueryClient();
  const recordFn = useServerFn(recordConsent);
  const id = useId();
  const today = todayInThailand();

  const usable = forms.filter((f) => f.status !== "retired"); // already approved-first
  const priorFor = (formId: string) =>
    participant.signedForms.find((s) => s.formVersionId === formId);

  const [formId, setFormId] = useState(usable[0]?.id ?? "");
  const [decisions, setDecisions] = useState<Record<string, ConsentDecision>>(
    () => priorFor(usable[0]?.id ?? "")?.decisions ?? {},
  );
  const [method, setMethod] = useState<ConsentMethod>("paper");
  const [givenAt, setGivenAt] = useState(today);
  const [paperRef, setPaperRef] = useState("");
  const [rejoinConfirmed, setRejoinConfirmed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Someone who withdrew before is only recorded again when they themselves ask to.
  const hadWithdrawal =
    !!participant.lastWithdrawalAt || participant.signedForms.some((s) => s.withdrawnKeys.length);

  const effectiveId = usable.some((f) => f.id === formId) ? formId : (usable[0]?.id ?? "");
  const form = usable.find((f) => f.id === effectiveId);
  const prior = form ? priorFor(form.id) : undefined;
  const blockedByWithdrawal = !!prior?.withdrawnKeys.length;
  // Consent on an approved form cannot predate its approval.
  const minDate = form?.status === "approved" && form.approvedAt ? form.approvedAt : null;
  const missing = form ? form.items.filter((it) => !decisions[it.key]).length : 0;

  const pickForm = (fid: string) => {
    setFormId(fid);
    const p = priorFor(fid);
    setDecisions(p?.decisions ?? {});
    setProblem(null);
  };

  const save = useMutation({
    mutationFn: () => {
      const items = form!.items;
      const only = Object.fromEntries(items.map((it) => [it.key, decisions[it.key]]));
      return recordFn({
        data: {
          participantId: participant.id,
          formVersionId: form!.id,
          method,
          givenAt,
          paperRef: paperRef.trim() || null,
          decisions: only,
          confirmRejoin: hadWithdrawal && rejoinConfirmed,
        },
      });
    },
    onSuccess: (res) => {
      const text = res.formApproved
        ? t({
            th: `บันทึกความยินยอมของ ${res.pseudoCode} แล้ว (${res.saved} ข้อ ฉบับ ${res.formVersion})`,
            en: `Consent recorded for ${res.pseudoCode} (${res.saved} items, ${res.formVersion})`,
          })
        : t({
            th: `บันทึกในฉบับร่าง ${res.formVersion} แล้ว (${res.saved} ข้อ) ยังไม่นับเป็นความยินยอม`,
            en: `Saved on draft ${res.formVersion} (${res.saved} items). It does not count as consent yet.`,
          });
      toast.success(text);
      onAnnounce(text);
      onClose();
    },
    onError: (err) => setProblem(t(saveError(err))),
    onSettled: () => qc.invalidateQueries({ queryKey: ["consent"] }),
  });

  const submit = () => {
    setProblem(null);
    if (!form) return;
    if (missing) {
      setProblem(
        t({
          th: `ยังเลือกคำตอบไม่ครบ เหลืออีก ${missing} ข้อ`,
          en: `${missing} item(s) still need an answer.`,
        }),
      );
      return;
    }
    if (!givenAt || givenAt > today || givenAt < "2020-01-01") {
      setProblem(
        t({
          th: "วันที่ให้ความยินยอมต้องไม่เป็นวันในอนาคต",
          en: "The consent date cannot be in the future.",
        }),
      );
      return;
    }
    if (minDate && givenAt < minDate) {
      setProblem(t(saveError(new Error("CONSENT_DATE_BEFORE_APPROVAL"))));
      return;
    }
    if (method === "paper" && !paperRef.trim()) {
      setProblem(
        t({
          th: "ระบุว่าเก็บแบบฟอร์มกระดาษไว้ที่ไหน",
          en: "Say where the paper form is kept.",
        }),
      );
      return;
    }
    if (hadWithdrawal && !rejoinConfirmed) {
      setProblem(t(saveError(new Error("CONSENT_REJOIN_UNCONFIRMED"))));
      return;
    }
    save.mutate();
  };

  const name = participant.identity?.fullName;

  return (
    <SafeDialog
      busy={save.isPending}
      onClose={onClose}
      className={DIALOG.replace("max-w-lg", "max-w-2xl")}
    >
      <DialogHeader>
        <DialogTitle className="leading-snug break-words text-navy-900">
          {t({ th: "บันทึกความยินยอม", en: "Record consent" })}
        </DialogTitle>
        <DialogDescription lang={lang}>
          <span className="font-mono font-semibold text-navy-900">{participant.pseudoCode}</span>
          {name ? ` · ${name}` : ""}
          <span className="mt-1 block">
            {t({
              th: "บันทึกตามที่เจ้าตัวเลือกไว้ในแบบฟอร์มทุกข้อ ไม่เลือกแทน ไม่ยินยอมบางข้อก็ยังเข้าร่วมส่วนอื่นได้",
              en: "Record each item exactly as the person chose. Never choose for them. Declining some items does not stop them taking part in the rest.",
            })}
          </span>
        </DialogDescription>
      </DialogHeader>

      {formsLoading ? (
        <p role="status" className="text-sm text-warm-600">
          {t({ th: "กำลังโหลดแบบฟอร์ม...", en: "Loading forms..." })}
        </p>
      ) : formsError ? (
        <PanelError error={formsError} />
      ) : usable.length === 0 ? (
        <p lang={lang} className="text-sm text-warm-600">
          {t({
            th: "ยังไม่มีแบบฟอร์มที่ใช้ได้ สร้างฉบับร่างในแท็บแบบฟอร์มความยินยอมก่อน",
            en: "No usable form yet. Create a draft in the Consent forms tab first.",
          })}
        </p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field id={`${id}-form`} label={t({ th: "แบบฟอร์มฉบับ", en: "Form version" })} required>
            <select
              id={`${id}-form`}
              value={effectiveId}
              onChange={(e) => pickForm(e.target.value)}
              className={INPUT}
            >
              {usable.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.version} · {t(FORM_STATUS_LABEL[f.status].label)} · {f.title}
                </option>
              ))}
            </select>
          </Field>

          {form?.status === "draft" ? (
            <div
              lang={lang}
              className="flex items-start gap-2 rounded-md border border-dignity/60 bg-dignity-soft p-3 text-sm font-medium text-dignity-ink"
            >
              <FileClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                {t({
                  th: "ฉบับนี้ยังเป็นร่าง ใช้ฝึกบันทึกได้เท่านั้น บันทึกฝึกไม่นับเป็นความยินยอม และเมื่อมีบันทึกฝึกแล้ว ฉบับร่างนี้จะอนุมัติไม่ได้ ถ้าจะบันทึกความยินยอมจริง ให้อนุมัติแบบฟอร์มก่อน",
                  en: "This version is still a draft and is for practice only. Practice records never count as consent, and once it has practice records this draft cannot be approved. To record real consent, approve the form first.",
                })}
              </p>
            </div>
          ) : form ? (
            <p lang={lang} className="flex items-start gap-2 text-xs text-accuracy-ink">
              <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden />
              {t({
                th: `ฉบับนี้อนุมัติแล้ว (${form.approvedRef ?? "-"} · ${fmtDate(form.approvedAt, "th")}) นับเป็นความยินยอมได้`,
                en: `Approved (${form.approvedRef ?? "-"} · ${fmtDate(form.approvedAt, "en")}). This counts as consent.`,
              })}
            </p>
          ) : null}

          {prior && !blockedByWithdrawal && (
            <p
              lang={lang}
              className="rounded-md border border-warm-200 bg-warm-50 p-3 text-xs text-warm-700"
            >
              {t({
                th: `มีบันทึกของฉบับนี้อยู่แล้ว (${fmtDate(prior.givenAt, "th")}) บันทึกครั้งนี้จะแทนที่ของเดิม`,
                en: `There is already a record on this version (${fmtDate(prior.givenAt, "en")}). Saving replaces it.`,
              })}
            </p>
          )}
          {blockedByWithdrawal && (
            <ErrorNote text={t(saveError(new Error("CONSENT_ALREADY_WITHDRAWN")))} />
          )}
          {hadWithdrawal && !blockedByWithdrawal && (
            <div
              lang={lang}
              className="space-y-2 rounded-md border border-lavender-300 bg-lavender-100/60 p-3 text-sm text-navy-700"
            >
              <p>
                {participant.lastWithdrawalAt
                  ? t({
                      th: `คนนี้เคยถอนความยินยอม (บันทึกล่าสุด ${fmtDate(participant.lastWithdrawalAt, "th")}) การบันทึกครั้งนี้อาจทำให้ข้อมูลของเขากลับมาใช้ได้อีก บันทึกเฉพาะเมื่อเจ้าตัวขอเอง`,
                      en: `This person withdrew before (latest recorded ${fmtDate(participant.lastWithdrawalAt, "en")}). Saving may let their data be used again. Record only if they asked for it themselves.`,
                    })
                  : t({
                      th: "คนนี้เคยถอนความยินยอม การบันทึกครั้งนี้อาจทำให้ข้อมูลของเขากลับมาใช้ได้อีก บันทึกเฉพาะเมื่อเจ้าตัวขอเอง",
                      en: "This person withdrew before. Saving may let their data be used again. Record only if they asked for it themselves.",
                    })}
              </p>
              <label className="flex min-h-11 cursor-pointer items-start gap-2 font-medium text-navy-900">
                <input
                  type="checkbox"
                  checked={rejoinConfirmed}
                  onChange={(e) => setRejoinConfirmed(e.target.checked)}
                  disabled={save.isPending}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-navy-500)]"
                />
                <span>
                  {t({
                    th: "ยืนยันว่าเจ้าตัวขอให้ความยินยอมครั้งนี้ด้วยตัวเอง",
                    en: "I confirm the person themselves asked to give consent this time.",
                  })}
                </span>
              </label>
            </div>
          )}

          {form && (
            <div className="space-y-3">
              {form.items.map((it, n) => (
                <div key={it.key} className="rounded-md border border-warm-200 p-3">
                  <fieldset disabled={blockedByWithdrawal || save.isPending}>
                    <legend className="w-full">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-warm-600">
                          {t({ th: `ข้อ ${n + 1}`, en: `Item ${n + 1}` })}
                        </span>
                        <span className="rounded-pill border border-warm-300 bg-warm-50 px-2 py-0.5 text-xs text-warm-700">
                          {t(GATE_LABEL[it.gate].long)}
                        </span>
                      </span>
                      <span lang="th" className="mt-1 block text-sm font-medium text-navy-900">
                        {it.label_th}
                      </span>
                      <span lang="en" className="block text-xs text-warm-600">
                        {it.label_en}
                      </span>
                    </legend>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(["granted", "refused"] as const).map((d) => (
                        <label
                          key={d}
                          className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm ${
                            decisions[it.key] === d
                              ? "border-navy-500 bg-navy-100/50 font-semibold text-navy-900"
                              : "border-warm-300 text-navy-500 hover:bg-warm-50"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`${id}-item-${it.key}`}
                            value={d}
                            checked={decisions[it.key] === d}
                            onChange={() => setDecisions((prev) => ({ ...prev, [it.key]: d }))}
                            className="h-5 w-5 accent-[var(--color-navy-500)]"
                          />
                          {t(DECISION_LABEL[d])}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              ))}
            </div>
          )}

          <fieldset disabled={blockedByWithdrawal || save.isPending}>
            <legend className="text-sm font-medium text-navy-500">
              {t({ th: "วิธีให้ความยินยอม", en: "How consent was given" })}
            </legend>
            <div className="mt-1 grid gap-2 sm:grid-cols-3">
              {CONSENT_METHODS.map((m) => (
                <label
                  key={m}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm ${
                    method === m
                      ? "border-navy-500 bg-navy-100/50 text-navy-900"
                      : "border-warm-300 text-navy-500 hover:bg-warm-50"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${id}-method`}
                    value={m}
                    checked={method === m}
                    onChange={() => setMethod(m)}
                    className="h-5 w-5 accent-[var(--color-navy-500)]"
                  />
                  {t(METHOD_LABEL[m])}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id={`${id}-date`}
              label={t({ th: "วันที่ให้ความยินยอม", en: "Date given" })}
              required
            >
              <input
                id={`${id}-date`}
                type="date"
                value={givenAt}
                max={today}
                min={minDate ?? "2020-01-01"}
                onChange={(e) => setGivenAt(e.target.value)}
                disabled={blockedByWithdrawal || save.isPending}
                required
                className={INPUT}
              />
            </Field>
            <Field
              id={`${id}-paper`}
              label={t({ th: "ที่เก็บแบบฟอร์มกระดาษ", en: "Where the paper form is kept" })}
              required={method === "paper"}
              hint={t({
                th: "เช่น ตู้ล็อก A ลิ้นชัก 2 แฟ้ม 2569-01 ไม่สแกนและไม่แนบไฟล์",
                en: "For example: locked cabinet A, drawer 2, folder 2569-01. Do not scan or attach.",
              })}
            >
              <input
                id={`${id}-paper`}
                value={paperRef}
                onChange={(e) => setPaperRef(e.target.value)}
                maxLength={200}
                autoComplete="off"
                disabled={blockedByWithdrawal || save.isPending}
                aria-required={method === "paper"}
                aria-describedby={`${id}-paper-hint`}
                className={INPUT}
              />
            </Field>
          </div>

          <ErrorNote text={problem} />

          <DialogFooter className="gap-2 sm:space-x-0">
            <button
              type="button"
              onClick={onClose}
              disabled={save.isPending}
              className={BTN_SECONDARY}
            >
              {t({ th: "ยกเลิก", en: "Cancel" })}
            </button>
            <button
              type="submit"
              disabled={!form || blockedByWithdrawal || save.isPending}
              className={BTN_PRIMARY}
            >
              <FilePen className="h-4 w-4" aria-hidden />
              {save.isPending
                ? t({ th: "กำลังบันทึก...", en: "Saving..." })
                : t({ th: "บันทึกความยินยอม", en: "Record consent" })}
            </button>
          </DialogFooter>
        </form>
      )}
    </SafeDialog>
  );
}

function WithdrawDialog({
  participant,
  onClose,
  onAnnounce,
}: {
  participant: Participant;
  onClose: () => void;
  onAnnounce: (s: string) => void;
}) {
  const { t, lang } = useLanguage();
  const qc = useQueryClient();
  const withdrawFn = useServerFn(applyWithdrawal);
  const id = useId();
  const [scope, setScope] = useState<WithdrawalScope | null>(null);
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      withdrawFn({
        data: { participantId: participant.id, scope: scope!, note: note.trim() || null },
      }),
    onSuccess: (res) => {
      const text =
        res.scope === "optional"
          ? t({
              th: `บันทึกการถอนข้อไม่บังคับของ ${res.pseudoCode} แล้ว`,
              en: `Optional items withdrawn for ${res.pseudoCode}`,
            })
          : t({
              th: `บันทึกการถอนของ ${res.pseudoCode} แล้ว · พักรอบบันทึกไว้ ${res.sessionsOnHold} รอบ ให้ผู้ดูแลข้อมูลตรวจ`,
              en: `Withdrawal recorded for ${res.pseudoCode} · ${res.sessionsOnHold} session(s) put on hold for the data steward`,
            });
      toast.success(text);
      onAnnounce(text);
      onClose();
    },
    onError: (err) => setProblem(t(saveError(err))),
    onSettled: () => qc.invalidateQueries({ queryKey: ["consent"] }),
  });

  const name = participant.identity?.fullName;
  const holdsSessions = scope !== null && scope !== "optional";

  return (
    <SafeDialog busy={save.isPending} onClose={onClose}>
      <DialogHeader>
        <DialogTitle className="leading-snug break-words text-navy-900">
          {t({ th: "ถอนความยินยอม", en: "Withdraw consent" })}
        </DialogTitle>
        <DialogDescription lang={lang}>
          <span className="font-mono font-semibold text-navy-900">{participant.pseudoCode}</span>
          {name ? ` · ${name}` : ""}
          <span className="mt-1 block">
            {t({
              th: "การถอนเป็นสิทธิ์ของทุกคน ทำได้ทุกเมื่อ และไม่ต้องให้เหตุผล",
              en: "Withdrawing is everyone's right, at any time, with no reason needed.",
            })}
          </span>
        </DialogDescription>
      </DialogHeader>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setProblem(null);
          if (!scope) {
            setProblem(t({ th: "เลือกขอบเขตของการถอน", en: "Choose what to withdraw." }));
            return;
          }
          if (!confirmed) {
            setProblem(
              t({ th: "ติ๊กยืนยันก่อนบันทึก", en: "Tick the confirmation before saving." }),
            );
            return;
          }
          save.mutate();
        }}
      >
        <fieldset disabled={save.isPending}>
          <legend className="text-sm font-medium text-navy-500">
            {t({ th: "ขอบเขตที่ถอน", en: "What to withdraw" })}
          </legend>
          <div className="mt-1 space-y-2">
            {WITHDRAWAL_SCOPES.map((s) => (
              <label
                key={s}
                className={`flex min-h-11 cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                  scope === s
                    ? "border-navy-500 bg-navy-100/50 text-navy-900"
                    : "border-warm-300 text-navy-500 hover:bg-warm-50"
                }`}
              >
                <input
                  type="radio"
                  name={`${id}-scope`}
                  value={s}
                  checked={scope === s}
                  onChange={() => setScope(s)}
                  className="mt-0.5 h-5 w-5 accent-[var(--color-navy-500)]"
                />
                <span lang={lang}>
                  <span className="font-medium">{t(SCOPE_LABEL[s].label)}</span>
                  <span className="block text-xs text-warm-600">{t(SCOPE_LABEL[s].about)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field
          id={`${id}-note`}
          label={t({ th: "บันทึกสั้นๆ (ไม่บังคับ)", en: "Short note (optional)" })}
          hint={t({
            th: "เช่น แจ้งด้วยวาจากับเจ้าหน้าที่ดูแลความยินยอม ไม่ต้องใส่เหตุผล และไม่บันทึกเรื่องสุขภาพ",
            en: "For example: told the consent officer in person. No reason needed, and no health details.",
          })}
        >
          <textarea
            id={`${id}-note`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            disabled={save.isPending}
            aria-describedby={`${id}-note-hint`}
            className={TEXTAREA}
          />
        </Field>

        <div
          lang={lang}
          className="rounded-md border border-lavender-300 bg-lavender-100/60 p-3 text-sm text-navy-700"
        >
          <p className="font-semibold text-navy-900">
            {t({ th: "หลังบันทึกแล้วจะเกิดอะไรขึ้น", en: "What happens next" })}
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              {t({
                th: "ระบบหยุดประมวลผลข้อมูลส่วนที่ถอนตั้งแต่ตอนนี้",
                en: "Processing of the withdrawn part stops from now on.",
              })}
            </li>
            <li>
              {holdsSessions || scope === null
                ? t({
                    th: "รอบบันทึกที่เขาร่วมพูดและยังไม่ปิด จะถูกพักไว้ให้ผู้ดูแลข้อมูลตรวจก่อนใช้ต่อ",
                    en: "Sessions they spoke in that are not closed are put on hold for the data steward to review.",
                  })
                : t({
                    th: "ถอนเฉพาะข้อไม่บังคับ รอบบันทึกที่เขาร่วมพูดจะไม่ถูกพัก",
                    en: "Optional items only: sessions they spoke in are not put on hold.",
                  })}
            </li>
            <li className="font-medium">
              {t({
                th: "การถอนไม่มีผลต่องาน ตำแหน่ง หรือการจ้างงานของเขาเลย",
                en: "Withdrawing never affects their job, role or employment.",
              })}
            </li>
          </ul>
        </div>

        <label className="flex min-h-11 cursor-pointer items-start gap-2 text-sm text-navy-900">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            disabled={save.isPending}
            className="mt-0.5 h-5 w-5 accent-[var(--color-navy-500)]"
          />
          <span lang={lang}>
            {t({
              th: "ยืนยันว่าเจ้าตัวแจ้งถอนความยินยอมตามขอบเขตที่เลือก",
              en: "I confirm the person asked to withdraw within the chosen scope.",
            })}
          </span>
        </label>

        <ErrorNote text={problem} />

        <DialogFooter className="gap-2 sm:space-x-0">
          <button
            type="button"
            onClick={onClose}
            disabled={save.isPending}
            className={BTN_SECONDARY}
          >
            {t({ th: "ยกเลิก", en: "Cancel" })}
          </button>
          <button
            type="submit"
            disabled={save.isPending || !scope || !confirmed}
            className={BTN_PRIMARY}
          >
            <Undo2 className="h-4 w-4" aria-hidden />
            {save.isPending
              ? t({ th: "กำลังบันทึก...", en: "Saving..." })
              : t({ th: "บันทึกการถอน", en: "Record withdrawal" })}
          </button>
        </DialogFooter>
      </form>
    </SafeDialog>
  );
}

// ---------------------------------------------------------------------------
// Consent forms
// ---------------------------------------------------------------------------

type EditorTarget = { mode: "create"; from?: ConsentForm } | { mode: "edit"; form: ConsentForm };

function FormsPanel({
  forms,
  participants,
  isLoading,
  error,
  onAnnounce,
}: {
  forms: ConsentForm[];
  participants: Participant[];
  isLoading: boolean;
  error: unknown;
  onAnnounce: (s: string) => void;
}) {
  const { t, lang } = useLanguage();
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [approving, setApproving] = useState<ConsentForm | null>(null);
  const [retiring, setRetiring] = useState<ConsentForm | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p lang={lang} className="max-w-2xl text-sm text-warm-600">
          {t({
            th: `แต่ละฉบับมีข้อความยินยอมได้ 1 ถึง ${MAX_FORM_ITEMS} ข้อ ต้องมีอย่างน้อย 1 ข้อในกลุ่มบันทึกเสียงและประมวลผล และ 1 ข้อในกลุ่มใช้ในงานวิจัย ฉบับร่างแก้ไขได้ ฉบับที่อนุมัติหรือเลิกใช้แล้วแก้ไม่ได้ ถ้าต้องเปลี่ยนให้คัดลอกเป็นฉบับร่างใหม่`,
            en: `Each version has 1 to ${MAX_FORM_ITEMS} items, with at least one recording and processing item and one research item. Drafts can be edited. Approved and retired versions cannot; copy them to a new draft instead.`,
          })}
        </p>
        <button onClick={() => setEditor({ mode: "create" })} className={BTN_PRIMARY}>
          <Plus className="h-4 w-4" aria-hidden />
          {t({ th: "สร้างฉบับร่างใหม่", en: "New draft" })}
        </button>
      </div>

      <PanelError error={error} />
      {isLoading && (
        <p role="status" aria-busy="true" className="text-sm text-warm-600">
          {t({ th: "กำลังโหลด...", en: "Loading..." })}
        </p>
      )}

      {!isLoading && !error && forms.length === 0 && (
        <div className="rounded-lg border border-dashed border-warm-300 bg-white px-6 py-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-warm-400" aria-hidden />
          <p lang={lang} className="mt-3 text-sm text-warm-600">
            {t({
              th: "ยังไม่มีแบบฟอร์ม สร้างฉบับร่างแรกเพื่อเริ่ม",
              en: "No forms yet. Create the first draft to start.",
            })}
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {forms.map((f) => {
          const counts = CONSENT_GATES.map(
            (g) => [g, f.items.filter((i) => i.gate === g).length] as const,
          );
          return (
            <li key={f.id} className="rounded-lg border border-warm-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold break-all text-navy-900">
                      {f.version}
                    </span>
                    <FormStatusChip status={f.status} />
                  </p>
                  <p
                    lang={hasThai(f.title) ? "th" : "en"}
                    className="mt-1 font-medium break-words text-navy-500"
                  >
                    {f.title}
                  </p>
                  <p lang={lang} className="mt-1 text-xs text-warm-600">
                    {[
                      f.status !== "draft" && f.approvedRef
                        ? `${t({ th: "อนุมัติ", en: "Approved" })} ${f.approvedRef} · ${fmtDate(f.approvedAt, lang)}`
                        : `${t({ th: "สร้างเมื่อ", en: "Created" })} ${fmtDate(f.createdAt, lang)}`,
                      counts.map(([g, n]) => `${t(GATE_LABEL[g].short)} ${n}`).join(" · "),
                    ].join(" · ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {f.status === "draft" && (
                    <>
                      <button
                        onClick={() => setEditor({ mode: "edit", form: f })}
                        className={BTN_ROW}
                        aria-label={`${t({ th: "แก้ไข", en: "Edit" })} ${f.version}`}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                        {t({ th: "แก้ไข", en: "Edit" })}
                      </button>
                      <button
                        onClick={() => setApproving(f)}
                        className={BTN_ROW}
                        aria-label={`${t({ th: "อนุมัติ", en: "Approve" })} ${f.version}`}
                      >
                        <BadgeCheck className="h-4 w-4" aria-hidden />
                        {t({ th: "อนุมัติ", en: "Approve" })}
                      </button>
                    </>
                  )}
                  {f.status === "approved" && (
                    <button
                      onClick={() => setRetiring(f)}
                      className={BTN_ROW}
                      aria-label={`${t({ th: "เลิกใช้", en: "Retire" })} ${f.version}`}
                    >
                      <Archive className="h-4 w-4" aria-hidden />
                      {t({ th: "เลิกใช้", en: "Retire" })}
                    </button>
                  )}
                  <button
                    onClick={() => setEditor({ mode: "create", from: f })}
                    className={BTN_ROW}
                    aria-label={`${t({ th: "คัดลอกเป็นฉบับร่างใหม่", en: "Copy to new draft" })} ${f.version}`}
                  >
                    <Copy className="h-4 w-4" aria-hidden />
                    {t({ th: "คัดลอกเป็นร่างใหม่", en: "Copy to draft" })}
                  </button>
                </div>
              </div>
              <details className="group mt-2 text-sm">
                <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-medium text-navy-500 [&::-webkit-details-marker]:hidden">
                  <ChevronRight
                    className="h-4 w-4 transition-transform group-open:rotate-90"
                    aria-hidden
                  />
                  {t({ th: `ดูข้อความ ${f.items.length} ข้อ`, en: `Show ${f.items.length} items` })}
                </summary>
                <ol className="mt-1 space-y-2">
                  {f.items.map((it, n) => (
                    <li key={it.key} className="rounded-md border border-warm-200 p-2">
                      <span className="flex flex-wrap items-center gap-2 text-xs text-warm-600">
                        <span className="font-semibold">{n + 1}.</span>
                        <span className="font-mono">{it.key}</span>
                        <span className="rounded-pill border border-warm-300 bg-warm-50 px-2 py-0.5">
                          {t(GATE_LABEL[it.gate].long)}
                        </span>
                      </span>
                      <span lang="th" className="mt-1 block text-navy-900">
                        {it.label_th}
                      </span>
                      <span lang="en" className="block text-xs text-warm-600">
                        {it.label_en}
                      </span>
                    </li>
                  ))}
                </ol>
              </details>
            </li>
          );
        })}
      </ul>

      {editor && (
        <FormEditorDialog target={editor} onClose={() => setEditor(null)} onAnnounce={onAnnounce} />
      )}
      {approving && (
        <ApproveFormDialog
          form={approving}
          practiceRecords={
            participants.filter((p) => p.signedForms.some((s) => s.formVersionId === approving.id))
              .length
          }
          onClose={() => setApproving(null)}
          onAnnounce={onAnnounce}
        />
      )}
      {retiring && (
        <RetireFormDialog
          form={retiring}
          affected={participants.filter((p) => p.basisForm?.id === retiring.id).length}
          onClose={() => setRetiring(null)}
          onAnnounce={onAnnounce}
        />
      )}
    </div>
  );
}

type DraftItem = ConsentFormItem & { uid: string };
let uidSeq = 0;
const newUid = () => `item-${++uidSeq}`;
const blankItem = (gate: ConsentGate): DraftItem => ({
  uid: newUid(),
  key: "",
  gate,
  label_th: "",
  label_en: "",
});

const ITEM_PROBLEM: Record<string, Localized> = {
  bad_key: {
    th: "รหัสข้อขึ้นต้นด้วย a-z และใช้ได้เฉพาะ a-z 0-9 และ _ ยาว 2 ถึง 40 ตัว",
    en: "Item key: starts with a-z, then a-z, 0-9 and _ only, 2 to 40 characters",
  },
  duplicate_key: { th: "รหัสข้อซ้ำกับข้ออื่น", en: "Item key is used twice" },
  label_th_required: { th: "ยังไม่มีข้อความภาษาไทย", en: "Thai wording is missing" },
  label_en_required: { th: "ยังไม่มีข้อความภาษาอังกฤษ", en: "English wording is missing" },
  too_few_items: { th: "ต้องมีอย่างน้อย 1 ข้อ", en: "Add at least one item" },
  too_many_items: {
    th: `มีได้ไม่เกิน ${MAX_FORM_ITEMS} ข้อ`,
    en: `At most ${MAX_FORM_ITEMS} items`,
  },
  needs_processing: {
    th: "ต้องมีอย่างน้อย 1 ข้อในกลุ่มบันทึกเสียงและประมวลผล",
    en: "Add at least one recording and processing item",
  },
  needs_research: {
    th: "ต้องมีอย่างน้อย 1 ข้อในกลุ่มใช้ในงานวิจัย",
    en: "Add at least one research use item",
  },
};

function FormEditorDialog({
  target,
  onClose,
  onAnnounce,
}: {
  target: EditorTarget;
  onClose: () => void;
  onAnnounce: (s: string) => void;
}) {
  const { t, lang } = useLanguage();
  const qc = useQueryClient();
  const saveFn = useServerFn(saveConsentForm);
  const id = useId();
  const source = target.mode === "edit" ? target.form : target.from;
  const isEdit = target.mode === "edit";

  const [version, setVersion] = useState("");
  const [title, setTitle] = useState(source?.title ?? "");
  const [items, setItems] = useState<DraftItem[]>(() =>
    source?.items.length
      ? source.items.map((it) => ({ ...it, uid: newUid() }))
      : [blankItem("processing"), blankItem("research")],
  );
  const [tried, setTried] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const problems = useMemo(() => {
    const out: string[] = [];
    if (!isEdit && !VERSION_PATTERN.test(version.trim())) {
      out.push(
        t({
          th: "เลขฉบับ: ใช้ตัวอักษรอังกฤษ ตัวเลข จุด ขีด หรือ _ เช่น v1.1-draft",
          en: "Version: letters, digits, dot, dash or _, for example v1.1-draft",
        }),
      );
    }
    if (!title.trim()) out.push(t({ th: "ยังไม่มีชื่อแบบฟอร์ม", en: "The form needs a title" }));
    const parsed = ConsentItemsSchema.safeParse(items.map(({ uid: _uid, ...it }) => it));
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const idx = typeof issue.path[0] === "number" ? issue.path[0] : null;
        const known = ITEM_PROBLEM[issue.message];
        const text = known
          ? t(known)
          : issue.code === "too_big"
            ? t({ th: "ข้อความยาวเกินไป", en: "Text is too long" })
            : t({ th: "ข้อมูลไม่ถูกต้อง", en: "Not valid" });
        out.push(
          idx !== null ? `${t({ th: `ข้อ ${idx + 1}`, en: `Item ${idx + 1}` })}: ${text}` : text,
        );
      }
    }
    return [...new Set(out)];
  }, [isEdit, version, title, items, t]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          id: isEdit ? target.form.id : undefined,
          version: isEdit ? undefined : version.trim(),
          title: title.trim(),
          items: items.map(({ uid: _uid, ...it }) => ({
            key: it.key.trim(),
            gate: it.gate,
            label_th: it.label_th.trim(),
            label_en: it.label_en.trim(),
          })),
        },
      }),
    onSuccess: (res) => {
      const text = isEdit
        ? t({ th: `บันทึกฉบับร่าง ${res.version} แล้ว`, en: `Draft ${res.version} saved` })
        : t({ th: `สร้างฉบับร่าง ${res.version} แล้ว`, en: `Draft ${res.version} created` });
      toast.success(text);
      onAnnounce(text);
      onClose();
    },
    onError: (err) => setProblem(t(saveError(err))),
    onSettled: () => qc.invalidateQueries({ queryKey: ["consent"] }),
  });

  const patch = (uid: string, change: Partial<ConsentFormItem>) =>
    setItems((prev) => prev.map((it) => (it.uid === uid ? { ...it, ...change } : it)));
  const move = (idx: number, dir: -1 | 1) =>
    setItems((prev) => {
      const next = [...prev];
      const [it] = next.splice(idx, 1);
      next.splice(idx + dir, 0, it);
      return next;
    });

  return (
    <SafeDialog
      busy={save.isPending}
      onClose={onClose}
      className={DIALOG.replace("max-w-lg", "max-w-3xl")}
    >
      <DialogHeader>
        <DialogTitle className="leading-snug break-words text-navy-900">
          {isEdit
            ? t({
                th: `แก้ไขฉบับร่าง ${target.form.version}`,
                en: `Edit draft ${target.form.version}`,
              })
            : source
              ? t({
                  th: `ฉบับร่างใหม่ จาก ${source.version}`,
                  en: `New draft from ${source.version}`,
                })
              : t({ th: "สร้างฉบับร่างใหม่", en: "New draft" })}
        </DialogTitle>
        <DialogDescription lang={lang}>
          {t({
            th: "เขียนข้อความให้ตรงกับแบบฟอร์มที่จะเสนอคณะกรรมการจริยธรรม ใช้ภาษาที่เข้าใจง่ายและเคารพทุกคน",
            en: "Write the wording exactly as it will go to the ethics committee. Keep it plain and respectful.",
          })}
        </DialogDescription>
      </DialogHeader>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setProblem(null);
          setTried(true);
          if (problems.length) return;
          save.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_1fr]">
          {isEdit ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-navy-500">
                {t({ th: "เลขฉบับ", en: "Version" })}
              </p>
              <p className="flex min-h-11 items-center font-mono text-navy-900">
                {target.form.version}
              </p>
            </div>
          ) : (
            <Field
              id={`${id}-version`}
              label={t({ th: "เลขฉบับ", en: "Version" })}
              required
              hint={t({ th: "เช่น v1.1-draft", en: "For example v1.1-draft" })}
            >
              <input
                id={`${id}-version`}
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                maxLength={40}
                autoComplete="off"
                aria-required
                aria-describedby={`${id}-version-hint`}
                className={`${INPUT} font-mono`}
              />
            </Field>
          )}
          <Field id={`${id}-title`} label={t({ th: "ชื่อแบบฟอร์ม", en: "Title" })} required>
            <input
              id={`${id}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              aria-required
              className={INPUT}
            />
          </Field>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-navy-500">
            {t({
              th: `ข้อความยินยอม (${items.length}/${MAX_FORM_ITEMS})`,
              en: `Items (${items.length}/${MAX_FORM_ITEMS})`,
            })}
          </h3>
          {items.map((it, idx) => (
            <fieldset key={it.uid} className="rounded-md border border-warm-200 p-3">
              <legend className="px-1 text-xs font-semibold text-warm-600">
                {t({ th: `ข้อ ${idx + 1}`, en: `Item ${idx + 1}` })}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  id={`${id}-${it.uid}-key`}
                  label={t({ th: "รหัสข้อ (a-z 0-9 _)", en: "Item key (a-z 0-9 _)" })}
                >
                  <input
                    id={`${id}-${it.uid}-key`}
                    value={it.key}
                    onChange={(e) =>
                      patch(it.uid, { key: e.target.value.toLowerCase().replace(/\s+/g, "_") })
                    }
                    maxLength={40}
                    autoComplete="off"
                    pattern={ITEM_KEY_PATTERN.source}
                    className={`${INPUT} font-mono`}
                  />
                </Field>
                <Field id={`${id}-${it.uid}-gate`} label={t({ th: "กลุ่ม", en: "Gate" })}>
                  <select
                    id={`${id}-${it.uid}-gate`}
                    value={it.gate}
                    onChange={(e) => patch(it.uid, { gate: e.target.value as ConsentGate })}
                    className={INPUT}
                  >
                    {CONSENT_GATES.map((g) => (
                      <option key={g} value={g}>
                        {t(GATE_LABEL[g].long)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  id={`${id}-${it.uid}-th`}
                  label={t({ th: "ข้อความภาษาไทย", en: "Thai wording" })}
                >
                  <textarea
                    id={`${id}-${it.uid}-th`}
                    lang="th"
                    value={it.label_th}
                    onChange={(e) => patch(it.uid, { label_th: e.target.value })}
                    maxLength={500}
                    rows={2}
                    className={TEXTAREA}
                  />
                </Field>
                <Field
                  id={`${id}-${it.uid}-en`}
                  label={t({ th: "ข้อความภาษาอังกฤษ", en: "English wording" })}
                >
                  <textarea
                    id={`${id}-${it.uid}-en`}
                    lang="en"
                    value={it.label_en}
                    onChange={(e) => patch(it.uid, { label_en: e.target.value })}
                    maxLength={500}
                    rows={2}
                    className={TEXTAREA}
                  />
                </Field>
              </div>
              <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className={BTN_ROW}
                  aria-label={t({ th: `เลื่อนข้อ ${idx + 1} ขึ้น`, en: `Move item ${idx + 1} up` })}
                >
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === items.length - 1}
                  className={BTN_ROW}
                  aria-label={t({ th: `เลื่อนข้อ ${idx + 1} ลง`, en: `Move item ${idx + 1} down` })}
                >
                  <ArrowDown className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((x) => x.uid !== it.uid))}
                  disabled={items.length <= 1}
                  className={BTN_ROW}
                  aria-label={t({ th: `ลบข้อ ${idx + 1}`, en: `Remove item ${idx + 1}` })}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  {t({ th: "ลบข้อนี้", en: "Remove" })}
                </button>
              </div>
            </fieldset>
          ))}
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, blankItem("optional")])}
            disabled={items.length >= MAX_FORM_ITEMS}
            className={BTN_SECONDARY}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t({ th: "เพิ่มข้อ", en: "Add item" })}
          </button>
        </div>

        {tried && problems.length > 0 && (
          <div
            role="alert"
            className="rounded-md border border-dignity/50 bg-dignity-soft/60 p-3 text-sm text-dignity-ink"
          >
            <p className="font-semibold">
              {t({ th: "แก้ตรงนี้ก่อนบันทึก", en: "Fix these before saving" })}
            </p>
            <ul className="mt-1 list-disc pl-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        <ErrorNote text={problem} />

        <DialogFooter className="gap-2 sm:space-x-0">
          <button
            type="button"
            onClick={onClose}
            disabled={save.isPending}
            className={BTN_SECONDARY}
          >
            {t({ th: "ยกเลิก", en: "Cancel" })}
          </button>
          <button type="submit" disabled={save.isPending} className={BTN_PRIMARY}>
            {save.isPending
              ? t({ th: "กำลังบันทึก...", en: "Saving..." })
              : t({ th: "บันทึกฉบับร่าง", en: "Save draft" })}
          </button>
        </DialogFooter>
      </form>
    </SafeDialog>
  );
}

function ApproveFormDialog({
  form,
  practiceRecords,
  onClose,
  onAnnounce,
}: {
  form: ConsentForm;
  /** People with practice records on this draft. Approval is refused while any exist. */
  practiceRecords: number;
  onClose: () => void;
  onAnnounce: (s: string) => void;
}) {
  const { t, lang } = useLanguage();
  const qc = useQueryClient();
  const approveFn = useServerFn(approveConsentForm);
  const id = useId();
  const today = todayInThailand();
  const [ref, setRef] = useState("");
  const [date, setDate] = useState(today);
  const [problem, setProblem] = useState<string | null>(null);
  const itemsOk = ConsentItemsSchema.safeParse(form.items).success;

  const save = useMutation({
    mutationFn: () =>
      approveFn({ data: { id: form.id, approvedRef: ref.trim(), approvedAt: date } }),
    onSuccess: (res) => {
      const text = t({
        th: `อนุมัติฉบับ ${res.version} แล้ว`,
        en: `Version ${res.version} approved`,
      });
      toast.success(text);
      onAnnounce(text);
      onClose();
    },
    onError: (err) => setProblem(t(saveError(err))),
    onSettled: () => qc.invalidateQueries({ queryKey: ["consent"] }),
  });

  return (
    <SafeDialog busy={save.isPending} onClose={onClose}>
      <DialogHeader>
        <DialogTitle className="leading-snug break-words text-navy-900">
          {t({ th: `อนุมัติฉบับ ${form.version}`, en: `Approve ${form.version}` })}
        </DialogTitle>
        <DialogDescription lang={lang}>
          {t({
            th: "ตรวจข้อความทุกข้อให้ตรงกับฉบับที่คณะกรรมการจริยธรรมรับรอง อนุมัติแล้วแก้ไขข้อความไม่ได้ และความยินยอมที่บันทึกในฉบับนี้หลังอนุมัติจะนับ",
            en: "Check every item matches the version the ethics committee approved. Once approved the wording cannot change, and consent recorded on it from then on counts.",
          })}
        </DialogDescription>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setProblem(null);
          if (!ref.trim()) {
            setProblem(t({ th: "กรอกเลขอ้างอิงการรับรอง", en: "Enter the approval reference." }));
            return;
          }
          if (!date || date > today) {
            setProblem(
              t({
                th: "วันที่อนุมัติต้องไม่เป็นวันในอนาคต",
                en: "The approval date cannot be in the future.",
              }),
            );
            return;
          }
          save.mutate();
        }}
      >
        {!itemsOk && <ErrorNote text={t(saveError(new Error("CONSENT_FORM_INVALID")))} />}
        {practiceRecords > 0 && (
          <ErrorNote
            text={t({
              th: `ฉบับร่างนี้มีบันทึกฝึกของผู้เข้าร่วม ${practiceRecords} คน จึงอนุมัติไม่ได้ เพื่อไม่ให้บันทึกฝึกกลายเป็นความยินยอมจริง ให้ปิดหน้าต่างนี้ กดคัดลอกเป็นร่างใหม่ แล้วอนุมัติฉบับใหม่แทน`,
              en: `${practiceRecords} participant(s) have practice records on this draft, so it cannot be approved: practice must never turn into real consent. Close this, use Copy to draft, and approve the new draft instead.`,
            })}
          />
        )}
        <Field
          id={`${id}-ref`}
          label={t({
            th: "เลขอ้างอิงจากคณะกรรมการจริยธรรมการวิจัยในมนุษย์",
            en: "Human research ethics committee reference",
          })}
          required
        >
          <input
            id={`${id}-ref`}
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            maxLength={120}
            autoComplete="off"
            aria-required
            className={INPUT}
          />
        </Field>
        <Field id={`${id}-date`} label={t({ th: "วันที่อนุมัติ", en: "Approval date" })} required>
          <input
            id={`${id}-date`}
            type="date"
            value={date}
            max={today}
            min="2020-01-01"
            onChange={(e) => setDate(e.target.value)}
            required
            className={INPUT}
          />
        </Field>
        <ErrorNote text={problem} />
        <DialogFooter className="gap-2 sm:space-x-0">
          <button
            type="button"
            onClick={onClose}
            disabled={save.isPending}
            className={BTN_SECONDARY}
          >
            {t({ th: "ยกเลิก", en: "Cancel" })}
          </button>
          <button
            type="submit"
            disabled={save.isPending || !itemsOk || practiceRecords > 0}
            className={BTN_PRIMARY}
          >
            <BadgeCheck className="h-4 w-4" aria-hidden />
            {save.isPending
              ? t({ th: "กำลังบันทึก...", en: "Saving..." })
              : t({ th: "อนุมัติฉบับนี้", en: "Approve this version" })}
          </button>
        </DialogFooter>
      </form>
    </SafeDialog>
  );
}

function RetireFormDialog({
  form,
  affected,
  onClose,
  onAnnounce,
}: {
  form: ConsentForm;
  affected: number;
  onClose: () => void;
  onAnnounce: (s: string) => void;
}) {
  const { t, lang } = useLanguage();
  const qc = useQueryClient();
  const retireFn = useServerFn(retireConsentForm);
  const [problem, setProblem] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => retireFn({ data: { id: form.id } }),
    onSuccess: (res) => {
      const text = t({
        th: `เลิกใช้ฉบับ ${res.version} แล้ว`,
        en: `Version ${res.version} retired`,
      });
      toast.success(text);
      onAnnounce(text);
      onClose();
    },
    onError: (err) => setProblem(t(saveError(err))),
    onSettled: () => qc.invalidateQueries({ queryKey: ["consent"] }),
  });

  return (
    <SafeDialog busy={save.isPending} onClose={onClose}>
      <DialogHeader>
        <DialogTitle className="leading-snug break-words text-navy-900">
          {t({ th: `เลิกใช้ฉบับ ${form.version}`, en: `Retire ${form.version}` })}
        </DialogTitle>
        <DialogDescription lang={lang}>
          {t({
            th: "ความยินยอมที่บันทึกในฉบับนี้จะไม่นับอีกต่อไป ผู้เข้าร่วมต้องให้ความยินยอมใหม่ในฉบับที่อนุมัติอื่น การเลิกใช้ย้อนกลับไม่ได้",
            en: "Consent recorded on this version will no longer count. Participants need to give consent again on another approved version. This cannot be undone.",
          })}
        </DialogDescription>
      </DialogHeader>
      <p
        lang={lang}
        className="rounded-md border border-lavender-300 bg-lavender-100/60 p-3 text-sm text-navy-700"
        role="status"
      >
        {affected > 0
          ? t({
              th: `ตอนนี้มีผู้เข้าร่วม ${affected} คนที่สถานะอ้างอิงจากฉบับนี้ หลังเลิกใช้ สถานะของเขาจะอ้างอิงฉบับที่อนุมัติอื่นที่เขาเคยให้ไว้ ถ้าไม่มี จะเป็น "แบบฟอร์มยังไม่อนุมัติ" จนกว่าจะบันทึกในฉบับใหม่`,
              en: `${affected} participant(s) currently have their status based on this version. After retiring, their status falls back to another approved version they gave, or shows "Form not approved" until recorded on a new version.`,
            })
          : t({
              th: "ไม่มีผู้เข้าร่วมที่สถานะอ้างอิงจากฉบับนี้",
              en: "No participant's status is based on this version.",
            })}
      </p>
      <ErrorNote text={problem} />
      <DialogFooter className="gap-2 sm:space-x-0">
        <button type="button" onClick={onClose} disabled={save.isPending} className={BTN_SECONDARY}>
          {t({ th: "ยกเลิก", en: "Cancel" })}
        </button>
        <button
          type="button"
          onClick={() => {
            setProblem(null);
            save.mutate();
          }}
          disabled={save.isPending}
          className={BTN_PRIMARY}
        >
          <Archive className="h-4 w-4" aria-hidden />
          {save.isPending
            ? t({ th: "กำลังบันทึก...", en: "Saving..." })
            : t({ th: "เลิกใช้ฉบับนี้", en: "Retire this version" })}
        </button>
      </DialogFooter>
    </SafeDialog>
  );
}

// ---------------------------------------------------------------------------
// Withdrawals log
// ---------------------------------------------------------------------------

function WithdrawalsPanel({
  withdrawals,
  isLoading,
  error,
}: {
  withdrawals: WithdrawalEvent[];
  isLoading: boolean;
  error: unknown;
}) {
  const { t, lang } = useLanguage();
  return (
    <div className="space-y-4">
      <p lang={lang} className="max-w-2xl text-sm text-warm-600">
        {t({
          th: "ทุกครั้งที่บันทึกการถอน ระบบเก็บไว้ที่นี่พร้อมจำนวนรอบบันทึกที่ถูกพักไว้ให้ผู้ดูแลข้อมูลตรวจ แสดงเฉพาะรหัส ไม่แสดงชื่อ",
          en: "Every recorded withdrawal is kept here with the number of sessions put on hold for the data steward. Codes only, no names.",
        })}
      </p>
      <PanelError error={error} />
      {isLoading && (
        <p role="status" aria-busy="true" className="text-sm text-warm-600">
          {t({ th: "กำลังโหลด...", en: "Loading..." })}
        </p>
      )}
      {!isLoading && !error && withdrawals.length === 0 && (
        <div className="rounded-lg border border-dashed border-warm-300 bg-white px-6 py-12 text-center">
          <History className="mx-auto h-8 w-8 text-warm-400" aria-hidden />
          <p lang={lang} className="mt-3 text-sm text-warm-600">
            {t({ th: "ยังไม่มีการถอนความยินยอม", en: "No withdrawals recorded" })}
          </p>
        </div>
      )}
      {withdrawals.length > 0 && (
        <section className="rounded-lg border border-warm-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-warm-50 text-left text-xs text-warm-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">
                    {t({ th: "บันทึกเมื่อ", en: "Recorded" })}
                  </th>
                  <th className="px-3 py-2 font-semibold">{t({ th: "รหัส", en: "Code" })}</th>
                  <th className="px-3 py-2 font-semibold">{t({ th: "ขอบเขต", en: "Scope" })}</th>
                  <th className="px-3 py-2 font-semibold">
                    {t({ th: "รอบบันทึกที่พักไว้", en: "Sessions on hold" })}
                  </th>
                  <th className="px-3 py-2 font-semibold">{t({ th: "บันทึกสั้น", en: "Note" })}</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id} className="border-t border-warm-100 align-top">
                    <td className="px-3 py-3 whitespace-nowrap text-warm-700">
                      {fmtDate(w.recordedAt, lang, true)}
                    </td>
                    <td className="px-3 py-3 font-mono font-semibold whitespace-nowrap text-navy-900">
                      {w.pseudoCode ?? "-"}
                    </td>
                    <td className="px-3 py-3 text-navy-500">{t(SCOPE_LABEL[w.scope].label)}</td>
                    <td className="px-3 py-3 text-navy-500">{w.sessionsPutOnHold}</td>
                    <td className="px-3 py-3 break-words whitespace-pre-wrap text-warm-700">
                      {w.note ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
