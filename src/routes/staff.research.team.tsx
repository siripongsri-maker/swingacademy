import { createFileRoute } from "@tanstack/react-router";
import { useId, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Lock,
  LockOpen,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
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
import { getMyResearchAccess, RESEARCH_ROLES, type ResearchRole } from "@/lib/research-access";
import {
  conflictingRoles,
  selfGrantBlock,
  getStudySettings,
  grantResearchRole,
  listResearchMembers,
  setResearchMemberActive,
  updateStudySettings,
  LIST_ITEM_MAX,
  LIST_MAX_ITEMS,
  RETENTION_MAX,
  RETENTION_MIN,
  type ResearchMember,
  type StudySettings,
  type StudySettingsPatch,
  type TeamAccount,
} from "@/lib/research-team.functions";
import { useLanguage, type Lang, type Localized } from "@/lib/language-context";

export const Route = createFileRoute("/staff/research/team")({
  component: ResearchTeamPage,
});

type SettingsData = { settings: StudySettings | null; canEdit: boolean; canUnlock: boolean };
type MembersData = {
  members: ResearchMember[];
  accounts: TeamAccount[];
  accountsAvailable: boolean;
  canGrant: boolean;
  limited: boolean;
  viewerId: string;
};
type Result = { ok: boolean; msg: Localized };

const SETTINGS_KEY = ["study-settings"] as const;
const MEMBERS_KEY = ["research-members"] as const;
const ACCESS_KEY = ["research-access"] as const;

const ROLE_LABEL: Record<ResearchRole, Localized> = {
  researcher: { th: "ผู้วิจัย", en: "Researcher" },
  consent_officer: { th: "ผู้ขอความยินยอม (อิสระ)", en: "Independent consent officer" },
  dept_coordinator: { th: "ผู้ประสานงานแผนก", en: "Department coordinator" },
  expert: { th: "ผู้เชี่ยวชาญ (ตรวจความถูกต้อง)", en: "Expert (accuracy review)" },
  dignity_panel: {
    th: "คณะผู้ร่วมประเมินด้านการให้เกียรติ",
    en: "Dignity review panel",
  },
  data_steward: { th: "ผู้ดูแลข้อมูล", en: "Data steward" },
  deid_assistant: { th: "ผู้ช่วยลบตัวระบุตัวตน", en: "De-identification assistant" },
};

const ROLE_HINT: Record<ResearchRole, Localized> = {
  researcher: {
    th: "ทำงานกับเซสชันและข้อมูลที่ไม่ระบุตัวตน ไม่เห็นว่าใครยินยอม ไม่ยินยอม หรือถอนตัว และไม่ได้ฟังเสียงดิบ",
    en: "Works with sessions and de-identified data. Cannot see who agreed, declined or withdrew, and does not hear raw audio.",
  },
  consent_officer: {
    th: "ทำงานแยกจากผู้วิจัย ขอและบันทึกความยินยอมของผู้เข้าร่วมแต่ละคน",
    en: "Works separately from the researcher. Asks for and records each participant's consent.",
  },
  dept_coordinator: {
    th: "ช่วยจัดเซสชันของแผนกตัวเอง และเห็นเฉพาะเซสชันของแผนกนั้น",
    en: "Helps run sessions for one department and sees only that department's sessions.",
  },
  expert: {
    th: "ร่วมตรวจความถูกต้องของเนื้อหาความรู้",
    en: "Reviews knowledge content for accuracy.",
  },
  dignity_panel: {
    th: "ร่วมประเมินว่าเนื้อหาให้เกียรติและไม่ตีตราชุมชน",
    en: "Joins in reviewing that content is respectful and free of stigma.",
  },
  data_steward: {
    th: "ดูแลการเข้าถึงข้อมูลและการตั้งค่าการศึกษา เห็นบันทึกความยินยอม เปิดฟังเสียงดิบได้ และเป็นผู้เปิดหรือล็อกการเก็บข้อมูล",
    en: "Looks after data access and study settings, can see consent records and play raw audio, and opens or locks collection.",
  },
  deid_assistant: {
    th: "ฟังเสียงดิบเพื่อถอดเสียงและลบข้อมูลที่ระบุตัวตนได้ ก่อนส่งข้อความต่อให้ผู้วิจัย เห็นเฉพาะเซสชันที่บันทึกเสียงแล้ว และไม่เห็นบันทึกความยินยอม",
    en: "Listens to raw audio to transcribe it and remove identifying details before the text reaches the researcher. Sees recorded sessions only, never consent records.",
  },
};

const MSG = {
  missing: {
    th: "ฐานข้อมูลยังไม่มีตารางหรือคอลัมน์ของงานวิจัยที่หน้านี้ใช้ ให้สั่ง Lovable รัน migration ที่ยังค้างอยู่ (ล่าสุดคือ 20261012180000_research_gate_and_access.sql)",
    en: "Some research tables or columns this page needs do not exist yet. Ask Lovable to run the pending migration (latest: 20261012180000_research_gate_and_access.sql).",
  },
  forbiddenAction: {
    th: "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้",
    en: "This account cannot do this.",
  },
  conflict: {
    th: "บัญชีเดียวกันเป็นผู้วิจัยพร้อมกับเป็นผู้ขอความยินยอม ผู้ดูแลข้อมูล หรือผู้ช่วยลบตัวระบุตัวตนไม่ได้ เพื่อให้ผู้วิจัยไม่เห็นผลการให้ความยินยอมรายบุคคลและไม่ได้ฟังเสียงดิบ",
    en: "One account cannot be the researcher and also a consent officer, data steward or de-identification assistant, so the researcher never sees individual consent decisions or hears raw audio.",
  },
  loadFailed: {
    th: "โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชอีกครั้ง",
    en: "Could not load. Refresh to try again.",
  },
  settingsRowMissing: {
    th: "ยังไม่มีแถวการตั้งค่าการศึกษาในฐานข้อมูล ให้รัน migration 20261012150000_consent_and_capture.sql อีกครั้ง",
    en: "The study settings row is missing. Run migration 20261012150000_consent_and_capture.sql again.",
  },
  selfKeeper: {
    th: "ให้บทบาทที่เห็นบันทึกความยินยอมกับบัญชีของตัวเองไม่ได้ ขอให้ผู้ดูแลระบบอีกคนเป็นผู้ให้ เพื่อให้การเข้าถึงบันทึกความยินยอมผ่านการดูของอีกคนเสมอ",
    en: "You cannot give your own account a role that can see consent records. Please ask another admin, so access to consent records always goes through a second person.",
  },
  selfRawAudio: {
    th: "ให้บทบาทผู้ช่วยลบตัวระบุตัวตนกับบัญชีของตัวเองไม่ได้ ขอให้ผู้ดูแลระบบอีกคนเป็นผู้ให้ เพื่อให้การเข้าถึงเสียงดิบผ่านการดูของอีกคนเสมอ",
    en: "You cannot give your own account the de-identification assistant role. Please ask another admin, so access to raw audio always goes through a second person.",
  },
} satisfies Record<string, Localized>;

const ERROR_MESSAGES: [string, Localized][] = [
  [
    "STUDY_UNLOCK_NEEDS_APPROVALS",
    {
      th: "เปิดการเก็บข้อมูลได้เมื่อมีเลขที่อ้างอิงจริยธรรม วันที่อนุมัติจริยธรรม วันที่ลงนาม MoU และวันที่มูลนิธิอนุญาตครบ ถ้าต้องการลบข้อมูลเหล่านี้ ให้ล็อกการเก็บข้อมูลก่อน",
      en: "Collection can be open only when the ethics reference, the ethics approval date, the MoU date and the foundation permission date are all on file. To clear one, lock collection first.",
    },
  ],
  [
    "STUDY_STEWARD_ONLY",
    {
      th: "เฉพาะผู้ดูแลข้อมูลเปิดหรือล็อกการเก็บข้อมูลได้ และระหว่างที่เปิดอยู่ เฉพาะผู้ดูแลข้อมูลแก้ข้อมูลการอนุมัติได้",
      en: "Only a data steward can open or lock collection, and change the approvals while it is open.",
    },
  ],
  [
    "STUDY_SETTINGS_STALE",
    {
      th: "มีคนบันทึกการตั้งค่าไปก่อนหน้านี้ ระบบโหลดค่าล่าสุดให้แล้ว ตรวจอีกครั้งแล้วบันทึกใหม่",
      en: "Someone else saved the settings first. The latest values are loaded: check them and save again.",
    },
  ],
  ["STUDY_SETTINGS_MISSING", MSG.settingsRowMissing],
  ["TEAM_ROLE_CONFLICT", MSG.conflict],
  ["TEAM_SELF_KEEPER", MSG.selfKeeper],
  ["TEAM_SELF_RAW_AUDIO", MSG.selfRawAudio],
  [
    "TEAM_DEPARTMENT_REQUIRED",
    {
      th: "ผู้ประสานงานแผนกต้องมีแผนก เลือกแผนกในหน้าต่างเพิ่มสมาชิก",
      en: "A department coordinator needs a department. Choose one under Add member.",
    },
  ],
  [
    "TEAM_DEPARTMENT_UNKNOWN",
    {
      th: "แผนกนี้ไม่อยู่ในรายการแผนกของการศึกษา เพิ่มแผนกในส่วนการตั้งค่าก่อน หรือใช้ปุ่มเพิ่มสมาชิกเพื่อเลือกแผนกที่มีในรายการ",
      en: "This department is not in the study's list. Add it under settings first, or use Add member to choose a listed department.",
    },
  ],
  ["TEAM_ACCOUNT_NOT_FOUND", { th: "ไม่พบบัญชีนี้ในระบบ", en: "This account was not found." }],
  [
    "TEAM_MEMBER_NOT_FOUND",
    { th: "ไม่พบรายการนี้แล้ว ลองรีเฟรช", en: "This entry no longer exists. Try refreshing." },
  ],
  ["TEAM_TABLE_MISSING", MSG.missing],
  ["RESEARCH_FORBIDDEN", MSG.forbiddenAction],
  ["TEAM_FORBIDDEN", MSG.forbiddenAction],
  ["Unauthorized", MSG.forbiddenAction],
];

function errorText(err: unknown) {
  return err instanceof Error ? err.message : String(err ?? "");
}

function messageFor(err: unknown): Localized {
  const text = errorText(err);
  for (const [code, msg] of ERROR_MESSAGES) if (text.includes(code)) return msg;
  // Input validation errors come back as a JSON list of issues
  if (text.trim().startsWith("[")) {
    return {
      th: "ข้อมูลบางช่องไม่ถูกต้อง ตรวจแล้วลองอีกครั้ง",
      en: "Some fields are not valid. Check them and try again.",
    };
  }
  return { th: "บันทึกไม่สำเร็จ ลองอีกครั้ง", en: "Could not save. Please try again." };
}

function errorKind(err: unknown): "missing" | "forbidden" | "other" | null {
  if (!err) return null;
  const text = errorText(err);
  if (text.includes("TEAM_TABLE_MISSING")) return "missing";
  if (
    text.includes("RESEARCH_FORBIDDEN") ||
    text.includes("TEAM_FORBIDDEN") ||
    text.includes("Unauthorized")
  ) {
    return "forbidden";
  }
  return "other";
}

function formatDate(iso: string | null, lang: Lang) {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Thai locale uses the Buddhist era (2026 -> 2569)
  return new Intl.DateTimeFormat(lang === "th" ? "th-TH" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(iso.length === 10 ? { timeZone: "UTC" } : { hour: "2-digit", minute: "2-digit" }),
  }).format(d);
}

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

