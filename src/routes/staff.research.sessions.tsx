import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AudioLines,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CirclePause,
  ClipboardCheck,
  FileAudio,
  Headphones,
  Lock,
  LockOpen,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Upload,
  Users,
  X,
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
import { supabase } from "@/integrations/supabase/client";
import {
  AUDIO_CONTENT_TYPES,
  MAX_AUDIO_BYTES,
  PARTICIPANT_ROLES,
  SESSION_STATUSES,
  SESSION_TYPES,
  attestOutOfScope,
  confirmAudioUpload,
  confirmSpeakerGuidance,
  createAudioUploadUrl,
  createSession,
  getAudioPlaybackUrl,
  listParticipantCodes,
  listSessions,
  setSessionParticipants,
  setSessionStatus,
  updateSession,
  type AudioContentType,
  type CaptureSession,
  type GateReason,
  type ParticipantRole,
  type SessionClearance,
  type SessionsAccess,
  type SessionStatus,
  type SessionType,
  type StudySettingsView,
} from "@/lib/research-sessions.functions";
import { useLanguage, type Localized } from "@/lib/language-context";

export const Route = createFileRoute("/staff/research/sessions")({
  component: SessionsPage,
});

const SESSIONS_KEY = ["research-sessions"] as const;
const CODES_KEY = ["research-participant-codes"] as const;
const BUCKET = "research-raw";

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------
const TYPE_LABEL: Record<SessionType, Localized> = {
  monthly_training: { th: "อบรมประจำเดือน", en: "Monthly training" },
  elicitation_circle: { th: "วงถอดความรู้", en: "Elicitation circle" },
  on_the_job: { th: "การสอนงาน", en: "On-the-job coaching" },
  lesson_debrief: { th: "ถอดบทเรียน", en: "Lesson debrief" },
  interview: { th: "สัมภาษณ์", en: "Interview" },
  retrospective: { th: "ทบทวนย้อนหลัง", en: "Retrospective" },
};

// On hold is gold, never red: it is a pause for care, not a fault.
const STATUS: Record<SessionStatus, { label: Localized; tone: string }> = {
  draft: {
    label: { th: "ร่าง", en: "Draft" },
    tone: "border-warm-300 bg-warm-50 text-warm-700",
  },
  ready: {
    label: { th: "พร้อมบันทึก", en: "Ready to record" },
    tone: "border-lavender-300 bg-lavender-100 text-lavender-900",
  },
  recorded: {
    label: { th: "บันทึกแล้ว", en: "Recorded" },
    tone: "border-accuracy/40 bg-accuracy-soft text-accuracy-ink",
  },
  on_hold: {
    label: { th: "พักไว้รอทบทวน", en: "On hold for review" },
    tone: "border-dignity/50 bg-dignity-soft text-dignity-ink",
  },
  closed: {
    label: { th: "ปิดแล้ว", en: "Closed" },
    tone: "border-warm-300 bg-warm-100 text-warm-600",
  },
};

const ROLE_LABEL: Record<ParticipantRole, Localized> = {
  speaker: { th: "ผู้พูด", en: "Speaker" },
  interviewee: { th: "ผู้ให้สัมภาษณ์", en: "Interviewee" },
  facilitator: { th: "ผู้ดำเนินวง", en: "Facilitator" },
};

const GATE_LABEL: Record<GateReason, Localized> = {
  collection_locked: {
    th: "ยังไม่เปิดบันทึกเสียงเพื่องานวิจัย (รออนุมัติจริยธรรมและ MoU)",
    en: "Recording for research is not open yet (waiting for ethics approval and the MoU)",
  },
  no_speakers: {
    th: "ยังไม่ได้เพิ่มผู้พูดใน session นี้",
    en: "No speakers have been added to this session yet",
  },
  processing_not_cleared: {
    th: "ยังมีผู้พูดที่ยังไม่พร้อม ให้ผู้ขอความยินยอมตรวจสอบ",
    en: "Some speakers are not ready yet. Ask the consent officer to check.",
  },
  guidance_missing: {
    th: "ยังไม่ได้บันทึกว่าอ่านคำแนะนำให้ผู้พูดฟังแล้ว (ข้อ 1)",
    en: "Speaker guidance has not been recorded yet (step 1)",
  },
  out_of_scope_missing: {
    th: "ยังไม่ได้ยืนยันว่าไม่มีข้อมูลนอกขอบเขต (ข้อ 2)",
    en: "The out-of-scope check has not been confirmed yet (step 2)",
  },
  on_hold: {
    th: "session นี้พักไว้รอทบทวน หรือปิดแล้ว",
    en: "This session is on hold for review, or closed",
  },
  audio_exists: {
    th: "session นี้มีไฟล์เสียงแล้ว",
    en: "This session already has audio",
  },
};

const GUIDANCE: Localized = {
  th: "ขอไม่เอ่ยชื่อผู้รับบริการหรือบุคคลที่สาม และไม่เล่ารายละเอียดที่ระบุตัวคนได้",
  en: "Please do not say the names of service users or other people, and do not share details that could identify someone.",
};

const OUT_OF_SCOPE: Localized = {
  th: "ในวงนี้ไม่มีการเล่าข้อมูลสุขภาพของใครเป็นรายบุคคล ไม่มีข้อมูลจากบันทึกการให้บริการ และไม่มีเรื่องร้องเรียนของ SWING RIGHTS",
  en: "This session has no individual health information, no service records and no SWING RIGHTS cases.",
};

const NOT_READY: Localized = {
  th: "ยังมีผู้พูดที่ยังไม่พร้อม ให้ผู้ขอความยินยอมตรวจสอบ",
  en: "Some speakers are not ready yet. Ask the consent officer to check.",
};

const ERRORS: Record<string, Localized> = {
  SESSIONS_TABLE_MISSING: {
    th: "ยังไม่ได้รัน migration ของ session เก็บข้อมูล",
    en: "The capture sessions migration has not been applied yet",
  },
  SESSIONS_FORBIDDEN: {
    th: "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้",
    en: "This account cannot do this",
  },
  RESEARCH_FORBIDDEN: {
    th: "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้",
    en: "This account cannot do this",
  },
  Unauthorized: {
    th: "หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง",
    en: "Your sign-in has expired. Please sign in again.",
  },
  SESSIONS_NOT_FOUND: {
    th: "ไม่พบ session นี้ หรือบัญชีนี้ไม่มีสิทธิ์เข้าถึง",
    en: "Session not found, or this account cannot open it",
  },
  SESSIONS_LOCKED: {
    th: "แก้ไขไม่ได้แล้ว เพราะ session นี้มีไฟล์เสียง พักไว้ หรือปิดแล้ว",
    en: "This can no longer be changed: the session has audio, is on hold, or is closed",
  },
  SESSIONS_AUDIO_FROZEN: {
    th: "รายชื่อผู้พูดล็อกแล้ว เพราะมีไฟล์เสียงแล้ว",
    en: "The speaker list is locked because audio exists",
  },
  SESSIONS_BAD_DEPARTMENT: {
    th: "แผนกนี้ไม่อยู่ในรายการของโครงการ",
    en: "This department is not in the study list",
  },
  SESSIONS_BAD_SITE: {
    th: "พื้นที่นี้ไม่อยู่ในรายการของโครงการ",
    en: "This site is not in the study list",
  },
  SESSIONS_DEPARTMENT_NOT_YOURS: {
    th: "บัญชีนี้ดูแลได้เฉพาะแผนกของตัวเอง",
    en: "This account can only work on its own department",
  },
  SESSIONS_GUIDANCE_NOT_SET: {
    th: "ยังไม่ได้ตั้งฉบับคำแนะนำผู้พูด ให้ทีมวิจัยตั้งที่หน้าทีมวิจัยก่อน",
    en: "No speaker guidance version is set yet. The research team sets it on the team page.",
  },
  // Deliberately general: why a code cannot be added is for the consent officer to see.
  SESSIONS_BAD_PARTICIPANT: {
    th: "มีรหัสที่เพิ่มใน session นี้ไม่ได้ ลองรีเฟรชรายการรหัส หรือสอบถามผู้ขอความยินยอม",
    en: "One of the codes cannot be added to this session. Refresh the codes, or ask the consent officer.",
  },
  SESSIONS_BAD_PATH: {
    th: "ไม่พบไฟล์ที่อัปโหลด ลองอัปโหลดใหม่อีกครั้ง",
    en: "The uploaded file was not found. Try uploading again.",
  },
  SESSIONS_UPLOAD_NOT_FOUND: {
    th: "ไม่พบไฟล์ที่อัปโหลด ลองอัปโหลดใหม่อีกครั้ง",
    en: "The uploaded file was not found. Try uploading again.",
  },
  SESSIONS_UPLOAD_SIZE_MISMATCH: {
    th: "ขนาดไฟล์ที่ระบบได้รับไม่ตรงกับไฟล์ต้นฉบับ ลองอัปโหลดใหม่",
    en: "The stored file size does not match the original. Try uploading again.",
  },
  SESSIONS_AUDIO_EXISTS: {
    th: "session นี้มีไฟล์เสียงแล้ว",
    en: "This session already has audio",
  },
  SESSIONS_NO_AUDIO: {
    th: "session นี้ยังไม่มีไฟล์เสียง",
    en: "This session has no audio yet",
  },
  SESSIONS_NOT_ON_HOLD: {
    th: "session นี้ไม่ได้พักไว้แล้ว รีเฟรชเพื่อดูสถานะล่าสุด",
    en: "This session is no longer on hold. Refresh to see the latest status.",
  },
  SESSIONS_ON_HOLD: {
    th: "session นี้พักไว้รอทบทวนหรือปิดแล้ว จึงเปิดฟังได้เฉพาะ data steward",
    en: "This session is on hold or closed, so only a data steward can play it",
  },
  SESSIONS_NOT_CLEARED: {
    th: "ยังเปิดฟังไม่ได้ในตอนนี้ เพราะยังมีผู้พูดที่ยังไม่พร้อม ให้ผู้ขอความยินยอมตรวจสอบ",
    en: "It cannot be played right now because some speakers are not ready. Ask the consent officer to check.",
  },
  SESSIONS_AUDIT_FAILED: {
    th: "บันทึกประวัติการเข้าถึงไม่สำเร็จ จึงยังเปิดไฟล์ให้ไม่ได้ ลองใหม่อีกครั้ง",
    en: "The access log could not be written, so the file was not opened. Try again.",
  },
  SESSIONS_STORAGE_ERROR: {
    th: "ระบบจัดเก็บไฟล์ขัดข้อง ลองใหม่อีกครั้ง",
    en: "File storage had a problem. Try again.",
  },
};