const INPUT =
  "h-11 w-full rounded-md border border-warm-300 bg-white px-3 text-sm text-navy-900 disabled:bg-warm-50 disabled:text-warm-600";
const BTN_PRIMARY =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-navy-500 px-4 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50";
const BTN_SECONDARY =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-warm-300 bg-white px-4 text-sm font-medium text-navy-900 hover:bg-warm-50 disabled:opacity-50";

// ---------------------------------------------------------------------------

function ResearchTeamPage() {
  const { t, lang } = useLanguage();
  const getAccess = useServerFn(getMyResearchAccess);
  const accessQ = useQuery({ queryKey: ACCESS_KEY, queryFn: () => getAccess(), retry: false });
  const access = accessQ.data;
  const canManage = !!access && (access.isAdmin || access.roles.includes("data_steward"));

  const getSettings = useServerFn(getStudySettings);
  const settingsQ = useQuery<SettingsData>({
    queryKey: SETTINGS_KEY,
    queryFn: () => getSettings(),
    enabled: canManage,
    retry: false,
    // A background refetch would reset forms that are being edited
    refetchOnWindowFocus: false,
  });
  const listMembers = useServerFn(listResearchMembers);
  const membersQ = useQuery<MembersData>({
    queryKey: MEMBERS_KEY,
    queryFn: () => listMembers(),
    enabled: canManage,
    retry: false,
  });

  const kinds = [accessQ.error, settingsQ.error, membersQ.error].map(errorKind);
  const forbidden = kinds.includes("forbidden") || (!!access && !canManage);
  const missing = !forbidden && kinds.includes("missing");
  const accessFailed = !forbidden && errorKind(accessQ.error) === "other";
  const loading = accessQ.isLoading || (canManage && (settingsQ.isLoading || membersQ.isLoading));
  const fetching = accessQ.isFetching || settingsQ.isFetching || membersQ.isFetching;

  const refresh = () => {
    void accessQ.refetch();
    if (canManage) {
      void settingsQ.refetch();
      void membersQ.refetch();
    }
  };

  const settings = settingsQ.data?.settings;
  const members = membersQ.data?.members;
  const coordinatorDepartments = useMemo(
    () =>
      new Set(
        (members ?? [])
          .filter((m) => m.active && m.role === "dept_coordinator" && m.department)
          .map((m) => m.department as string),
      ),
    [members],
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-navy-900">
            <Users className="h-6 w-6 shrink-0 text-accuracy" aria-hidden />
            {t({ th: "ทีมวิจัยและการตั้งค่า", en: "Research team & settings" })}
          </h1>
          <p lang={lang} className="mt-1 max-w-2xl text-sm text-warm-600">
            {t({
              th: "สถานะการอนุมัติ การล็อกการเก็บข้อมูล และบทบาทของทีมวิจัย CVSK",
              en: "Approvals, the collection lock, and who holds which role in the CVSK research team.",
            })}
          </p>
        </div>
        {!forbidden && (
          <button type="button" onClick={refresh} className={BTN_SECONDARY}>
            <RefreshCw className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} aria-hidden />
            {t({ th: "รีเฟรช", en: "Refresh" })}
          </button>
        )}
      </header>

      {forbidden ? (
        <div className="rounded-lg border border-warm-200 bg-white px-6 py-12 text-center">
          <Lock className="mx-auto h-8 w-8 text-warm-500" aria-hidden />
          <p lang={lang} className="mx-auto mt-3 max-w-md text-sm text-navy-500">
            {t({
              th: "หน้านี้เปิดได้เฉพาะผู้ดูแลระบบและผู้ดูแลข้อมูล (data steward) ถ้าต้องการสิทธิ์ ติดต่อผู้ดูแลระบบได้เลย",
              en: "Only admins and data stewards can open this page. If you need access, please ask an admin.",
            })}
          </p>
        </div>
      ) : missing || accessFailed ? (
        <Alert>{t(missing ? MSG.missing : MSG.loadFailed)}</Alert>
      ) : loading ? (
        <p role="status" aria-busy="true" className="text-sm text-warm-600">
          {t({ th: "กำลังโหลด...", en: "Loading..." })}
        </p>
      ) : (
        <>
          {settingsQ.error ? (
            <Alert>{t(MSG.loadFailed)}</Alert>
          ) : settings === null ? (
            <Alert>{t(MSG.settingsRowMissing)}</Alert>
          ) : settings ? (
            <>
              <StudyStatusCard
                settings={settings}
                canEdit={!!settingsQ.data?.canEdit}
                canUnlock={!!settingsQ.data?.canUnlock}
              />
              <SettingsCard
                settings={settings}
                canEdit={!!settingsQ.data?.canEdit}
                coordinatorDepartments={coordinatorDepartments}
              />
            </>
          ) : null}

          {membersQ.error ? (
            <Alert>{t(MSG.loadFailed)}</Alert>
          ) : membersQ.data ? (
            <TeamSection data={membersQ.data} departments={settings?.departments ?? []} />
          ) : null}

          <PrivacyNote />
        </>
      )}
    </div>
  );
}

function Alert({ children }: { children: string }) {
  const { lang } = useLanguage();
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-dignity/50 bg-dignity-soft/60 p-4 text-sm text-dignity-ink"
    >
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <p lang={lang}>{children}</p>
    </div>
  );
}

/** Polite live region for the result of an action. Always rendered so it gets announced. */
function LiveResult({ result, className = "" }: { result: Result | null; className?: string }) {
  const { t, lang } = useLanguage();
  return (
    <p role="status" aria-live="polite" lang={lang} className={`min-h-5 text-sm ${className}`}>
      {result && (
        <span
          className={`inline-flex items-start gap-1.5 ${result.ok ? "text-accuracy-ink" : "text-dignity-ink"}`}
        >
          {result.ok ? (
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          )}
          {t(result.msg)}
        </span>
      )}
    </p>
  );
}

function useSaveSettings() {
  const save = useServerFn(updateStudySettings);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: StudySettingsPatch) => save({ data: patch }),
    onSuccess: (res) => {
      qc.setQueryData<SettingsData>(SETTINGS_KEY, (old) =>
        old ? { ...old, settings: res.settings } : old,
      );
    },
    onError: (err) => {
      if (errorText(err).includes("STUDY_SETTINGS_STALE")) {
        void qc.invalidateQueries({ queryKey: SETTINGS_KEY });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// 1) Study status: approvals and the collection lock
// ---------------------------------------------------------------------------

function StudyStatusCard({
  settings,
  canEdit,
  canUnlock,
}: {
  settings: StudySettings;
  canEdit: boolean;
  /** Data stewards only: open or lock collection, and change approvals while it is open. */
  canUnlock: boolean;
}) {
  const { t, lang } = useLanguage();
  const save = useSaveSettings();
  const [result, setResult] = useState<Result | null>(null);
  const [confirming, setConfirming] = useState<"unlock" | "lock" | null>(null);
  const hasRef = !!settings.ethicsRef?.trim();
  const hasEthics = !!settings.ethicsApprovedAt;
  const hasMou = !!settings.mouSignedAt;
  const hasFoundation = !!settings.foundationPermissionAt;
  const ready = hasRef && hasEthics && hasMou && hasFoundation;
  const isOpen = settings.collectionUnlocked;
  // While collection is open, the approvals it rests on are changed by a data steward only.
  const canEditApprovals = canEdit && (!isOpen || canUnlock);
  const [editing, setEditing] = useState(canEditApprovals && !ready);
  const canToggle = canUnlock && (isOpen || ready);
  const ids = useId();

  const reasons: Localized[] = [];
  if (!hasRef) {
    reasons.push({
      th: "ยังไม่ได้บันทึกเลขที่อ้างอิงจริยธรรม",
      en: "The ethics reference is not on file yet",
    });
  }
  if (!hasEthics) {
    reasons.push({
      th: "ยังไม่ได้บันทึกวันที่คณะกรรมการจริยธรรมการวิจัยอนุมัติ",
      en: "The ethics committee approval date is not on file yet",
    });
  }
  if (!hasMou) {
    reasons.push({
      th: "ยังไม่ได้บันทึกวันที่ลงนาม MoU",
      en: "The MoU signing date is not on file yet",
    });
  }
  if (!hasFoundation) {
    reasons.push({
      th: "ยังไม่ได้บันทึกวันที่มูลนิธิอนุญาตให้ใช้ข้อมูล",
      en: "The date the foundation gave permission is not on file yet",
    });
  }
  if (ready && !isOpen) {
    reasons.push({
      th: "การอนุมัติครบแล้ว รอผู้ดูแลข้อมูลเปิดการเก็บข้อมูล",
      en: "Approvals are complete. Waiting for a data steward to open collection.",
    });
  }

  const saveApprovals = (patch: StudySettingsPatch) =>
    save.mutate(patch, {
      onSuccess: (res) =>
        setResult({
          ok: true,
          msg: res.changed.length
            ? { th: "บันทึกข้อมูลการอนุมัติแล้ว", en: "Approvals saved" }
            : { th: "ไม่มีอะไรเปลี่ยน", en: "Nothing changed" },
        }),
      onError: (err) => setResult({ ok: false, msg: messageFor(err) }),
    });

  const confirmToggle = () => {
    const unlock = confirming === "unlock";
    save.mutate(
      { expectedUpdatedAt: settings.updatedAt, collectionUnlocked: unlock },
      {
        onSuccess: () => {
          const msg = unlock
            ? { th: "เปิดการเก็บข้อมูลแล้ว", en: "Collection is now open" }
            : { th: "ล็อกการเก็บข้อมูลแล้ว", en: "Collection is now locked" };
          setResult({ ok: true, msg });
          toast.success(t(msg));
          setConfirming(null);
        },
        onError: (err) => {
          setResult({ ok: false, msg: messageFor(err) });
          setConfirming(null);
        },
      },
    );
  };

  const notOnFile = t({ th: "ยังไม่มี", en: "Not on file" });

  return (
    <section
      aria-labelledby={`${ids}-h`}
      className="space-y-4 rounded-lg border border-warm-200 bg-white p-4 sm:p-5"
    >
      <h2 id={`${ids}-h`} className="text-base font-semibold text-navy-900">
        {t({ th: "สถานะการศึกษา", en: "Study status" })}
      </h2>

      <div
        className={`flex items-start gap-3 rounded-lg border p-4 ${
          isOpen
            ? "border-accuracy/40 bg-accuracy-soft text-accuracy-ink"
            : "border-dignity/50 bg-dignity-soft/60 text-dignity-ink"
        }`}
      >
        {isOpen ? (
          <LockOpen className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
        ) : (
          <Lock className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
        )}
        <div lang={lang} className="min-w-0">
          <p className="text-lg font-semibold">
            {isOpen
              ? t({ th: "เปิดการเก็บข้อมูลแล้ว", en: "Collection is open" })
              : t({ th: "การเก็บข้อมูลถูกล็อก", en: "Collection is locked" })}
          </p>
          {isOpen ? (
            <p className="mt-1 text-sm">
              {t({
                th: "ทีมบันทึกเสียงและอัปโหลดไฟล์เพื่อการวิจัยได้ โดยแต่ละเซสชันยังต้องได้รับความยินยอมจากผู้พูดทุกคน",
                en: "The team can record and upload audio for research. Each session still needs consent from every speaker.",
              })}
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm">
                {t({
                  th: "ยังบันทึกเสียงหรืออัปโหลดไฟล์เพื่อการวิจัยไม่ได้ เพราะ:",
                  en: "Recording and uploading for research are not possible yet because:",
                })}
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                {reasons.map((r) => (
                  <li key={r.en}>{t(r)}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0 rounded-md bg-warm-50 p-3">
          <dt className="text-xs text-warm-600">
            {t({ th: "การอนุมัติจริยธรรม", en: "Ethics approval" })}
          </dt>
          <dd className="mt-0.5 font-medium break-words text-navy-900">
            {settings.ethicsRef ?? notOnFile}
          </dd>
          <dd className="text-warm-600">
            {formatDate(settings.ethicsApprovedAt, lang) ??
              t({ th: "ยังไม่มีวันที่", en: "No date yet" })}
          </dd>
        </div>
        <div className="min-w-0 rounded-md bg-warm-50 p-3">
          <dt className="text-xs text-warm-600">{t({ th: "MoU ลงนามเมื่อ", en: "MoU signed" })}</dt>
          <dd className="mt-0.5 font-medium text-navy-900">
            {formatDate(settings.mouSignedAt, lang) ?? notOnFile}
          </dd>
        </div>
        <div className="min-w-0 rounded-md bg-warm-50 p-3">
          <dt className="text-xs text-warm-600">
            {t({ th: "มูลนิธิอนุญาตเมื่อ", en: "Foundation permission" })}
          </dt>
          <dd className="mt-0.5 font-medium text-navy-900">
            {formatDate(settings.foundationPermissionAt, lang) ?? notOnFile}
          </dd>
        </div>
        <div className="min-w-0 rounded-md bg-warm-50 p-3">
          <dt className="text-xs text-warm-600">{t({ th: "ปรับล่าสุด", en: "Last updated" })}</dt>
          <dd className="mt-0.5 font-medium text-navy-900">
            {formatDate(settings.updatedAt, lang) ?? "-"}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-warm-200 pt-4">
        <div className="min-w-0 flex-1">
          <p id={`${ids}-toggle`} className="font-medium text-navy-900">
            {t({ th: "เปิดการเก็บข้อมูลเพื่อการวิจัย", en: "Open collection for research" })}
          </p>
          <p id={`${ids}-toggle-hint`} lang={lang} className="text-xs text-warm-600">
            {!canUnlock
              ? t({
                  th: "เฉพาะผู้ดูแลข้อมูลเปิดหรือล็อกการเก็บข้อมูลได้",
                  en: "Only a data steward can open or lock collection.",
                })
              : !ready && !isOpen
                ? t({
                    th: "เปิดได้เมื่อบันทึกเลขที่อ้างอิงจริยธรรม วันที่อนุมัติจริยธรรม วันที่ลงนาม MoU และวันที่มูลนิธิอนุญาตครบแล้ว",
                    en: "Available once the ethics reference, the ethics approval date, the MoU date and the foundation permission date are saved.",
                  })
                : t({
                    th: "ระบบจะถามยืนยันก่อนเปลี่ยน",
                    en: "You will be asked to confirm.",
                  })}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isOpen}
          aria-labelledby={`${ids}-toggle`}
          aria-describedby={`${ids}-toggle-hint`}
          disabled={!canToggle || save.isPending}
          onClick={() => setConfirming(isOpen ? "lock" : "unlock")}
          className="inline-flex min-h-11 shrink-0 items-center gap-3 rounded-pill px-2 text-sm font-semibold text-navy-900 hover:bg-warm-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span
            className={`inline-flex h-7 w-12 items-center rounded-pill border transition-colors ${
              isOpen ? "border-accuracy bg-accuracy" : "border-warm-400 bg-warm-200"
            }`}
            aria-hidden
          >
            <span
              className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                isOpen ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          </span>
          {isOpen ? t({ th: "เปิดอยู่", en: "On" }) : t({ th: "ล็อกอยู่", en: "Locked" })}
        </button>
      </div>

      {canEdit && !canEditApprovals && (
        <p lang={lang} className="border-t border-warm-200 pt-4 text-xs text-warm-600">
          {t({
            th: "ระหว่างที่เปิดการเก็บข้อมูลอยู่ เฉพาะผู้ดูแลข้อมูลแก้ข้อมูลการอนุมัติได้",
            en: "While collection is open, only a data steward can change the approvals.",
          })}
        </p>
      )}

      {canEditApprovals && (
        <div className="border-t border-warm-200 pt-4">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-expanded={editing}
            aria-controls={`${ids}-approvals`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm font-semibold text-accuracy-ink hover:underline"
          >
            {editing ? (
              <ChevronDown className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden />
            )}
            {t({ th: "แก้ไขข้อมูลการอนุมัติ", en: "Edit approvals" })}
          </button>
          {editing && (
            <div id={`${ids}-approvals`} className="mt-3">
              <ApprovalsForm
                key={`${settings.ethicsRef}|${settings.ethicsApprovedAt}|${settings.mouSignedAt}|${settings.foundationPermissionAt}`}
                settings={settings}
                saving={save.isPending}
                onSave={saveApprovals}
              />
            </div>
          )}
        </div>
      )}

      <LiveResult result={result} />

      <Dialog
        open={confirming !== null}
        onOpenChange={(o) => {
          if (!o && !save.isPending) setConfirming(null);
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto sm:max-w-md"
          onEscapeKeyDown={(e) => save.isPending && e.preventDefault()}
          onInteractOutside={(e) => save.isPending && e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {confirming === "unlock"
                ? t({ th: "เปิดการเก็บข้อมูลเพื่อการวิจัย?", en: "Open collection for research?" })
                : t({ th: "ล็อกการเก็บข้อมูล?", en: "Lock collection?" })}
            </DialogTitle>
            <DialogDescription lang={lang}>
              {confirming === "unlock"
                ? t({
                    th: "เมื่อเปิดแล้ว ทีมจะบันทึกเสียงและอัปโหลดไฟล์เสียงเพื่อการวิจัยได้ แต่ละเซสชันยังต้องได้รับความยินยอมจากผู้พูดทุกคนเหมือนเดิม และล็อกกลับได้ทุกเมื่อ",
                    en: "Once open, the team can record and upload audio for research. Each session still needs consent from every speaker, and you can lock collection again at any time.",
                  })
                : t({
                    th: "ทีมจะบันทึกเสียงหรืออัปโหลดไฟล์ใหม่เพื่อการวิจัยไม่ได้จนกว่าจะเปิดอีกครั้ง ข้อมูลที่เก็บไว้แล้วยังอยู่ครบ",
                    en: "The team cannot record or upload new audio for research until collection is opened again. What is already stored stays as it is.",
                  })}
            </DialogDescription>
          </DialogHeader>
          {confirming === "unlock" && (
            <ul className="space-y-1 rounded-md bg-warm-50 p-3 text-sm text-navy-900">
              <li>
                {t({ th: "จริยธรรม", en: "Ethics" })}: {settings.ethicsRef ?? notOnFile} ·{" "}
                {formatDate(settings.ethicsApprovedAt, lang)}
              </li>
              <li>MoU: {formatDate(settings.mouSignedAt, lang)}</li>
              <li>
                {t({ th: "มูลนิธิอนุญาต", en: "Foundation permission" })}:{" "}
                {formatDate(settings.foundationPermissionAt, lang)}
              </li>
            </ul>
          )}
          <DialogFooter className="gap-2 sm:space-x-0">
            <button
              type="button"
              onClick={() => setConfirming(null)}
              disabled={save.isPending}
              className={BTN_SECONDARY}
            >
              {t({ th: "ยกเลิก", en: "Cancel" })}
            </button>
            <button
              type="button"
              onClick={confirmToggle}
              disabled={save.isPending}
              className={BTN_PRIMARY}
            >
              {confirming === "unlock" ? (
                <LockOpen className="h-4 w-4" aria-hidden />
              ) : (
                <Lock className="h-4 w-4" aria-hidden />
              )}
              {save.isPending
                ? t({ th: "กำลังบันทึก...", en: "Saving..." })
                : confirming === "unlock"
                  ? t({ th: "เปิดการเก็บข้อมูล", en: "Open collection" })
                  : t({ th: "ล็อกการเก็บข้อมูล", en: "Lock collection" })}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ApprovalsForm({
  settings,
  saving,
  onSave,
}: {
  settings: StudySettings;
  saving: boolean;
  onSave: (patch: StudySettingsPatch) => void;
}) {
  const { t, lang } = useLanguage();
  const ids = useId();
  const [ref, setRef] = useState(settings.ethicsRef ?? "");
  const [ethicsDate, setEthicsDate] = useState(settings.ethicsApprovedAt ?? "");
  const [mouDate, setMouDate] = useState(settings.mouSignedAt ?? "");
  const [foundationDate, setFoundationDate] = useState(settings.foundationPermissionAt ?? "");
  const dirty =
    ref.trim() !== (settings.ethicsRef ?? "") ||
    ethicsDate !== (settings.ethicsApprovedAt ?? "") ||
    mouDate !== (settings.mouSignedAt ?? "") ||
    foundationDate !== (settings.foundationPermissionAt ?? "");
  const clearsWhileOpen =
    settings.collectionUnlocked && (!ref.trim() || !ethicsDate || !mouDate || !foundationDate);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!dirty || clearsWhileOpen) return;
    onSave({
      expectedUpdatedAt: settings.updatedAt,
      ethicsRef: ref,
      ethicsApprovedAt: ethicsDate || null,
      mouSignedAt: mouDate || null,
      foundationPermissionAt: foundationDate || null,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor={`${ids}-ref`} className="mb-1 block text-sm font-medium text-navy-900">
            {t({ th: "เลขที่อ้างอิงจริยธรรม", en: "Ethics reference" })}
          </label>
          <input
            id={`${ids}-ref`}
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            maxLength={120}
            autoComplete="off"
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor={`${ids}-ethics`} className="mb-1 block text-sm font-medium text-navy-900">
            {t({ th: "วันที่อนุมัติจริยธรรม", en: "Ethics approval date" })}
          </label>
          <input
            id={`${ids}-ethics`}
            type="date"
            value={ethicsDate}
            onChange={(e) => setEthicsDate(e.target.value)}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor={`${ids}-mou`} className="mb-1 block text-sm font-medium text-navy-900">
            {t({ th: "วันที่ลงนาม MoU", en: "MoU signing date" })}
          </label>
          <input
            id={`${ids}-mou`}
            type="date"
            value={mouDate}
            onChange={(e) => setMouDate(e.target.value)}
            className={INPUT}
          />
        </div>
        <div>
          <label
            htmlFor={`${ids}-foundation`}
            className="mb-1 block text-sm font-medium text-navy-900"
          >
            {t({ th: "วันที่มูลนิธิอนุญาตให้ใช้ข้อมูล", en: "Foundation permission date" })}
          </label>
          <input
            id={`${ids}-foundation`}
            type="date"
            value={foundationDate}
            onChange={(e) => setFoundationDate(e.target.value)}
            className={INPUT}
          />
        </div>
      </div>
      {clearsWhileOpen && (
        <p lang={lang} className="text-sm text-dignity-ink">
          {t({
            th: "ตอนนี้เปิดการเก็บข้อมูลอยู่ ถ้าต้องการลบเลขที่อ้างอิงหรือวันที่อนุมัติ ให้ล็อกการเก็บข้อมูลก่อน",
            en: "Collection is open. To clear the ethics reference or an approval date, lock collection first.",
          })}
        </p>
      )}
      <button type="submit" disabled={!dirty || clearsWhileOpen || saving} className={BTN_PRIMARY}>
        {saving
          ? t({ th: "กำลังบันทึก...", en: "Saving..." })
          : t({ th: "บันทึกข้อมูลการอนุมัติ", en: "Save approvals" })}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// 2) Settings form
// ---------------------------------------------------------------------------

function SettingsCard({
  settings,
  canEdit,
  coordinatorDepartments,
}: {
  settings: StudySettings;
  canEdit: boolean;
  coordinatorDepartments: Set<string>;
}) {
  const { t, lang } = useLanguage();
  const save = useSaveSettings();
  const [result, setResult] = useState<Result | null>(null);
  const ids = useId();
  // Remount the form only when its own saved values change, so saving approvals does not
  // throw away edits in progress here.
  const key = JSON.stringify([
    settings.departments,
    settings.sites,
    settings.speakerGuidanceVersion,
    settings.retentionYears,
    settings.studyEnd,
  ]);

  const onSave = (patch: StudySettingsPatch) =>
    save.mutate(patch, {
      onSuccess: (res) =>
        setResult({
          ok: true,
          msg: res.changed.length
            ? { th: "บันทึกการตั้งค่าแล้ว", en: "Settings saved" }
            : { th: "ไม่มีอะไรเปลี่ยน", en: "Nothing changed" },
        }),
      onError: (err) => setResult({ ok: false, msg: messageFor(err) }),
    });

  return (
    <section
      aria-labelledby={`${ids}-h`}
      className="space-y-4 rounded-lg border border-warm-200 bg-white p-4 sm:p-5"
    >
      <div>
        <h2 id={`${ids}-h`} className="text-base font-semibold text-navy-900">
          {t({ th: "การตั้งค่าการศึกษา", en: "Study settings" })}
        </h2>
        <p lang={lang} className="mt-1 text-sm text-warm-600">
          {t({
            th: "แผนกและพื้นที่ที่ร่วมการศึกษา คำแนะนำสำหรับผู้พูด และระยะเวลาเก็บรักษาข้อมูล",
            en: "Departments and sites in the study, speaker guidance, and how long data is kept.",
          })}
        </p>
      </div>
      <SettingsForm
        key={key}
        settings={settings}
        canEdit={canEdit}
        saving={save.isPending}
        coordinatorDepartments={coordinatorDepartments}
        onSave={onSave}
      />
      <LiveResult result={result} />
    </section>
  );
}

function SettingsForm({
  settings,
  canEdit,
  saving,
  coordinatorDepartments,
  onSave,
}: {
  settings: StudySettings;
  canEdit: boolean;
  saving: boolean;
  coordinatorDepartments: Set<string>;
  onSave: (patch: StudySettingsPatch) => void;
}) {
  const { t, lang } = useLanguage();
  const ids = useId();
  const [departments, setDepartments] = useState(settings.departments);
  const [sites, setSites] = useState(settings.sites);
  const [guidance, setGuidance] = useState(settings.speakerGuidanceVersion ?? "");
  const [retention, setRetention] = useState(String(settings.retentionYears));
  const [studyEnd, setStudyEnd] = useState(settings.studyEnd ?? "");

  const years = Number(retention);
  const retentionValid =
    /^\d+$/.test(retention.trim()) && years >= RETENTION_MIN && years <= RETENTION_MAX;
  const dirty =
    !sameList(departments, settings.departments) ||
    !sameList(sites, settings.sites) ||
    guidance.trim() !== (settings.speakerGuidanceVersion ?? "") ||
    retention.trim() !== String(settings.retentionYears) ||
    studyEnd !== (settings.studyEnd ?? "");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!dirty || !retentionValid) return;
    onSave({
      expectedUpdatedAt: settings.updatedAt,
      departments,
      sites,
      speakerGuidanceVersion: guidance,
      retentionYears: years,
      studyEnd: studyEnd || null,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <ChipListEditor
        label={t({ th: "แผนก", en: "Departments" })}
        hint={t({
          th: `แผนกที่ร่วมการศึกษา ไม่เกิน ${LIST_MAX_ITEMS} รายการ รายการละไม่เกิน ${LIST_ITEM_MAX} ตัวอักษร`,
          en: `Departments in the study. Up to ${LIST_MAX_ITEMS}, each up to ${LIST_ITEM_MAX} characters.`,
        })}
        addLabel={t({ th: "เพิ่มแผนก", en: "Add department" })}
        items={departments}
        onChange={setDepartments}
        disabled={!canEdit}
        inUse={coordinatorDepartments}
      />
      <ChipListEditor
        label={t({ th: "พื้นที่", en: "Sites" })}
        hint={t({
          th: `เช่น กรุงเทพฯ พัทยา ไม่เกิน ${LIST_MAX_ITEMS} รายการ`,
          en: `For example Bangkok, Pattaya. Up to ${LIST_MAX_ITEMS}.`,
        })}
        addLabel={t({ th: "เพิ่มพื้นที่", en: "Add site" })}
        items={sites}
        onChange={setSites}
        disabled={!canEdit}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={`${ids}-guide`} className="mb-1 block text-sm font-medium text-navy-900">
            {t({ th: "ฉบับคำแนะนำสำหรับผู้พูด", en: "Speaker guidance version" })}
          </label>
          <input
            id={`${ids}-guide`}
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            maxLength={60}
            disabled={!canEdit}
            aria-describedby={`${ids}-guide-hint`}
            autoComplete="off"
            className={INPUT}
          />
          <p id={`${ids}-guide-hint`} lang={lang} className="mt-1 text-xs text-warm-600">
            {t({
              th: "เช่น v1.0 · คำแนะนำนี้ชวนผู้พูดไม่เอ่ยชื่อผู้รับบริการหรือบุคคลที่สาม",
              en: "For example v1.0 · the guidance asks speakers not to name service users or third parties.",
            })}
          </p>
        </div>
        <div>
          <label htmlFor={`${ids}-ret`} className="mb-1 block text-sm font-medium text-navy-900">
            {t({ th: "เก็บรักษาข้อมูล (ปี)", en: "Keep data for (years)" })}
          </label>
          <input
            id={`${ids}-ret`}
            type="number"
            inputMode="numeric"
            min={RETENTION_MIN}
            max={RETENTION_MAX}
            step={1}
            value={retention}
            onChange={(e) => setRetention(e.target.value)}
            disabled={!canEdit}
            aria-invalid={!retentionValid}
            aria-describedby={`${ids}-ret-hint`}
            className={INPUT}
          />
          <p
            id={`${ids}-ret-hint`}
            className={`mt-1 text-xs ${retentionValid ? "text-warm-600" : "text-dignity-ink"}`}
          >
            {t({
              th: `${RETENTION_MIN} ถึง ${RETENTION_MAX} ปี`,
              en: `${RETENTION_MIN} to ${RETENTION_MAX} years`,
            })}
          </p>
        </div>
        <div>
          <label htmlFor={`${ids}-end`} className="mb-1 block text-sm font-medium text-navy-900">
            {t({ th: "วันสิ้นสุดการศึกษา", en: "Study end date" })}
          </label>
          <input
            id={`${ids}-end`}
            type="date"
            value={studyEnd}
            onChange={(e) => setStudyEnd(e.target.value)}
            disabled={!canEdit}
            className={INPUT}
          />
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!dirty || !retentionValid || saving}
            className={BTN_PRIMARY}
          >
            {saving
              ? t({ th: "กำลังบันทึก...", en: "Saving..." })
              : t({ th: "บันทึกการตั้งค่า", en: "Save settings" })}
          </button>
          {dirty && (
            <span className="text-sm text-warm-600">
              {t({ th: "มีการแก้ไขที่ยังไม่บันทึก", en: "Unsaved changes" })}
            </span>
          )}
        </div>
      )}
    </form>
  );
}

function ChipListEditor({
  label,
  hint,
  addLabel,
  items,
  onChange,
  disabled,
  inUse,
}: {
  label: string;
  hint: string;
  addLabel: string;
  items: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
  inUse?: Set<string>;
}) {
  const { t, lang } = useLanguage();
  const ids = useId();
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<Localized | null>(null);

  const add = () => {
    const value = draft.trim().replace(/\s+/g, " ");
    if (!value) return;
    if (value.length > LIST_ITEM_MAX) {
      setNotice({
        th: `ยาวเกิน ${LIST_ITEM_MAX} ตัวอักษร`,
        en: `Longer than ${LIST_ITEM_MAX} characters`,
      });
      return;
    }
    if (items.length >= LIST_MAX_ITEMS) {
      setNotice({
        th: `เพิ่มได้ไม่เกิน ${LIST_MAX_ITEMS} รายการ`,
        en: `At most ${LIST_MAX_ITEMS} items`,
      });
      return;
    }
    if (items.some((i) => i.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      setNotice({ th: `มี "${value}" อยู่แล้ว`, en: `"${value}" is already in the list` });
      return;
    }
    onChange([...items, value]);
    setDraft("");
    setNotice({ th: `เพิ่ม "${value}" แล้ว`, en: `Added "${value}"` });
  };

  const remove = (item: string) => {
    onChange(items.filter((i) => i !== item));
    setNotice(
      inUse?.has(item)
        ? {
            th: `นำ "${item}" ออกแล้ว แผนกนี้มีผู้ประสานงานอยู่ หลังบันทึกให้ตรวจบทบาทในตารางทีม`,
            en: `Removed "${item}". This department has a coordinator: check the team table after saving.`,
          }
        : { th: `นำ "${item}" ออกแล้ว`, en: `Removed "${item}"` },
    );
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  };

  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-medium text-navy-900">{label}</legend>
      <p id={`${ids}-hint`} lang={lang} className="text-xs text-warm-600">
        {hint}
      </p>
      <ul className="mt-2 flex flex-wrap gap-2" aria-label={label}>
        {items.length === 0 && (
          <li className="py-2 text-sm text-warm-600">
            {t({ th: "ยังไม่มีรายการ", en: "None yet" })}
          </li>
        )}
        {items.map((item) => (
          <li
            key={item}
            className={`inline-flex min-h-11 max-w-full items-center rounded-pill border border-lavender-300 bg-lavender-100 text-sm text-navy-900 ${
              disabled ? "px-3" : "pl-3"
            }`}
          >
            <span className="min-w-0 py-1 break-words">{item}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(item)}
                aria-label={`${t({ th: "นำออก", en: "Remove" })}: ${item}`}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-navy-500 hover:bg-lavender-300/60"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
      {!disabled && (
        <div className="mt-2 flex gap-2">
          <label htmlFor={`${ids}-add`} className="sr-only">
            {addLabel}
          </label>
          <input
            id={`${ids}-add`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={LIST_ITEM_MAX + 20}
            placeholder={addLabel}
            aria-describedby={`${ids}-hint ${ids}-notice`}
            autoComplete="off"
            className={`${INPUT} min-w-0 flex-1`}
          />
          <button
            type="button"
            onClick={add}
            disabled={!draft.trim()}
            className={`${BTN_SECONDARY} shrink-0`}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t({ th: "เพิ่ม", en: "Add" })}
          </button>
        </div>
      )}
      <p
        id={`${ids}-notice`}
        role="status"
        aria-live="polite"
        lang={lang}
        className="mt-1 min-h-4 text-xs text-warm-700"
      >
        {notice && t(notice)}
      </p>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// 3) Team
// ---------------------------------------------------------------------------

function memberLabel(m: { name: string | null; email: string | null }) {
  return m.name || m.email || "-";
}

function TeamSection({ data, departments }: { data: MembersData; departments: string[] }) {
  const { t, lang } = useLanguage();
  const ids = useId();
  const qc = useQueryClient();
  const { members, accounts, accountsAvailable, canGrant, limited, viewerId } = data;
  const [addOpen, setAddOpen] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [confirmOff, setConfirmOff] = useState<ResearchMember | null>(null);
  const setActiveFn = useServerFn(setResearchMemberActive);

  const toggle = useMutation({
    mutationFn: (m: ResearchMember) => setActiveFn({ data: { memberId: m.id, active: !m.active } }),
    onSuccess: (_res, m) => {
      const who = memberLabel(m);
      const role = ROLE_LABEL[m.role];
      setResult({
        ok: true,
        msg: m.active
          ? { th: `ปิดสิทธิ์${role.th}ของ ${who} แล้ว`, en: `${who}: ${role.en} access turned off` }
          : {
              th: `เปิดสิทธิ์${role.th}ของ ${who} อีกครั้งแล้ว`,
              en: `${who}: ${role.en} access turned back on`,
            },
      });
      setConfirmOff(null);
    },
    onError: (err) => {
      setResult({ ok: false, msg: messageFor(err) });
      setConfirmOff(null);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: MEMBERS_KEY });
      void qc.invalidateQueries({ queryKey: ACCESS_KEY });
    },
  });

  const sorted = useMemo(
    () =>
      [...members].sort(
        (a, b) =>
          Number(b.active) - Number(a.active) ||
          RESEARCH_ROLES.indexOf(a.role) - RESEARCH_ROLES.indexOf(b.role) ||
          memberLabel(a).localeCompare(memberLabel(b), "th"),
      ),
    [members],
  );
  const activeCount = members.filter((m) => m.active).length;

  return (
    <section
      aria-labelledby={`${ids}-h`}
      className="space-y-4 rounded-lg border border-warm-200 bg-white p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`${ids}-h`} className="text-base font-semibold text-navy-900">
            {t({ th: "ทีมวิจัย", en: "Research team" })}
          </h2>
          <p className="mt-1 text-sm text-warm-600">
            {t({
              th: `ใช้งานอยู่ ${activeCount} จาก ${members.length} บทบาท`,
              en: `${activeCount} of ${members.length} roles active`,
            })}
          </p>
        </div>
        {canGrant && (
          <button type="button" onClick={() => setAddOpen(true)} className={BTN_PRIMARY}>
            <UserPlus className="h-4 w-4" aria-hidden />
            {t({ th: "เพิ่มสมาชิก", en: "Add member" })}
          </button>
        )}
      </div>

      {!canGrant && (
        <p lang={lang} className="rounded-md bg-warm-50 p-3 text-sm text-warm-700">
          {limited
            ? t({
                th: "ตอนนี้ฐานข้อมูลเปิดให้เฉพาะผู้ดูแลระบบเห็นรายชื่อทั้งทีม ตารางนี้จึงแสดงเฉพาะบทบาทของคุณเอง การเพิ่มหรือปิดสิทธิ์สมาชิกทำได้เฉพาะผู้ดูแลระบบ",
                en: "For now only admins can read the whole team list, so this table shows only your own roles. Only admins can add members or change their access.",
              })
            : t({
                th: "การเพิ่มหรือปิดสิทธิ์สมาชิกทำได้เฉพาะผู้ดูแลระบบ",
                en: "Only admins can add members or change their access.",
              })}
        </p>
      )}
      {!accountsAvailable && (
        <p lang={lang} className="rounded-md bg-dignity-soft/60 p-3 text-sm text-dignity-ink">
          {t({
            th: "ดึงชื่อและอีเมลของบัญชีไม่ได้ในตอนนี้ ลองรีเฟรชอีกครั้ง",
            en: "Account names and emails could not be loaded right now. Try refreshing.",
          })}
        </p>
      )}

      {members.length === 0 ? (
        <div className="rounded-lg border border-dashed border-warm-300 px-6 py-10 text-center">
          <Users className="mx-auto h-8 w-8 text-warm-400" aria-hidden />
          <p lang={lang} className="mt-3 text-sm text-warm-600">
            {canGrant
              ? t({
                  th: "ยังไม่มีสมาชิกทีมวิจัย กด “เพิ่มสมาชิก” เพื่อเริ่ม",
                  en: "No research team members yet. Choose “Add member” to start.",
                })
              : t({ th: "ยังไม่มีสมาชิกทีมวิจัยที่แสดงได้", en: "No team members to show yet." })}
          </p>
        </div>
      ) : (
        <div
          role="region"
          aria-labelledby={`${ids}-h`}
          tabIndex={0}
          className="overflow-x-auto rounded-lg border border-warm-200"
        >
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-warm-50 text-left text-xs text-warm-600">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t({ th: "ชื่อ", en: "Name" })}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t({ th: "อีเมล", en: "Email" })}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t({ th: "บทบาทในการวิจัย", en: "Research role" })}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t({ th: "แผนก", en: "Department" })}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t({ th: "สถานะ", en: "Status" })}
                </th>
                {canGrant && (
                  <th scope="col" className="px-3 py-2 font-semibold">
                    <span className="sr-only">{t({ th: "การจัดการ", en: "Actions" })}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => {
                const orphanDept =
                  m.role === "dept_coordinator" &&
                  !!m.department &&
                  !departments.includes(m.department);
                return (
                  <tr
                    key={m.id}
                    className={`border-t border-warm-100 align-top ${m.active ? "" : "bg-warm-50/60 text-warm-600"}`}
                  >
                    <td className="px-3 py-2">
                      <span className="font-medium text-navy-900">{m.name ?? "-"}</span>
                      {m.userId === viewerId && (
                        <span className="ml-1 text-xs text-warm-600">
                          ({t({ th: "คุณ", en: "you" })})
                        </span>
                      )}
                      {m.note && (
                        <span className="mt-0.5 block max-w-56 text-xs break-words text-warm-600">
                          {m.note}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 break-all text-warm-700">{m.email ?? "-"}</td>
                    <td className="px-3 py-2">
                      <span
                        lang={lang}
                        className="inline-block rounded-pill bg-lavender-100 px-2.5 py-0.5 text-xs font-medium text-navy-900"
                      >
                        {t(ROLE_LABEL[m.role] ?? { th: m.role, en: m.role })}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-warm-700">
                      {m.department ?? "-"}
                      {orphanDept && (
                        <span lang={lang} className="mt-0.5 block text-xs text-dignity-ink">
                          {t({
                            th: "แผนกนี้ไม่อยู่ในรายการแผนกแล้ว",
                            en: "No longer in the department list",
                          })}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-pill px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${
                          m.active
                            ? "bg-accuracy-soft text-accuracy-ink"
                            : "bg-warm-200 text-warm-700"
                        }`}
                      >
                        {m.active
                          ? t({ th: "ใช้งานอยู่", en: "Active" })
                          : t({ th: "ปิดสิทธิ์แล้ว", en: "Turned off" })}
                      </span>
                    </td>
                    {canGrant && (
                      <td className="px-3 py-1 text-right">
                        {!m.active && m.userId === viewerId && selfGrantBlock(m.role) ? (
                          <span
                            lang={lang}
                            className="inline-block max-w-40 py-2 text-left text-xs text-warm-600"
                          >
                            {t({
                              th: "ให้ผู้ดูแลระบบอีกคนเปิดสิทธิ์นี้",
                              en: "Another admin can turn this back on",
                            })}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => (m.active ? setConfirmOff(m) : toggle.mutate(m))}
                            disabled={toggle.isPending}
                            aria-label={`${
                              m.active
                                ? t({ th: "ปิดสิทธิ์", en: "Turn off" })
                                : t({ th: "เปิดสิทธิ์อีกครั้ง", en: "Turn back on" })
                            }: ${t(ROLE_LABEL[m.role])} · ${memberLabel(m)}`}
                            className={`${BTN_SECONDARY} whitespace-nowrap px-3`}
                          >
                            {m.active
                              ? t({ th: "ปิดสิทธิ์", en: "Turn off" })
                              : t({ th: "เปิดสิทธิ์อีกครั้ง", en: "Turn back on" })}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <LiveResult result={result} />

      {canGrant && (
        <>
          <AddMemberDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            accounts={accounts}
            accountsAvailable={accountsAvailable}
            members={members}
            departments={departments}
            viewerId={viewerId}
            onDone={setResult}
          />
          <Dialog
            open={confirmOff !== null}
            onOpenChange={(o) => {
              if (!o && !toggle.isPending) setConfirmOff(null);
            }}
          >
            <DialogContent
              className="max-h-[90dvh] overflow-y-auto sm:max-w-md"
              onEscapeKeyDown={(e) => toggle.isPending && e.preventDefault()}
              onInteractOutside={(e) => toggle.isPending && e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>
                  {t({ th: "ปิดสิทธิ์บทบาทนี้?", en: "Turn off this role?" })}
                </DialogTitle>
                <DialogDescription lang={lang}>
                  {confirmOff &&
                    t({
                      th: `${memberLabel(confirmOff)} จะไม่มีสิทธิ์ของ${ROLE_LABEL[confirmOff.role].th}จนกว่าจะเปิดอีกครั้ง ประวัติและข้อมูลที่บันทึกไว้ยังอยู่ครบ`,
                      en: `${memberLabel(confirmOff)} will lose ${ROLE_LABEL[confirmOff.role].en} access until it is turned back on. Their history and saved records stay as they are.`,
                    })}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:space-x-0">
                <button
                  type="button"
                  onClick={() => setConfirmOff(null)}
                  disabled={toggle.isPending}
                  className={BTN_SECONDARY}
                >
                  {t({ th: "ยกเลิก", en: "Cancel" })}
                </button>
                <button
                  type="button"
                  onClick={() => confirmOff && toggle.mutate(confirmOff)}
                  disabled={toggle.isPending}
                  className={BTN_PRIMARY}
                >
                  {toggle.isPending
                    ? t({ th: "กำลังบันทึก...", en: "Saving..." })
                    : t({ th: "ปิดสิทธิ์", en: "Turn off" })}
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </section>
  );
}

const MAX_MATCHES = 8;

function AddMemberDialog({
  open,
  onOpenChange,
  accounts,
  accountsAvailable,
  members,
  departments,
  viewerId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  accounts: TeamAccount[];
  accountsAvailable: boolean;
  members: ResearchMember[];
  departments: string[];
  viewerId: string;
  onDone: (r: Result) => void;
}) {
  const { t, lang } = useLanguage();
  const ids = useId();
  const qc = useQueryClient();
  const grantFn = useServerFn(grantResearchRole);
  const [q, setQ] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<ResearchRole>("researcher");
  const [department, setDepartment] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<Localized | null>(null);

  const reset = () => {
    setQ("");
    setUserId(null);
    setRole("researcher");
    setDepartment("");
    setNote("");
    setError(null);
  };

  const needle = q.trim().toLocaleLowerCase();
  const matches = useMemo(
    () =>
      needle
        ? accounts.filter((a) => `${a.name} ${a.email}`.toLocaleLowerCase().includes(needle))
        : [],
    [accounts, needle],
  );
  const selected = accounts.find((a) => a.id === userId) ?? null;
  const held = members.filter((m) => m.userId === userId);
  const blocked = conflictingRoles(role);
  const conflict = held.find((m) => m.active && blocked.includes(m.role));
  const same = held.find((m) => m.role === role);
  const needsDept = role === "dept_coordinator";
  // The server refuses this too: another admin must give you a consent-keeper or
  // de-identification role.
  const selfBlock = userId === viewerId ? selfGrantBlock(role) : null;
  const selfKeeper = selfBlock !== null;

  const grant = useMutation({
    mutationFn: () =>
      grantFn({
        data: {
          userId: userId as string,
          role,
          department: needsDept ? department : null,
          note: note.trim() || null,
        },
      }),
    onSuccess: () => {
      const who = selected ? memberLabel(selected) : "";
      const msg = {
        th: `ให้บทบาท${ROLE_LABEL[role].th}กับ ${who} แล้ว`,
        en: `${who} now has the ${ROLE_LABEL[role].en} role`,
      };
      onDone({ ok: true, msg });
      toast.success(t(msg));
      reset();
      onOpenChange(false);
    },
    onError: (err) => setError(messageFor(err)),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: MEMBERS_KEY });
      void qc.invalidateQueries({ queryKey: ACCESS_KEY });
    },
  });

  const canSubmit =
    !!userId && !conflict && !selfKeeper && (!needsDept || !!department) && !grant.isPending;

  const close = () => {
    if (grant.isPending) return;
    reset();
    onOpenChange(false);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    grant.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
        onEscapeKeyDown={(e) => grant.isPending && e.preventDefault()}
        onInteractOutside={(e) => grant.isPending && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {t({ th: "เพิ่มสมาชิกทีมวิจัย", en: "Add a research team member" })}
          </DialogTitle>
          <DialogDescription lang={lang}>
            {t({
              th: "เลือกบัญชีที่มีอยู่ในระบบ แล้วเลือกบทบาท ระบบจะบันทึกการเปลี่ยนแปลงไว้ในประวัติการใช้งาน",
              en: "Choose an existing account, then a role. The change is recorded in the audit trail.",
            })}
          </DialogDescription>
        </DialogHeader>

        <form id={`${ids}-form`} onSubmit={submit} className="min-w-0 space-y-4">
          {/* Account */}
          <div className="min-w-0">
            <label htmlFor={`${ids}-q`} className="mb-1 block text-sm font-medium text-navy-900">
              {t({ th: "ค้นหาบัญชี", en: "Find an account" })}
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-warm-400"
                aria-hidden
              />
              <input
                id={`${ids}-q`}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                maxLength={120}
                placeholder={t({ th: "ชื่อหรืออีเมล", en: "Name or email" })}
                aria-describedby={`${ids}-q-status`}
                autoComplete="off"
                className={`${INPUT} pl-9`}
              />
            </div>
            <p
              id={`${ids}-q-status`}
              role="status"
              aria-live="polite"
              className="mt-1 text-xs text-warm-600"
            >
              {!accountsAvailable
                ? t({
                    th: "ดึงรายชื่อบัญชีไม่ได้ในตอนนี้ ลองรีเฟรชหน้า",
                    en: "Accounts could not be loaded. Try refreshing the page.",
                  })
                : !needle
                  ? t({ th: "พิมพ์ชื่อหรืออีเมลเพื่อค้นหา", en: "Type a name or email to search" })
                  : matches.length === 0
                    ? t({ th: "ไม่พบบัญชีที่ตรงกัน", en: "No matching accounts" })
                    : matches.length > MAX_MATCHES
                      ? t({
                          th: `พบ ${matches.length} บัญชี แสดง ${MAX_MATCHES} รายการแรก พิมพ์เพิ่มเพื่อให้แคบลง`,
                          en: `${matches.length} accounts found. Showing the first ${MAX_MATCHES}: type more to narrow it down.`,
                        })
                      : t({
                          th: `พบ ${matches.length} บัญชี`,
                          en: `${matches.length} accounts found`,
                        })}
            </p>

            {matches.length > 0 && (
              <fieldset className="mt-2 min-w-0">
                <legend className="sr-only">
                  {t({ th: "เลือกบัญชี", en: "Choose an account" })}
                </legend>
                <ul className="divide-y divide-warm-100 rounded-md border border-warm-200">
                  {matches.slice(0, MAX_MATCHES).map((a) => {
                    const roles = members.filter((m) => m.userId === a.id && m.active);
                    return (
                      <li key={a.id}>
                        <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-warm-50">
                          <input
                            type="radio"
                            name={`${ids}-account`}
                            value={a.id}
                            checked={userId === a.id}
                            onChange={() => {
                              setUserId(a.id);
                              setError(null);
                            }}
                            className="h-4 w-4 shrink-0 accent-[var(--color-navy-500)]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium break-words text-navy-900">
                              {a.name || a.email}
                              {a.id === viewerId && (
                                <span className="ml-1 text-xs font-normal text-warm-600">
                                  ({t({ th: "คุณ", en: "you" })})
                                </span>
                              )}
                            </span>
                            <span className="block text-xs break-all text-warm-600">{a.email}</span>
                            {roles.length > 0 && (
                              <span lang={lang} className="block text-xs text-warm-700">
                                {roles.map((m) => t(ROLE_LABEL[m.role])).join(" · ")}
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            )}

            {selected && (
              <p className="mt-2 rounded-md bg-lavender-100 px-3 py-2 text-sm text-navy-900">
                <span className="font-medium">{t({ th: "บัญชีที่เลือก", en: "Selected" })}:</span>{" "}
                <span className="break-words">{memberLabel(selected)}</span>
                {selected.email && selected.name && (
                  <span className="block text-xs break-all text-warm-700">{selected.email}</span>
                )}
              </p>
            )}
          </div>

          {/* Role */}
          <div>
            <label htmlFor={`${ids}-role`} className="mb-1 block text-sm font-medium text-navy-900">
              {t({ th: "บทบาทในการวิจัย", en: "Research role" })}
            </label>
            <select
              id={`${ids}-role`}
              value={role}
              onChange={(e) => {
                setRole(e.target.value as ResearchRole);
                setError(null);
              }}
              aria-describedby={`${ids}-role-hint`}
              className={INPUT}
            >
              {RESEARCH_ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(ROLE_LABEL[r])}
                </option>
              ))}
            </select>
            <p id={`${ids}-role-hint`} lang={lang} className="mt-1 text-xs text-warm-600">
              {t(ROLE_HINT[role])}
            </p>
          </div>

          {/* Department (coordinators only) */}
          {needsDept && (
            <div>
              <label
                htmlFor={`${ids}-dept`}
                className="mb-1 block text-sm font-medium text-navy-900"
              >
                {t({ th: "แผนก", en: "Department" })}
              </label>
              {departments.length === 0 ? (
                <p
                  lang={lang}
                  className="rounded-md bg-dignity-soft/60 p-3 text-sm text-dignity-ink"
                >
                  {t({
                    th: "ยังไม่มีรายการแผนก เพิ่มแผนกในส่วนการตั้งค่าการศึกษาก่อน",
                    en: "There are no departments yet. Add them under study settings first.",
                  })}
                </p>
              ) : (
                <select
                  id={`${ids}-dept`}
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  required
                  className={INPUT}
                >
                  <option value="">{t({ th: "เลือกแผนก", en: "Choose a department" })}</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Note */}
          <div>
            <label htmlFor={`${ids}-note`} className="mb-1 block text-sm font-medium text-navy-900">
              {t({ th: "หมายเหตุ (ไม่บังคับ)", en: "Note (optional)" })}
            </label>
            <textarea
              id={`${ids}-note`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              aria-describedby={`${ids}-note-hint`}
              className="w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-navy-900"
            />
            <p id={`${ids}-note-hint`} lang={lang} className="mt-1 text-xs text-warm-600">
              {t({
                th: "เช่น เหตุผลของบทบาทนี้ ไม่ต้องใส่ข้อมูลส่วนตัวหรือข้อมูลสุขภาพ",
                en: "For example why this role was given. No personal or health details.",
              })}
            </p>
          </div>

          {/* What will happen */}
          <div aria-live="polite" lang={lang} className="space-y-2 text-sm">
            {conflict && (
              <p className="rounded-md border border-dignity/50 bg-dignity-soft/60 p-3 text-dignity-ink">
                {t({
                  th: `บัญชีนี้เป็น${ROLE_LABEL[conflict.role].th}อยู่แล้ว · `,
                  en: `This account is already ${ROLE_LABEL[conflict.role].en}. `,
                })}
                {t(MSG.conflict)}
              </p>
            )}
            {!conflict && selfKeeper && (
              <p className="rounded-md border border-dignity/50 bg-dignity-soft/60 p-3 text-dignity-ink">
                {t(selfBlock === "TEAM_SELF_RAW_AUDIO" ? MSG.selfRawAudio : MSG.selfKeeper)}
              </p>
            )}
            {!conflict && !selfKeeper && same?.active && (
              <p className="rounded-md bg-warm-50 p-3 text-warm-700">
                {t({
                  th: "บัญชีนี้มีบทบาทนี้อยู่แล้ว การบันทึกจะอัปเดตแผนกและหมายเหตุ",
                  en: "This account already has this role. Saving updates the department and note.",
                })}
              </p>
            )}
            {!conflict && !selfKeeper && same && !same.active && (
              <p className="rounded-md bg-warm-50 p-3 text-warm-700">
                {t({
                  th: "บทบาทนี้เคยถูกปิดสิทธิ์ไว้ การบันทึกจะเปิดสิทธิ์อีกครั้ง",
                  en: "This role was turned off before. Saving turns it back on.",
                })}
              </p>
            )}
          </div>

          <div role="alert" lang={lang} className="text-sm text-dignity-ink">
            {error && t(error)}
          </div>
        </form>

        <DialogFooter className="gap-2 sm:space-x-0">
          <button
            type="button"
            onClick={close}
            disabled={grant.isPending}
            className={BTN_SECONDARY}
          >
            {t({ th: "ยกเลิก", en: "Cancel" })}
          </button>
          <button type="submit" form={`${ids}-form`} disabled={!canSubmit} className={BTN_PRIMARY}>
            <UserPlus className="h-4 w-4" aria-hidden />
            {grant.isPending
              ? t({ th: "กำลังบันทึก...", en: "Saving..." })
              : t({ th: "ให้บทบาทนี้", en: "Give this role" })}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 4) Who sees what
// ---------------------------------------------------------------------------

function PrivacyNote() {
  const { t, lang } = useLanguage();
  const ids = useId();
  return (
    <section
      aria-labelledby={`${ids}-h`}
      className="rounded-lg border border-lavender-300 bg-lavender-100/60 p-4 sm:p-5"
    >
      <h2 id={`${ids}-h`} className="flex items-center gap-2 text-base font-semibold text-navy-900">
        <ShieldCheck className="h-5 w-5 shrink-0 text-accuracy" aria-hidden />
        {t({ th: "ใครเห็นอะไร", en: "Who sees what" })}
      </h2>
      <div lang={lang} className="mt-2 space-y-2 text-sm text-navy-900">
        <p>
          {t({
            th: "ผลการให้ความยินยอมรายบุคคลเห็นได้เฉพาะผู้ขอความยินยอม (อิสระ) และผู้ดูแลข้อมูลเท่านั้น ผู้วิจัยไม่เห็นว่าใครยินยอม ไม่ยินยอม หรือถอนตัว และสิทธิ์ผู้ดูแลระบบอย่างเดียวก็ไม่ทำให้เห็น ทีมที่ทำงานกับเซสชันเห็นเพียงว่าเซสชันนั้นพร้อมหรือยัง",
            en: "Individual consent decisions are visible only to independent consent officers and data stewards. The researcher cannot see who agreed, declined or withdrew, and admin access on its own does not show them either. People who work on sessions only see whether a session is ready.",
          })}
        </p>
        <p>
          {t({
            th: "เสียงดิบเปิดฟังได้เฉพาะผู้ดูแลข้อมูลและผู้ช่วยลบตัวระบุตัวตน ผู้วิจัยทำงานกับข้อความที่ลบตัวระบุตัวตนแล้วเท่านั้น และทุกครั้งที่เปิดฟังต้องระบุเหตุผลและถูกบันทึกไว้",
            en: "Raw audio plays only for data stewards and the de-identification assistant. The researcher works with de-identified text only, and every listen needs a reason and is logged.",
          })}
        </p>
        <p>
          {t({
            th: "บัญชีเดียวกันจึงเป็นผู้วิจัยพร้อมกับเป็นผู้ขอความยินยอม ผู้ดูแลข้อมูล หรือผู้ช่วยลบตัวระบุตัวตนไม่ได้",
            en: "That is why one account cannot be the researcher and also a consent officer, data steward or de-identification assistant.",
          })}
        </p>
        <p>
          {t({
            th: "ผู้ดูแลระบบให้บทบาทผู้ขอความยินยอม ผู้ดูแลข้อมูล หรือผู้ช่วยลบตัวระบุตัวตนกับบัญชีของตัวเองไม่ได้ ต้องให้ผู้ดูแลระบบอีกคนเป็นผู้ให้ และทุกการเปลี่ยนบทบาทถูกบันทึกไว้ในประวัติการใช้งาน",
            en: "An admin cannot give their own account the consent officer, data steward or de-identification assistant role: another admin has to. Every role change is recorded in the audit trail.",
          })}
        </p>
        <p>
          {t({
            th: "การเปิดหรือล็อกการเก็บข้อมูลทำได้เฉพาะผู้ดูแลข้อมูล และฐานข้อมูลบันทึกทุกครั้งที่เปิดหรือล็อกไว้เอง",
            en: "Only a data steward opens or locks collection, and the database itself records every time it is opened or locked.",
          })}
        </p>
      </div>
    </section>
  );
}