function errorCode(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /SESSIONS_[A-Z_]+|RESEARCH_FORBIDDEN|Unauthorized/.exec(msg)?.[0] ?? null;
}

function errorKind(err: unknown): "missing" | "forbidden" | "other" | null {
  if (!err) return null;
  const code = errorCode(err);
  if (code === "SESSIONS_TABLE_MISSING") return "missing";
  if (code === "SESSIONS_FORBIDDEN" || code === "RESEARCH_FORBIDDEN" || code === "Unauthorized") {
    return "forbidden";
  }
  return "other";
}

function errorText(err: unknown, t: (l: Localized) => string): string {
  const code = errorCode(err);
  if (code && ERRORS[code]) return t(ERRORS[code]);
  const msg = err instanceof Error ? err.message : "";
  if (msg.trim().startsWith("[")) {
    // zod issues from the server: the input did not pass validation
    return t({
      th: "ข้อมูลไม่ครบหรือไม่ถูกต้อง ตรวจอีกครั้งแล้วลองใหม่",
      en: "Some details are missing or not valid. Check and try again.",
    });
  }
  return t({ th: "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง", en: "That did not work. Try again." });
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
function fmtDate(value: string | null, lang: string) {
  if (!value) return "-";
  const dateOnly = value.length === 10;
  const d = new Date(dateOnly ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(lang === "th" ? "th-TH" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(dateOnly ? { timeZone: "UTC" } : { hour: "2-digit", minute: "2-digit" }),
  }).format(d);
}

function fmtBytes(n: number | null) {
  if (n == null) return "-";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDuration(sec: number | null) {
  if (!sec) return "-";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

const todayLocal = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD

// Shared control styles: every control is at least 44px tall.
const INPUT =
  "h-11 w-full rounded-md border border-warm-300 bg-white px-3 text-sm text-navy-900 disabled:bg-warm-50 disabled:text-warm-600";
const BTN_PRIMARY =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-navy-500 px-4 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50";
const BTN_SECONDARY =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-warm-300 bg-white px-4 text-sm font-medium text-navy-900 hover:bg-warm-50 disabled:opacity-50";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
function SessionsPage() {
  const { t, lang } = useLanguage();
  const list = useServerFn(listSessions);
  const query = useQuery({ queryKey: SESSIONS_KEY, queryFn: () => list(), retry: false });
  const sessions = useMemo(() => query.data?.sessions ?? [], [query.data]);
  const settings = query.data?.settings;
  const access = query.data?.access;

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<SessionStatus | "">("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sessions.filter(
      (s) =>
        (!status || s.status === status) &&
        (!needle ||
          [
            s.code,
            s.title,
            s.department,
            s.site,
            TYPE_LABEL[s.sessionType].th,
            TYPE_LABEL[s.sessionType].en,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(needle)),
    );
  }, [sessions, q, status]);

  const kind = errorKind(query.error);
  const selected = openId ? sessions.find((s) => s.id === openId) : undefined;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-navy-900">
            <AudioLines className="h-6 w-6 shrink-0 text-accuracy" aria-hidden />
            {t({ th: "Session เก็บข้อมูล", en: "Capture sessions" })}
          </h1>
          <p lang={lang} className="mt-1 max-w-2xl text-sm text-warm-600">
            {t({
              th: "วางแผนวงเก็บข้อมูล เพิ่มผู้พูดด้วยรหัส ทำเช็กลิสต์ให้ครบ แล้วจึงอัปโหลดไฟล์เสียงเพื่องานวิจัย หน้านี้ไม่แสดงชื่อและไม่แสดงสถานะความยินยอมของใครเป็นรายคน",
              en: "Plan capture sessions, add speakers by code, complete the checklist, then upload audio for research. This page never shows names or anyone's individual consent.",
            })}
          </p>
        </div>
        {kind !== "forbidden" && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => query.refetch()} className={BTN_SECONDARY}>
              <RefreshCw
                className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`}
                aria-hidden
              />
              {t({ th: "รีเฟรช", en: "Refresh" })}
            </button>
            {settings && access && (
              <button onClick={() => setCreateOpen(true)} className={BTN_PRIMARY}>
                <Plus className="h-4 w-4" aria-hidden />
                {t({ th: "วางแผน session ใหม่", en: "Plan a session" })}
              </button>
            )}
          </div>
        )}
      </header>

      {kind === "forbidden" && (
        <div
          role="alert"
          className="rounded-lg border border-warm-200 bg-white px-6 py-12 text-center"
        >
          <Lock className="mx-auto h-8 w-8 text-warm-500" aria-hidden />
          <p lang={lang} className="mt-3 text-sm text-navy-500">
            {errorCode(query.error) === "Unauthorized"
              ? t(ERRORS.Unauthorized)
              : t({
                  th: "หน้านี้เปิดได้เฉพาะผู้ดูแลระบบ นักวิจัย data steward และผู้ประสานงานแผนก ถ้าต้องการสิทธิ์ ติดต่อผู้ดูแลระบบ",
                  en: "Only admins, researchers, data stewards and department coordinators can open this page. Ask an admin for access.",
                })}
          </p>
        </div>
      )}

      {(kind === "missing" || kind === "other") && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-dignity/50 bg-dignity-soft/60 p-4 text-sm text-dignity-ink"
        >
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p lang={lang}>
            {kind === "missing"
              ? t({
                  th: "ยังไม่มีตาราง session เก็บข้อมูลในฐานข้อมูล ให้สั่ง Lovable รัน migration 20261012150000_consent_and_capture.sql ก่อน",
                  en: "The capture session tables do not exist yet. Ask Lovable to run migration 20261012150000_consent_and_capture.sql.",
                })
              : t({
                  th: "โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชอีกครั้ง",
                  en: "Could not load. Refresh to try again.",
                })}
          </p>
        </div>
      )}

      {query.isLoading && (
        <p role="status" aria-busy="true" className="text-sm text-warm-600">
          {t({ th: "กำลังโหลด...", en: "Loading..." })}
        </p>
      )}

      {settings && <CollectionBanner settings={settings} />}

      {query.data && sessions.length === 0 && (
        <div className="rounded-lg border border-dashed border-warm-300 bg-white px-6 py-12 text-center">
          <ClipboardCheck className="mx-auto h-8 w-8 text-warm-400" aria-hidden />
          <p lang={lang} className="mt-3 text-sm text-warm-600">
            {t({
              th: "ยังไม่มี session เริ่มวางแผน session แรกได้เลย ระหว่างรออนุมัติก็วางแผนและเพิ่มผู้พูดไว้ก่อนได้",
              en: "No sessions yet. Plan the first one now: you can plan and add speakers while approval is pending.",
            })}
          </p>
          <button onClick={() => setCreateOpen(true)} className={`${BTN_PRIMARY} mt-4`}>
            <Plus className="h-4 w-4" aria-hidden />
            {t({ th: "วางแผน session ใหม่", en: "Plan a session" })}
          </button>
        </div>
      )}

      {sessions.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-warm-200 bg-white p-3">
            <label className="relative min-w-0 flex-1 basis-56">
              <span className="sr-only">{t({ th: "ค้นหา", en: "Search" })}</span>
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-warm-400"
                aria-hidden
              />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                maxLength={100}
                placeholder={t({
                  th: "ค้นหารหัส ชื่อ แผนก หรือพื้นที่",
                  en: "Search code, title, department or site",
                })}
                className={`${INPUT} pl-9`}
              />
            </label>
            <label className="min-w-0 flex-1 basis-44 text-sm sm:flex-none">
              <span className="sr-only">{t({ th: "สถานะ", en: "Status" })}</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as SessionStatus | "")}
                className={INPUT}
              >
                <option value="">{t({ th: "สถานะ: ทั้งหมด", en: "Status: all" })}</option>
                {SESSION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(STATUS[s].label)}
                  </option>
                ))}
              </select>
            </label>
            <p role="status" aria-live="polite" className="w-full text-sm text-warm-600 sm:w-auto">
              {t({
                th: `แสดง ${filtered.length} จาก ${sessions.length} session`,
                en: `Showing ${filtered.length} of ${sessions.length} sessions`,
              })}
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-warm-300 bg-white px-6 py-10 text-center text-sm text-warm-600">
              {t({ th: "ไม่มี session ที่ตรงกับตัวกรอง", en: "No sessions match these filters" })}
              <button
                onClick={() => {
                  setQ("");
                  setStatus("");
                }}
                className="ml-2 inline-flex min-h-11 items-center font-semibold text-accuracy-ink underline-offset-2 hover:underline"
              >
                {t({ th: "ล้างตัวกรอง", en: "Clear filters" })}
              </button>
            </div>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {filtered.map((s) => (
                <SessionCard key={s.id} session={s} onOpen={() => setOpenId(s.id)} />
              ))}
            </ul>
          )}
        </section>
      )}

      {settings && access && (
        <>
          <CreateDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            settings={settings}
            access={access}
            onCreated={(id) => {
              setCreateOpen(false);
              setOpenId(id);
            }}
          />
          <SessionDialog
            open={!!openId}
            onOpenChange={(o) => !o && setOpenId(null)}
            session={selected}
            loading={query.isFetching}
            settings={settings}
            access={access}
          />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------
function CollectionBanner({ settings }: { settings: StudySettingsView }) {
  const { t, lang } = useLanguage();
  if (!settings.collectionUnlocked) {
    return (
      <section
        aria-labelledby="collection-state"
        className="flex items-start gap-3 rounded-lg border border-lavender-300 bg-lavender-100/60 p-4 text-sm text-navy-700"
      >
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-lavender-900" aria-hidden />
        <div className="min-w-0">
          <h2 id="collection-state" className="font-semibold text-navy-900">
            {t({
              th: "ยังไม่เปิดบันทึกเสียงเพื่องานวิจัย",
              en: "Recording for research is not open yet",
            })}
          </h2>
          <p lang={lang} className="mt-1">
            {t({
              th: "การบันทึกเสียงและอัปโหลดเพื่องานวิจัยจะเปิดหลังได้รับอนุมัติจากคณะกรรมการจริยธรรมการวิจัยในมนุษย์และลงนาม MoU แล้ว ทีมวิจัยเปิดได้ที่หน้าทีมวิจัย ระหว่างนี้วางแผน session และเพิ่มผู้พูดไว้ก่อนได้ตามปกติ",
              en: "Recording and upload for research open once the ethics committee approval and the MoU are on file. The research team opens it on the team page. Meanwhile you can plan sessions and add speakers as usual.",
            })}
          </p>
          <Link
            to="/staff/research/team"
            className="mt-1 inline-flex min-h-11 items-center font-medium text-lavender-900 underline underline-offset-2"
          >
            {t({ th: "ไปหน้าทีมวิจัย", en: "Go to the team page" })}
          </Link>
        </div>
      </section>
    );
  }
  return (
    <section
      aria-labelledby="collection-state"
      className="flex items-start gap-3 rounded-lg border border-accuracy/40 bg-accuracy-soft/60 p-4 text-sm text-accuracy-ink"
    >
      <LockOpen className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0">
        <h2 id="collection-state" className="font-semibold">
          {t({
            th: "เปิดบันทึกและอัปโหลดเพื่องานวิจัยแล้ว",
            en: "Recording and upload for research are open",
          })}
        </h2>
        <p lang={lang} className="mt-1">
          {t({
            th: "ก่อนอัปโหลด ทุก session ต้องผ่านเช็กลิสต์ 3 ข้อ และผู้พูดทุกคนต้องพร้อมประมวลผล",
            en: "Before upload, every session needs the 3-step checklist and every speaker ready to process.",
          })}
        </p>
      </div>
    </section>
  );
}

function StatusChip({ status }: { status: SessionStatus }) {
  const { t } = useLanguage();
  const s = STATUS[status] ?? STATUS.draft;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-pill border px-2.5 py-1 text-xs font-semibold ${s.tone}`}
    >
      {status === "on_hold" && <CirclePause className="h-3.5 w-3.5" aria-hidden />}
      {t(s.label)}
    </span>
  );
}

/** Per-session flags only. Never says which person is missing. */
function ClearanceBadges({ clearance }: { clearance: SessionClearance | null }) {
  const { t, lang } = useLanguage();
  if (!clearance) {
    return (
      <p className="text-xs text-warm-600">
        {t({
          th: "ตรวจความพร้อมไม่ได้ในตอนนี้ ลองรีเฟรช",
          en: "Could not check readiness right now. Try refreshing.",
        })}
      </p>
    );
  }
  const items = [
    {
      key: "processing",
      ok: clearance.processing,
      yes: { th: "พร้อมประมวลผล", en: "Ready to process" },
      no: { th: "ยังไม่พร้อมประมวลผล", en: "Not yet ready to process" },
    },
    {
      key: "research",
      ok: clearance.research,
      yes: { th: "พร้อมใช้ในงานวิจัย", en: "Ready for research" },
      no: { th: "ยังไม่พร้อมใช้ในงานวิจัย", en: "Not yet ready for research" },
    },
  ];
  const allReady = clearance.processing && clearance.research;
  return (
    <div>
      <ul className="flex flex-wrap gap-2">
        {items.map((i) => (
          <li
            key={i.key}
            className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-medium ${
              i.ok
                ? "border-accuracy/40 bg-accuracy-soft text-accuracy-ink"
                : "border-warm-300 bg-warm-100 text-warm-600"
            }`}
          >
            {i.ok ? (
              <CircleCheck className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <CircleDashed className="h-3.5 w-3.5" aria-hidden />
            )}
            {t(i.ok ? i.yes : i.no)}
          </li>
        ))}
      </ul>
      {!allReady && (
        <p lang={lang} className="mt-1.5 text-xs text-warm-600">
          {clearance.speakers === 0
            ? t({
                th: "ยังไม่ได้เพิ่มผู้พูด เพิ่มด้วยรหัสในหน้ารายละเอียด",
                en: "No speakers yet. Add them by code in the details.",
              })
            : t(NOT_READY)}
        </p>
      )}
    </div>
  );
}

function SessionCard({ session: s, onOpen }: { session: CaptureSession; onOpen: () => void }) {
  const { t, lang } = useLanguage();
  const speakers = s.clearance?.speakers ?? s.participants.length;
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-lg border border-warm-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono font-semibold text-navy-900">{s.code}</span>
            <span className="rounded-pill bg-lavender-100 px-2 py-0.5 text-xs font-medium text-lavender-900">
              {t(TYPE_LABEL[s.sessionType])}
            </span>
          </p>
          <h2 className="mt-1 text-base font-semibold break-words text-navy-500">
            {s.title ?? (
              <span className="font-normal text-warm-600">
                {t({ th: "ยังไม่มีชื่อ session", en: "No title yet" })}
              </span>
            )}
          </h2>
        </div>
        <StatusChip status={s.status} />
      </div>
      <p className="text-sm break-words text-warm-600">
        {[s.department, s.site, fmtDate(s.heldAt, lang)].filter(Boolean).join(" · ")}
        {" · "}
        <span className="whitespace-nowrap">
          <Users className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
          {t({ th: `ผู้พูด ${speakers} คน`, en: `${speakers} speakers` })}
        </span>
        {s.hasAudio && (
          <>
            {" · "}
            <span className="whitespace-nowrap">
              <FileAudio className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
              {t({ th: "มีไฟล์เสียง", en: "Has audio" })}
            </span>
          </>
        )}
      </p>
      <ClearanceBadges clearance={s.clearance} />
      <button
        onClick={onOpen}
        aria-label={`${t({ th: "เปิดดูและจัดการ", en: "Open and manage" })} ${s.code}`}
        className={`${BTN_SECONDARY} mt-auto w-full sm:w-auto sm:self-start`}
      >
        {t({ th: "เปิดดูและจัดการ", en: "Open and manage" })}
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Session fields (create and edit)
// ---------------------------------------------------------------------------
type FormState = {
  sessionType: SessionType;
  title: string;
  department: string;
  site: string;
  heldAt: string;
  studyMonth: string;
  notes: string;
};

function departmentOptions(settings: StudySettingsView, access: SessionsAccess): string[] | null {
  if (access.allDepartments) return settings.departments.length ? settings.departments : null;
  return settings.departments.length
    ? access.departments.filter((d) => settings.departments.includes(d))
    : access.departments;
}

function emptyForm(settings: StudySettingsView, access: SessionsAccess): FormState {
  const depts = departmentOptions(settings, access);
  return {
    sessionType: "monthly_training",
    title: "",
    department: depts?.length === 1 ? depts[0] : "",
    site: settings.sites.length === 1 ? settings.sites[0] : "",
    heldAt: todayLocal(),
    studyMonth: "",
    notes: "",
  };
}

function formOf(s: CaptureSession): FormState {
  return {
    sessionType: s.sessionType,
    title: s.title ?? "",
    department: s.department ?? "",
    site: s.site ?? "",
    heldAt: s.heldAt ?? "",
    studyMonth: s.studyMonth ? String(s.studyMonth) : "",
    notes: s.notes ?? "",
  };
}

function payloadOf(f: FormState) {
  return {
    sessionType: f.sessionType,
    title: f.title.trim() || null,
    department: f.department.trim(),
    site: f.site.trim(),
    heldAt: f.heldAt,
    studyMonth: f.studyMonth ? Number(f.studyMonth) : null,
    notes: f.notes.trim() || null,
  };
}

const formComplete = (f: FormState) => !!(f.department.trim() && f.site.trim() && f.heldAt);

function Field({ id, label, children }: { id: string; label: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-navy-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function Required() {
  const { t } = useLanguage();
  return (
    <span className="ml-1 text-xs font-normal text-warm-600">
      {t({ th: "(จำเป็น)", en: "(required)" })}
    </span>
  );
}

function PlaceInput({
  id,
  value,
  onChange,
  options,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: string[] | null;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  if (!options) {
    return (
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={120}
        disabled={disabled}
        required
        className={INPUT}
      />
    );
  }
  // Keep an older value visible even if the study list has moved on.
  const all = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      required
      className={INPUT}
    >
      <option value="">{t({ th: "เลือก", en: "Choose" })}</option>
      {all.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function SessionFields({
  value: f,
  onChange,
  settings,
  access,
  disabled,
}: {
  value: FormState;
  onChange: (f: FormState) => void;
  settings: StudySettingsView;
  access: SessionsAccess;
  disabled?: boolean;
}) {
  const { t, lang } = useLanguage();
  const id = useId();
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => onChange({ ...f, [k]: v });
  const depts = departmentOptions(settings, access);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id={`${id}-type`} label={t({ th: "ประเภท session", en: "Session type" })}>
        <select
          id={`${id}-type`}
          value={f.sessionType}
          onChange={(e) => set("sessionType", e.target.value as SessionType)}
          disabled={disabled}
          className={INPUT}
        >
          {SESSION_TYPES.map((s) => (
            <option key={s} value={s}>
              {t(TYPE_LABEL[s])}
            </option>
          ))}
        </select>
      </Field>
      <Field id={`${id}-title`} label={t({ th: "ชื่อ session", en: "Title" })}>
        <input
          id={`${id}-title`}
          value={f.title}
          onChange={(e) => set("title", e.target.value)}
          maxLength={200}
          disabled={disabled}
          placeholder={t({ th: "เช่น วงถอดความรู้เรื่อง PrEP", en: "e.g. PrEP knowledge circle" })}
          className={INPUT}
        />
      </Field>
      <Field
        id={`${id}-dept`}
        label={
          <>
            {t({ th: "แผนก", en: "Department" })}
            <Required />
          </>
        }
      >
        <PlaceInput
          id={`${id}-dept`}
          value={f.department}
          onChange={(v) => set("department", v)}
          options={depts}
          disabled={disabled}
        />
        {depts && depts.length === 0 && (
          <p lang={lang} className="mt-1 text-xs text-warm-600">
            {t({
              th: "บัญชีนี้ยังไม่ได้ผูกกับแผนกใด ให้ผู้ดูแลระบบตั้งที่หน้าทีมวิจัย",
              en: "This account is not linked to a department yet. An admin can set it on the team page.",
            })}
          </p>
        )}
      </Field>
      <Field
        id={`${id}-site`}
        label={
          <>
            {t({ th: "พื้นที่", en: "Site" })}
            <Required />
          </>
        }
      >
        <PlaceInput
          id={`${id}-site`}
          value={f.site}
          onChange={(v) => set("site", v)}
          options={settings.sites.length ? settings.sites : null}
          disabled={disabled}
        />
      </Field>
      <Field
        id={`${id}-date`}
        label={
          <>
            {t({ th: "วันที่จัด", en: "Date held" })}
            <Required />
          </>
        }
      >
        <input
          id={`${id}-date`}
          type="date"
          min="2020-01-01"
          max="2100-12-31"
          value={f.heldAt}
          onChange={(e) => set("heldAt", e.target.value)}
          disabled={disabled}
          required
          className={INPUT}
        />
      </Field>
      <Field
        id={`${id}-month`}
        label={t({ th: "เดือนที่ของการศึกษา (1-12)", en: "Study month (1-12)" })}
      >
        <select
          id={`${id}-month`}
          value={f.studyMonth}
          onChange={(e) => set("studyMonth", e.target.value)}
          disabled={disabled}
          className={INPUT}
        >
          <option value="">{t({ th: "ไม่ระบุ", en: "Not set" })}</option>
          {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </Field>
      <div className="sm:col-span-2">
        <Field id={`${id}-notes`} label={t({ th: "บันทึกเพิ่มเติม", en: "Notes" })}>
          <textarea
            id={`${id}-notes`}
            value={f.notes}
            onChange={(e) => set("notes", e.target.value)}
            maxLength={2000}
            rows={3}
            disabled={disabled}
            className="w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-navy-900 disabled:bg-warm-50"
          />
        </Field>
        <p lang={lang} className="mt-1 text-xs text-warm-600">
          {t({
            th: "ชื่อ session และบันทึกเพิ่มเติม: ไม่ใส่ชื่อคนหรือข้อมูลที่ระบุตัวคนได้",
            en: "Title and notes: no names or details that could identify someone.",
          })}
        </p>
      </div>
    </div>
  );
}

function CreateDialog({
  open,
  onOpenChange,
  settings,
  access,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  settings: StudySettingsView;
  access: SessionsAccess;
  onCreated: (id: string) => void;
}) {
  const { t, lang } = useLanguage();
  const qc = useQueryClient();
  const create = useServerFn(createSession);
  const [form, setForm] = useState<FormState>(() => emptyForm(settings, access));

  const run = useMutation({
    mutationFn: () => create({ data: payloadOf(form) }),
    onSuccess: async (res) => {
      toast.success(
        t({
          th: `สร้าง ${res.code} แล้ว ต่อไปเพิ่มผู้พูดได้เลย`,
          en: `${res.code} created. Next, add the speakers.`,
        }),
      );
      setForm(emptyForm(settings, access));
      await qc.invalidateQueries({ queryKey: SESSIONS_KEY });
      onCreated(res.id);
    },
    onError: (err) => toast.error(errorText(err, t)),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (run.isPending) return;
        if (o) setForm(emptyForm(settings, access));
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{t({ th: "วางแผน session ใหม่", en: "Plan a session" })}</DialogTitle>
          <DialogDescription lang={lang}>
            {t({
              th: "รหัส session (เช่น S-001) ระบบตั้งให้เอง ผู้ที่สร้างจะเป็นผู้ดำเนินวง",
              en: "The session code (e.g. S-001) is set automatically. You are recorded as the facilitator.",
            })}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (formComplete(form)) run.mutate();
          }}
          className="space-y-4"
        >
          <SessionFields
            value={form}
            onChange={setForm}
            settings={settings}
            access={access}
            disabled={run.isPending}
          />
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={run.isPending}
              className={BTN_SECONDARY}
            >
              {t({ th: "ยกเลิก", en: "Cancel" })}
            </button>
            <button
              type="submit"
              disabled={!formComplete(form) || run.isPending}
              className={BTN_PRIMARY}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {run.isPending
                ? t({ th: "กำลังสร้าง...", en: "Creating..." })
                : t({ th: "สร้าง session", en: "Create session" })}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Session detail
// ---------------------------------------------------------------------------
function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-warm-200 bg-white p-4">
      <h3 className="flex items-center gap-2 text-base font-semibold text-navy-900">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function SessionDialog({
  open,
  onOpenChange,
  session,
  loading,
  settings,
  access,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  session: CaptureSession | undefined;
  loading: boolean;
  settings: StudySettingsView;
  access: SessionsAccess;
}) {
  const { t, lang } = useLanguage();
  const [busy, setBusy] = useState(false);
  const close = () => {
    if (!busy) onOpenChange(false);
  };
  const speakersKey = session
    ? session.participants
        .map((p) => `${p.participantId}:${p.role}`)
        .sort()
        .join(",")
    : "";

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent
        className="max-h-[92dvh] w-[calc(100%-1rem)] max-w-3xl overflow-y-auto bg-cream p-4 sm:p-6"
        onEscapeKeyDown={(e) => busy && e.preventDefault()}
        onInteractOutside={(e) => busy && e.preventDefault()}
      >
        {!session ? (
          <>
            <DialogHeader>
              <DialogTitle>{t({ th: "รายละเอียด session", en: "Session details" })}</DialogTitle>
              <DialogDescription>
                {loading
                  ? t({ th: "กำลังโหลด...", en: "Loading..." })
                  : t(ERRORS.SESSIONS_NOT_FOUND)}
              </DialogDescription>
            </DialogHeader>
          </>
        ) : (
          <>
            <DialogHeader className="pr-8 text-left">
              <DialogTitle className="flex flex-wrap items-center gap-2 text-navy-900">
                <span className="font-mono">{session.code}</span>
                <span className="text-base font-medium text-warm-600">
                  {t(TYPE_LABEL[session.sessionType])}
                </span>
                <StatusChip status={session.status} />
              </DialogTitle>
              <DialogDescription lang={lang}>
                {[session.title, session.department, session.site, fmtDate(session.heldAt, lang)]
                  .filter(Boolean)
                  .join(" · ")}
              </DialogDescription>
            </DialogHeader>

            {session.status === "on_hold" && (
              <div
                lang={lang}
                className="flex items-start gap-2 rounded-md border border-dignity/50 bg-dignity-soft/60 p-3 text-sm text-dignity-ink"
              >
                <CirclePause className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {t({
                  th: "session นี้พักไว้รอ data steward ทบทวน ระหว่างนี้ยังแก้ไขและอัปโหลดไม่ได้",
                  en: "This session is on hold until a data steward reviews it. It cannot be changed or uploaded meanwhile.",
                })}
              </div>
            )}

            <DetailsSection
              key={`details-${session.id}-${JSON.stringify(formOf(session))}`}
              session={session}
              settings={settings}
              access={access}
            />
            <SpeakersSection key={`speakers-${session.id}-${speakersKey}`} session={session} />
            {/* Keyed so a ticked attestation never carries over to another session. */}
            <ChecklistSection
              key={`checklist-${session.id}`}
              session={session}
              settings={settings}
            />
            <AudioSection
              key={`audio-${session.id}`}
              session={session}
              settings={settings}
              access={access}
              onBusy={setBusy}
            />
            {access.canReview && session.status === "on_hold" && (
              <ReviewSection key={`review-${session.id}`} session={session} />
            )}

            <DialogFooter>
              <button onClick={close} disabled={busy} className={BTN_SECONDARY}>
                {t({ th: "ปิดหน้าต่าง", en: "Close" })}
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailsSection({
  session,
  settings,
  access,
}: {
  session: CaptureSession;
  settings: StudySettingsView;
  access: SessionsAccess;
}) {
  const { t, lang } = useLanguage();
  const qc = useQueryClient();
  const update = useServerFn(updateSession);
  const [form, setForm] = useState<FormState>(() => formOf(session));
  const editable = session.status === "draft" || session.status === "ready";
  const dirty = JSON.stringify(payloadOf(form)) !== JSON.stringify(payloadOf(formOf(session)));

  const run = useMutation({
    mutationFn: () => update({ data: { sessionId: session.id, ...payloadOf(form) } }),
    onSuccess: () => toast.success(t({ th: "บันทึกรายละเอียดแล้ว", en: "Details saved" })),
    onError: (err) => toast.error(errorText(err, t)),
    onSettled: () => qc.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });

  return (
    <Section
      title={t({ th: "รายละเอียด", en: "Details" })}
      icon={<ClipboardCheck className="h-4 w-4 text-accuracy" aria-hidden />}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (editable && dirty && formComplete(form)) run.mutate();
        }}
        className="space-y-3"
      >
        <SessionFields
          value={form}
          onChange={setForm}
          settings={settings}
          access={access}
          disabled={!editable || run.isPending}
        />
        {editable ? (
          <div className="flex flex-wrap justify-end gap-2">
            {dirty && (
              <button
                type="button"
                onClick={() => setForm(formOf(session))}
                disabled={run.isPending}
                className={BTN_SECONDARY}
              >
                {t({ th: "ยกเลิกการแก้ไข", en: "Discard changes" })}
              </button>
            )}
            <button
              type="submit"
              disabled={!dirty || !formComplete(form) || run.isPending}
              className={BTN_PRIMARY}
            >
              <Save className="h-4 w-4" aria-hidden />
              {run.isPending
                ? t({ th: "กำลังบันทึก...", en: "Saving..." })
                : t({ th: "บันทึกรายละเอียด", en: "Save details" })}
            </button>
          </div>
        ) : (
          <p lang={lang} className="text-xs text-warm-600">
            {t({
              th: "แก้ไขรายละเอียดได้เฉพาะตอนที่ยังเป็นร่างหรือพร้อมบันทึก",
              en: "Details can only be changed while the session is a draft or ready to record.",
            })}
          </p>
        )}
      </form>
    </Section>
  );
}

type DraftLink = { participantId: string; pseudoCode: string; role: ParticipantRole };

function SpeakersSection({ session }: { session: CaptureSession }) {
  const { t, lang } = useLanguage();
  const qc = useQueryClient();
  const id = useId();
  // Same rule as the server: only while draft or ready, and never once audio exists.
  const frozen = session.hasAudio || (session.status !== "draft" && session.status !== "ready");
  const codesFn = useServerFn(listParticipantCodes);
  const codes = useQuery({
    queryKey: CODES_KEY,
    queryFn: () => codesFn(),
    enabled: !frozen,
    staleTime: 60_000,
    retry: false,
  });
  const save = useServerFn(setSessionParticipants);
  const [draft, setDraft] = useState<DraftLink[]>(() =>
    session.participants.map((p) => ({ ...p })),
  );
  const [q, setQ] = useState("");
  const defaultRole: ParticipantRole =
    session.sessionType === "interview" ? "interviewee" : "speaker";

  const key = (list: { participantId: string; role: string }[]) =>
    list
      .map((p) => `${p.participantId}:${p.role}`)
      .sort()
      .join(",");
  const dirty = key(draft) !== key(session.participants);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const taken = new Set(draft.map((d) => d.participantId));
    // The server returns active codes only.
    return (codes.data?.participants ?? [])
      .filter(
        (p) =>
          !taken.has(p.id) &&
          [p.pseudoCode, p.department, p.site]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(needle),
      )
      .slice(0, 8);
  }, [q, draft, codes.data]);

  const run = useMutation({
    mutationFn: () =>
      save({
        data: {
          sessionId: session.id,
          participants: draft.map((d) => ({ participantId: d.participantId, role: d.role })),
        },
      }),
    onSuccess: (res) =>
      toast.success(
        t({
          th: `บันทึกรายชื่อแล้ว ${res.total} คน`,
          en: `Speaker list saved: ${res.total}`,
        }),
      ),
    onError: (err) => toast.error(errorText(err, t)),
    onSettled: () => qc.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });

  return (
    <Section
      title={t({ th: "ผู้พูด (ใช้รหัสเท่านั้น)", en: "Speakers (codes only)" })}
      icon={<Users className="h-4 w-4 text-accuracy" aria-hidden />}
    >
      <p lang={lang} className="text-xs text-warm-600">
        {t({
          th: "หน้านี้แสดงเฉพาะรหัสผู้เข้าร่วม ไม่แสดงชื่อ และไม่แสดงสถานะความยินยอมของใครเป็นรายคน ถ้ายังไม่มีรหัส ให้ผู้ขอความยินยอมลงทะเบียนให้ก่อน",
          en: "Only participant codes are shown here: no names, and no one's individual consent. If someone has no code yet, the consent officer enrols them first.",
        })}
      </p>

      {draft.length === 0 ? (
        <p className="rounded-md border border-dashed border-warm-300 px-3 py-4 text-center text-sm text-warm-600">
          {t({ th: "ยังไม่มีผู้พูดใน session นี้", en: "No speakers in this session yet" })}
        </p>
      ) : (
        <ul className="space-y-2">
          {draft.map((d) => (
            <li
              key={d.participantId}
              className="flex flex-wrap items-center gap-2 rounded-md border border-warm-200 bg-warm-50/60 p-2"
            >
              <span className="min-w-16 font-mono font-semibold text-navy-900">{d.pseudoCode}</span>
              {frozen ? (
                <span className="text-sm text-warm-700">{t(ROLE_LABEL[d.role])}</span>
              ) : (
                <>
                  <label className="min-w-0 flex-1 basis-40">
                    <span className="sr-only">
                      {t({ th: `บทบาทของ ${d.pseudoCode}`, en: `Role of ${d.pseudoCode}` })}
                    </span>
                    <select
                      value={d.role}
                      onChange={(e) =>
                        setDraft((list) =>
                          list.map((x) =>
                            x.participantId === d.participantId
                              ? { ...x, role: e.target.value as ParticipantRole }
                              : x,
                          ),
                        )
                      }
                      disabled={run.isPending}
                      className={INPUT}
                    >
                      {PARTICIPANT_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t(ROLE_LABEL[r])}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((list) => list.filter((x) => x.participantId !== d.participantId))
                    }
                    disabled={run.isPending}
                    aria-label={t({ th: `เอา ${d.pseudoCode} ออก`, en: `Remove ${d.pseudoCode}` })}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-warm-300 bg-white text-warm-700 hover:bg-warm-100 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {frozen ? (
        <p lang={lang} className="text-xs text-warm-600">
          {session.hasAudio
            ? t({
                th: "รายชื่อผู้พูดล็อกแล้ว เพราะมีไฟล์เสียงแล้ว",
                en: "The speaker list is locked because audio exists.",
              })
            : session.status === "on_hold"
              ? t({
                  th: "รายชื่อผู้พูดล็อกไว้ระหว่างที่ session พักรอ data steward ทบทวน",
                  en: "The speaker list is locked while the session is on hold for a data steward to review.",
                })
              : t({ th: "session นี้ปิดแล้ว", en: "This session is closed." })}
        </p>
      ) : (
        <>
          <div>
            <label htmlFor={`${id}-find`} className="mb-1 block text-sm font-medium text-navy-500">
              {t({ th: "เพิ่มผู้พูดด้วยรหัส", en: "Add a speaker by code" })}
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-warm-400"
                aria-hidden
              />
              <input
                id={`${id}-find`}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                maxLength={60}
                placeholder={t({
                  th: "พิมพ์รหัส เช่น P-012 หรือชื่อแผนก",
                  en: "Type a code like P-012, or a department",
                })}
                aria-describedby={`${id}-find-status`}
                className={`${INPUT} pl-9`}
              />
            </div>
            <p
              id={`${id}-find-status`}
              role="status"
              aria-live="polite"
              className="mt-1 text-xs text-warm-600"
            >
              {codes.isLoading
                ? t({ th: "กำลังโหลดรหัส...", en: "Loading codes..." })
                : codes.error
                  ? errorText(codes.error, t)
                  : q.trim()
                    ? t({ th: `พบ ${matches.length} รหัส`, en: `${matches.length} codes found` })
                    : ""}
            </p>
            {matches.length > 0 && (
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {matches.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft((list) => [
                          ...list,
                          { participantId: p.id, pseudoCode: p.pseudoCode, role: defaultRole },
                        ]);
                        setQ("");
                      }}
                      className="flex min-h-11 w-full items-center gap-2 rounded-md border border-warm-300 bg-white px-3 py-2 text-left text-sm hover:bg-warm-50"
                    >
                      <Plus className="h-4 w-4 shrink-0 text-accuracy" aria-hidden />
                      <span className="font-mono font-semibold text-navy-900">{p.pseudoCode}</span>
                      <span className="min-w-0 truncate text-xs text-warm-600">
                        {[p.department, p.site].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {dirty && (
              <button
                type="button"
                onClick={() => setDraft(session.participants.map((p) => ({ ...p })))}
                disabled={run.isPending}
                className={BTN_SECONDARY}
              >
                {t({ th: "ยกเลิกการแก้ไข", en: "Discard changes" })}
              </button>
            )}
            <button
              type="button"
              onClick={() => run.mutate()}
              disabled={!dirty || run.isPending}
              className={BTN_PRIMARY}
            >
              <Save className="h-4 w-4" aria-hidden />
              {run.isPending
                ? t({ th: "กำลังบันทึก...", en: "Saving..." })
                : t({ th: `บันทึกรายชื่อ (${draft.length})`, en: `Save list (${draft.length})` })}
            </button>
          </div>
        </>
      )}
    </Section>
  );
}

function StepShell({
  n,
  done,
  title,
  children,
}: {
  n: number;
  done: boolean;
  title: string;
  children: ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <li className="flex gap-3 rounded-md border border-warm-200 bg-warm-50/60 p-3">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-pill text-sm font-semibold ${
          done ? "bg-accuracy text-white" : "border border-warm-400 bg-white text-warm-700"
        }`}
        aria-hidden
      >
        {done ? <CircleCheck className="h-4 w-4" /> : n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <h4 className="text-sm font-semibold text-navy-900">
          {title}
          <span className="sr-only">
            {done
              ? t({ th: " (เสร็จแล้ว)", en: " (done)" })
              : t({ th: " (ยังไม่เสร็จ)", en: " (not done)" })}
          </span>
        </h4>
        {children}
      </div>
    </li>
  );
}

function ChecklistSection({
  session,
  settings,
}: {
  session: CaptureSession;
  settings: StudySettingsView;
}) {
  const { t, lang } = useLanguage();
  const qc = useQueryClient();
  const id = useId();
  const guidanceFn = useServerFn(confirmSpeakerGuidance);
  const attestFn = useServerFn(attestOutOfScope);
  const [checked, setChecked] = useState(false);
  const open = !session.hasAudio && (session.status === "draft" || session.status === "ready");

  const guidance = useMutation({
    mutationFn: () => guidanceFn({ data: { sessionId: session.id } }),
    onSuccess: () =>
      toast.success(t({ th: "บันทึกว่าอ่านคำแนะนำแล้ว", en: "Speaker guidance recorded" })),
    onError: (err) => toast.error(errorText(err, t)),
    onSettled: () => qc.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
  const attest = useMutation({
    mutationFn: () => attestFn({ data: { sessionId: session.id } }),
    onSuccess: () => toast.success(t({ th: "ยืนยันแล้ว", en: "Confirmed" })),
    onError: (err) => toast.error(errorText(err, t)),
    onSettled: () => qc.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });

  return (
    <Section
      title={t({ th: "เช็กลิสต์ก่อนบันทึกเสียง", en: "Checklist before recording" })}
      icon={<ShieldCheck className="h-4 w-4 text-accuracy" aria-hidden />}
    >
      <ol className="space-y-3">
        <StepShell
          n={1}
          done={!!session.guidanceGivenAt}
          title={t({
            th: "อ่านคำแนะนำให้ผู้พูดฟังก่อนเริ่มบันทึก",
            en: "Read the speaker guidance aloud before recording",
          })}
        >
          <blockquote
            lang="th"
            className="rounded-md border-l-4 border-accuracy bg-white px-3 py-2 text-sm text-navy-900"
          >
            {GUIDANCE.th}
          </blockquote>
          {lang === "en" && <p className="text-xs text-warm-600">{GUIDANCE.en}</p>}
          {session.guidanceGivenAt ? (
            <p className="text-xs text-accuracy-ink">
              {t({ th: "อ่านแล้ว", en: "Read out" })} · {fmtDate(session.guidanceGivenAt, lang)}
              {session.guidanceVersion &&
                ` · ${t({ th: "ฉบับ", en: "version" })} ${session.guidanceVersion}`}
            </p>
          ) : !settings.speakerGuidanceVersion ? (
            <p lang={lang} className="text-xs text-warm-600">
              {t(ERRORS.SESSIONS_GUIDANCE_NOT_SET)}
            </p>
          ) : (
            open && (
              <button
                type="button"
                onClick={() => guidance.mutate()}
                disabled={guidance.isPending}
                className={BTN_SECONDARY}
              >
                <CircleCheck className="h-4 w-4 text-accuracy" aria-hidden />
                {guidance.isPending
                  ? t({ th: "กำลังบันทึก...", en: "Saving..." })
                  : t({
                      th: `บันทึกว่าอ่านให้ผู้พูดฟังแล้ว (ฉบับ ${settings.speakerGuidanceVersion})`,
                      en: `Record that it was read out (version ${settings.speakerGuidanceVersion})`,
                    })}
              </button>
            )
          )}
        </StepShell>

        <StepShell
          n={2}
          done={session.outOfScopeAttested}
          title={t({
            th: "ยืนยันว่าไม่มีข้อมูลนอกขอบเขต",
            en: "Confirm nothing out of scope",
          })}
        >
          <p lang={lang} className="text-sm text-navy-700">
            {t(OUT_OF_SCOPE)}
          </p>
          {session.outOfScopeAttested ? (
            <p className="text-xs text-accuracy-ink">{t({ th: "ยืนยันแล้ว", en: "Confirmed" })}</p>
          ) : (
            open && (
              <div className="flex flex-wrap items-center gap-3">
                <label
                  htmlFor={`${id}-scope`}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-navy-700"
                >
                  <input
                    id={`${id}-scope`}
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                    className="h-5 w-5 accent-[var(--color-accuracy)]"
                  />
                  {t({ th: "ฉันตรวจแล้วและยืนยันตามนี้", en: "I have checked and confirm this" })}
                </label>
                <button
                  type="button"
                  onClick={() => attest.mutate()}
                  disabled={!checked || attest.isPending}
                  className={BTN_SECONDARY}
                >
                  {attest.isPending
                    ? t({ th: "กำลังบันทึก...", en: "Saving..." })
                    : t({ th: "ยืนยัน", en: "Confirm" })}
                </button>
              </div>
            )
          )}
        </StepShell>

        <StepShell
          n={3}
          done={!!session.clearance?.processing}
          title={t({ th: "ความพร้อมด้านความยินยอม", en: "Consent readiness" })}
        >
          <ClearanceBadges clearance={session.clearance} />
          <p lang={lang} className="text-xs text-warm-600">
            {t({
              th: "ผู้ขอความยินยอมดูแลส่วนนี้ หน้านี้แสดงเฉพาะภาพรวมของทั้ง session จากใบยินยอมของผู้พูดทุกคนรวมกัน",
              en: "The consent officer looks after this. This page shows only the whole-session view, combined across every speaker's consent.",
            })}
          </p>
        </StepShell>
      </ol>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------
const EXT_TYPE: Record<string, AudioContentType> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  webm: "audio/webm",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  flac: "audio/flac",
};
const ACCEPT = `audio/*,${Object.keys(EXT_TYPE)
  .map((e) => `.${e}`)
  .join(",")}`;

function audioType(file: File): AudioContentType | null {
  if ((AUDIO_CONTENT_TYPES as readonly string[]).includes(file.type)) {
    return file.type as AudioContentType;
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TYPE[ext] ?? null;
}

async function sha256Hex(file: Blob) {
  // crypto.subtle has no streaming digest, so the file is read into memory once.
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function audioDuration(file: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (v: number | null) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () =>
      done(
        Number.isFinite(audio.duration) && audio.duration > 0 ? Math.round(audio.duration) : null,
      );
    audio.onerror = () => done(null);
    audio.src = url;
  });
}

/** Mirror of the server gate, to explain what is missing before anyone picks a file. */
function localReasons(s: CaptureSession, settings: StudySettingsView): GateReason[] {
  const r: GateReason[] = [];
  if (!settings.collectionUnlocked) r.push("collection_locked");
  if (s.clearance && s.clearance.speakers === 0) r.push("no_speakers");
  else if (s.clearance && !s.clearance.processing) r.push("processing_not_cleared");
  if (!s.guidanceGivenAt) r.push("guidance_missing");
  if (!s.outOfScopeAttested) r.push("out_of_scope_missing");
  if (s.status === "on_hold" || s.status === "closed") r.push("on_hold");
  if (s.hasAudio) r.push("audio_exists");
  return r;
}

type Stage =
  | "idle"
  | "hashing"
  | "hashed"
  | "checking"
  | "uploading"
  | "confirming"
  | "done"
  | "refused"
  | "error";

const BUSY: Stage[] = ["hashing", "checking", "uploading", "confirming"];

function AudioSection({
  session,
  settings,
  access,
  onBusy,
}: {
  session: CaptureSession;
  settings: StudySettingsView;
  access: SessionsAccess;
  onBusy: (busy: boolean) => void;
}) {
  const { t, lang } = useLanguage();
  return (
    <Section
      title={t({ th: "ไฟล์เสียง", en: "Audio" })}
      icon={<FileAudio className="h-4 w-4 text-accuracy" aria-hidden />}
    >
      {session.hasAudio ? (
        <>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
            <dt className="font-semibold text-navy-700">{t({ th: "ขนาด", en: "Size" })}</dt>
            <dd className="text-warm-700">{fmtBytes(session.audioBytes)}</dd>
            <dt className="font-semibold text-navy-700">{t({ th: "ความยาว", en: "Length" })}</dt>
            <dd className="text-warm-700">{fmtDuration(session.durationSec)}</dd>
            <dt className="font-semibold text-navy-700">
              {t({ th: "อัปโหลดเมื่อ", en: "Uploaded" })}
            </dt>
            <dd className="text-warm-700">{fmtDate(session.audioUploadedAt, lang)}</dd>
            <dt className="font-semibold text-navy-700">
              {t({ th: "เก็บไว้ถึง", en: "Kept until" })}
            </dt>
            <dd className="text-warm-700">{fmtDate(session.retentionUntil, lang)}</dd>
            <dt className="font-semibold text-navy-700">SHA-256</dt>
            <dd className="font-mono text-xs break-all text-warm-700">
              {session.audioSha256 ?? "-"}
            </dd>
          </dl>
          {access.canPlayback &&
          !access.canReview &&
          (session.status === "on_hold" || session.status === "closed") ? (
            <p lang={lang} className="text-xs text-warm-600">
              {t(ERRORS.SESSIONS_ON_HOLD)}
            </p>
          ) : access.canPlayback ? (
            <Playback key={session.id} sessionId={session.id} />
          ) : (
            <p lang={lang} className="text-xs text-warm-600">
              {t({
                th: "การเปิดฟังไฟล์เสียงดิบทำได้เฉพาะนักวิจัย data steward และผู้ดูแลระบบ",
                en: "Only researchers, data stewards and admins can play raw audio.",
              })}
            </p>
          )}
        </>
      ) : (
        <Uploader session={session} settings={settings} onBusy={onBusy} />
      )}
    </Section>
  );
}

function Uploader({
  session,
  settings,
  onBusy,
}: {
  session: CaptureSession;
  settings: StudySettingsView;
  onBusy: (busy: boolean) => void;
}) {
  const { t, lang } = useLanguage();
  const qc = useQueryClient();
  const id = useId();
  const requestUrl = useServerFn(createAudioUploadUrl);
  const confirm = useServerFn(confirmAudioUpload);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<AudioContentType | null>(null);
  const [sha, setSha] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [reasons, setReasons] = useState<GateReason[]>([]);
  const [message, setMessage] = useState("");
  const [heldAfterUpload, setHeldAfterUpload] = useState(false);
  // Set once the bytes are stored, so a failed confirm can be retried without a second upload.
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const pickToken = useRef(0);

  const busy = BUSY.includes(stage);
  useEffect(() => onBusy(busy), [busy, onBusy]);
  useEffect(() => () => onBusy(false), [onBusy]);
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  const blockers = localReasons(session, settings);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    const token = ++pickToken.current;
    setFile(null);
    setUploadedPath(null);
    setSha(null);
    setDuration(null);
    setReasons([]);
    setMessage("");
    setStage("idle");
    if (!picked) return;
    const ct = audioType(picked);
    if (!ct) {
      setStage("error");
      setMessage(
        t({
          th: "ไฟล์ชนิดนี้ใช้ไม่ได้ เลือกไฟล์เสียง m4a, mp3, wav, aac, ogg, webm หรือ flac",
          en: "This file type cannot be used. Choose an m4a, mp3, wav, aac, ogg, webm or flac audio file.",
        }),
      );
      return;
    }
    if (picked.size > MAX_AUDIO_BYTES) {
      setStage("error");
      setMessage(
        t({
          th: `ไฟล์ใหญ่ ${fmtBytes(picked.size)} เกิน 500 MB ลองแปลงเป็น m4a หรือ mp3 ที่ 64 kbps (ราว 30 MB ต่อชั่วโมง) แล้วอัปโหลดใหม่`,
          en: `This file is ${fmtBytes(picked.size)}, over 500 MB. Convert it to m4a or mp3 at 64 kbps (about 30 MB per hour) and try again.`,
        }),
      );
      return;
    }
    setFile(picked);
    setType(ct);
    setStage("hashing");
    try {
      const [hash, secs] = await Promise.all([sha256Hex(picked), audioDuration(picked)]);
      if (token !== pickToken.current) return; // a newer file was picked meanwhile
      setSha(hash);
      setDuration(secs);
      setStage("hashed");
    } catch {
      if (token !== pickToken.current) return;
      setStage("error");
      setMessage(
        t({
          th: "อ่านไฟล์ไม่ได้ ลองเลือกไฟล์อีกครั้ง",
          en: "Could not read the file. Try choosing it again.",
        }),
      );
    }
  };

  const upload = async () => {
    if (!file || !type || !sha) return;
    setReasons([]);
    setMessage("");
    try {
      let path = uploadedPath;
      if (!path) {
        setStage("checking");
        const grant = await requestUrl({
          data: {
            sessionId: session.id,
            // The real file name never leaves the browser: names of files often carry people's names.
            fileName: `recording.${type.replace("audio/", "")}`,
            contentType: type,
            bytes: file.size,
          },
        });
        if (!grant.allowed) {
          setReasons(grant.reasons);
          setStage("refused");
          void qc.invalidateQueries({ queryKey: SESSIONS_KEY });
          return;
        }
        setStage("uploading");
        // Same bytes, but labelled with the type the server approved.
        const body = file.slice(0, file.size, type);
        const { error } = await supabase.storage
          .from(BUCKET)
          .uploadToSignedUrl(grant.path, grant.token, body, { contentType: type });
        if (error) throw new Error("SESSIONS_STORAGE_ERROR");
        path = grant.path;
        setUploadedPath(path);
      }
      setStage("confirming");
      const res = await confirm({
        data: {
          sessionId: session.id,
          path,
          sha256: sha,
          bytes: file.size,
          durationSec: duration,
        },
      });
      setHeldAfterUpload(res.status === "on_hold");
      setStage("done");
      toast.success(t({ th: "อัปโหลดไฟล์เสียงแล้ว", en: "Audio uploaded" }));
      void qc.invalidateQueries({ queryKey: SESSIONS_KEY });
    } catch (err) {
      setStage("error");
      setMessage(errorText(err, t));
    }
  };

  const steps: { stage: Stage; label: Localized }[] = [
    { stage: "hashing", label: { th: "ตรวจไฟล์", en: "Check file" } },
    { stage: "checking", label: { th: "ตรวจความพร้อม", en: "Check readiness" } },
    { stage: "uploading", label: { th: "อัปโหลด", en: "Upload" } },
    { stage: "confirming", label: { th: "ยืนยันกับระบบ", en: "Confirm" } },
  ];
  const order: Stage[] = ["hashing", "hashed", "checking", "uploading", "confirming", "done"];
  const at = order.indexOf(stage);

  const statusText: Partial<Record<Stage, Localized>> = {
    hashing: {
      th: "กำลังคำนวณรหัสตรวจสอบไฟล์ (SHA-256)...",
      en: "Computing the file checksum (SHA-256)...",
    },
    hashed: { th: "ไฟล์พร้อมอัปโหลด", en: "File ready to upload" },
    checking: { th: "กำลังตรวจความพร้อมก่อนอัปโหลด...", en: "Checking readiness before upload..." },
    uploading: {
      th: "กำลังอัปโหลด... ไฟล์ใหญ่อาจใช้เวลาหลายนาที กรุณาอย่าปิดหน้านี้",
      en: "Uploading... large files can take several minutes. Please keep this page open.",
    },
    confirming: { th: "กำลังยืนยันไฟล์กับระบบ...", en: "Confirming the file..." },
    done: { th: "อัปโหลดเรียบร้อย", en: "Upload complete" },
    refused: {
      th: "ยังอัปโหลดไม่ได้ เพราะ:",
      en: "Upload is not possible yet because:",
    },
  };

  return (
    <div className="space-y-3">
      {blockers.length > 0 && stage !== "refused" && (
        <div className="rounded-md border border-warm-200 bg-warm-50 p-3 text-sm text-navy-700">
          <p className="font-medium">
            {t({ th: "ก่อนอัปโหลดได้ ยังต้องมี:", en: "Before upload, this is still needed:" })}
          </p>
          <ul lang={lang} className="mt-1 list-disc space-y-0.5 pl-5">
            {blockers.map((r) => (
              <li key={r}>{t(GATE_LABEL[r])}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <label htmlFor={`${id}-file`} className="mb-1 block text-sm font-medium text-navy-500">
          {t({ th: "เลือกไฟล์เสียง (ไม่เกิน 500 MB)", en: "Choose an audio file (up to 500 MB)" })}
        </label>
        <input
          id={`${id}-file`}
          type="file"
          accept={ACCEPT}
          onChange={onFile}
          disabled={busy || blockers.length > 0}
          aria-describedby={`${id}-file-hint`}
          className="block min-h-11 w-full text-sm file:mr-3 file:min-h-11 file:rounded-md file:border file:border-warm-300 file:bg-white file:px-4 file:text-sm file:font-medium file:text-navy-900 disabled:opacity-50"
        />
        <p id={`${id}-file-hint`} lang={lang} className="mt-1 text-xs text-warm-600">
          {t({
            th: "แนะนำ m4a หรือ mp3 ที่ 64 kbps ไฟล์เก็บในพื้นที่ส่วนตัวของโครงการ เปิดได้ผ่านลิงก์ชั่วคราวเท่านั้น",
            en: "m4a or mp3 at 64 kbps works well. Files are kept in the study's private storage and open only through short-lived links.",
          })}
        </p>
      </div>

      {file && (
        <p className="text-sm text-navy-700">
          {t({ th: "ขนาด", en: "Size" })}: {fmtBytes(file.size)}
          {duration ? ` · ${t({ th: "ความยาว", en: "Length" })}: ${fmtDuration(duration)}` : ""}
          {sha && (
            <span className="block font-mono text-xs break-all text-warm-600">SHA-256: {sha}</span>
          )}
        </p>
      )}

      {at >= 0 && (
        <ol
          className="flex flex-wrap gap-2"
          aria-label={t({ th: "ขั้นตอนอัปโหลด", en: "Upload steps" })}
        >
          {steps.map((s) => {
            const idx = order.indexOf(s.stage);
            const doneStep = at > idx || stage === "done";
            const current = stage === s.stage;
            return (
              <li
                key={s.stage}
                className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-medium ${
                  doneStep
                    ? "border-accuracy/40 bg-accuracy-soft text-accuracy-ink"
                    : current
                      ? "border-navy-300 bg-navy-100 text-navy-900"
                      : "border-warm-300 bg-white text-warm-600"
                }`}
                aria-current={current ? "step" : undefined}
              >
                {doneStep ? (
                  <CircleCheck className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <CircleDashed
                    className={`h-3.5 w-3.5 ${current ? "animate-spin" : ""}`}
                    aria-hidden
                  />
                )}
                {t(s.label)}
              </li>
            );
          })}
        </ol>
      )}

      {stage === "uploading" && (
        <div className="h-2 w-full overflow-hidden rounded-pill bg-warm-100" aria-hidden>
          <div className="h-full w-1/2 animate-pulse rounded-pill bg-accuracy/70" />
        </div>
      )}

      <div aria-live="polite" role="status" className="text-sm">
        {statusText[stage] && (
          <p
            lang={lang}
            className={
              stage === "done" ? "font-medium text-accuracy-ink" : "font-medium text-navy-700"
            }
          >
            {t(statusText[stage]!)}
          </p>
        )}
        {stage === "refused" && (
          <ul lang={lang} className="mt-1 list-disc space-y-0.5 pl-5 text-navy-700">
            {reasons.map((r) => (
              <li key={r}>{t(GATE_LABEL[r])}</li>
            ))}
          </ul>
        )}
        {stage === "done" && heldAfterUpload && (
          <p lang={lang} className="mt-1 text-dignity-ink">
            {t({
              th: "เก็บไฟล์ไว้แล้ว แต่ session ถูกพักไว้ให้ data steward ทบทวน เพราะมีบางอย่างเปลี่ยนไประหว่างอัปโหลด",
              en: "The file is stored, but the session is on hold for a data steward to review because something changed during the upload.",
            })}
          </p>
        )}
        {stage === "error" && message && (
          <p lang={lang} className="flex items-start gap-2 text-dignity-ink">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {message}
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={upload}
          disabled={!file || !sha || busy || stage === "done" || blockers.length > 0}
          className={BTN_PRIMARY}
        >
          <Upload className="h-4 w-4" aria-hidden />
          {busy && stage !== "hashing"
            ? t({ th: "กำลังอัปโหลด...", en: "Uploading..." })
            : uploadedPath && stage === "error"
              ? t({ th: "ยืนยันไฟล์อีกครั้ง", en: "Retry confirming" })
              : t({ th: "อัปโหลดเพื่องานวิจัย", en: "Upload for research" })}
        </button>
      </div>
    </div>
  );
}

function Playback({ sessionId }: { sessionId: string }) {
  const { t, lang } = useLanguage();
  const id = useId();
  const fn = useServerFn(getAudioPlaybackUrl);
  const [asking, setAsking] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const valid = purpose.trim().length >= 5 && purpose.trim().length <= 200;

  const run = useMutation({
    mutationFn: () => fn({ data: { sessionId, purpose: purpose.trim() } }),
    onSuccess: (res) => setLink(res),
    onError: (err) => toast.error(errorText(err, t)),
  });

  if (link) {
    return (
      <div className="space-y-2">
        <audio controls src={link.url} preload="none" className="w-full">
          {t({ th: "เบราว์เซอร์นี้เล่นไฟล์เสียงไม่ได้", en: "This browser cannot play audio" })}
        </audio>
        <p lang={lang} className="text-xs text-warm-600">
          {t({
            th: `ลิงก์นี้ใช้ได้ถึง ${new Date(link.expiresAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น. และระบบบันทึกการเปิดฟังพร้อมเหตุผลไว้แล้ว`,
            en: `This link works until ${new Date(link.expiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}. The access and its purpose have been logged.`,
          })}
        </p>
      </div>
    );
  }

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={BTN_SECONDARY}>
        <Headphones className="h-4 w-4" aria-hidden />
        {t({ th: "ฟังไฟล์เสียง", en: "Listen" })}
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) run.mutate();
      }}
      className="space-y-2 rounded-md border border-warm-200 bg-warm-50 p-3"
    >
      <label htmlFor={`${id}-purpose`} className="block text-sm font-medium text-navy-500">
        {t({ th: "เหตุผลที่ต้องเปิดฟัง", en: "Why do you need to listen?" })}
        <Required />
      </label>
      <input
        id={`${id}-purpose`}
        value={purpose}
        onChange={(e) => setPurpose(e.target.value)}
        maxLength={200}
        required
        aria-describedby={`${id}-purpose-hint`}
        placeholder={t({
          th: "เช่น ตรวจความถูกต้องของบทถอดความ",
          en: "e.g. checking the transcript is accurate",
        })}
        className={INPUT}
      />
      <p id={`${id}-purpose-hint`} lang={lang} className="text-xs text-warm-600">
        {t({
          th: "5 ถึง 200 ตัวอักษร ระบบบันทึกเหตุผลนี้ในประวัติการเข้าถึง ไม่ต้องใส่ชื่อคน ลิงก์ฟังใช้ได้ 10 นาที",
          en: "5 to 200 characters. This is saved in the access log: please no names. The link works for 10 minutes.",
        })}
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setAsking(false);
            setPurpose("");
          }}
          disabled={run.isPending}
          className={BTN_SECONDARY}
        >
          {t({ th: "ยกเลิก", en: "Cancel" })}
        </button>
        <button type="submit" disabled={!valid || run.isPending} className={BTN_PRIMARY}>
          <Headphones className="h-4 w-4" aria-hidden />
          {run.isPending
            ? t({ th: "กำลังขอลิงก์...", en: "Getting link..." })
            : t({ th: "ขอลิงก์ฟัง", en: "Get listening link" })}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Review (data steward / admin)
// ---------------------------------------------------------------------------
function ReviewSection({ session }: { session: CaptureSession }) {
  const { t, lang } = useLanguage();
  const qc = useQueryClient();
  const id = useId();
  const fn = useServerFn(setSessionStatus);
  const [note, setNote] = useState("");
  const valid = note.trim().length >= 5;

  const run = useMutation({
    mutationFn: (status: "ready" | "closed") =>
      fn({ data: { sessionId: session.id, status, note: note.trim() } }),
    onSuccess: (res) => {
      setNote("");
      toast.success(
        res.status === "closed"
          ? t({ th: "ปิด session แล้ว", en: "Session closed" })
          : t({ th: "ให้ session ทำงานต่อแล้ว", en: "Session resumed" }),
      );
    },
    onError: (err) => toast.error(errorText(err, t)),
    onSettled: () => qc.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });

  return (
    <Section
      title={t({ th: "ทบทวน session ที่พักไว้", en: "Review this on-hold session" })}
      icon={<CirclePause className="h-4 w-4 text-dignity-ink" aria-hidden />}
    >
      <p lang={lang} className="text-sm text-navy-700">
        {t({
          th: "ตรวจกับผู้ขอความยินยอมก่อน แล้วเลือกให้ทำงานต่อ หรือปิด session นี้ ถ้าให้ทำงานต่อ session จะกลับไปที่ขั้นที่ทำถึงจริง: มีไฟล์เสียงแล้วเป็น บันทึกแล้ว เช็กลิสต์ครบเป็น พร้อมบันทึก ไม่อย่างนั้นเป็น ร่าง",
          en: "Check with the consent officer first, then resume or close this session. Resuming returns it to where it really is: Recorded if audio exists, Ready to record if the checklist is done, otherwise Draft.",
        })}
      </p>
      <ClearanceBadges clearance={session.clearance} />
      <div>
        <label htmlFor={`${id}-note`} className="mb-1 block text-sm font-medium text-navy-500">
          {t({ th: "บันทึกการทบทวน", en: "Review note" })}
          <Required />
        </label>
        <textarea
          id={`${id}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={3}
          required
          aria-describedby={`${id}-note-hint`}
          className="w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-navy-900"
        />
        <p id={`${id}-note-hint`} lang={lang} className="mt-1 text-xs text-warm-600">
          {t({
            th: "อย่างน้อย 5 ตัวอักษร ใช้รหัส P-xxx เท่านั้น ไม่ใส่ชื่อจริง บันทึกนี้เก็บในประวัติการตรวจสอบ",
            en: "At least 5 characters. Use P-xxx codes only, never real names. This note is kept in the audit log.",
          })}
        </p>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                t({
                  th: `ปิด ${session.code}? หลังปิดแล้วจะไม่มีการบันทึกหรือใช้งานต่อ`,
                  en: `Close ${session.code}? Nothing further will be recorded or used.`,
                }),
              )
            ) {
              run.mutate("closed");
            }
          }}
          disabled={!valid || run.isPending}
          className={BTN_SECONDARY}
        >
          {t({ th: "ปิด session", en: "Close session" })}
        </button>
        <button
          type="button"
          onClick={() => run.mutate("ready")}
          disabled={!valid || run.isPending}
          className={BTN_PRIMARY}
        >
          {run.isPending
            ? t({ th: "กำลังบันทึก...", en: "Saving..." })
            : t({ th: "ให้ทำงานต่อ", en: "Resume" })}
        </button>
      </div>
    </Section>
  );
}
