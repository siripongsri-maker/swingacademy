import { createFileRoute } from "@tanstack/react-router";
import { useDeferredValue, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  FlaskConical,
  Upload,
  Download,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  FileText,
  Lock,
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
import {
  listBaselineItems,
  importBaselineItems,
  ImportRow,
  BASELINE_SOURCES,
  type BaselineAccess,
  type BaselineItem,
  type KnowledgeLevel,
} from "@/lib/baseline.functions";
import { parseCsv, mapInventory, type ParsedInventory } from "@/lib/baseline-csv";
import { useLanguage, type Localized } from "@/lib/language-context";

export const Route = createFileRoute("/staff/research/baseline")({
  component: BaselinePage,
});

type Source = (typeof BASELINE_SOURCES)[number];

// Strongest knowledge first. Greys for "nothing reusable" (not red: it is a gap, not a fault).
// Every swatch has a border so it stays visible against white and the bar track.
const LEVELS: { id: KnowledgeLevel; label: Localized; bar: string; written: boolean }[] = [
  {
    id: "content_file",
    label: { th: "มีไฟล์เนื้อหา", en: "Content file" },
    bar: "bg-accuracy",
    written: true,
  },
  {
    id: "written_summary",
    label: { th: "มีสรุปที่เขียนไว้", en: "Written summary" },
    bar: "bg-accuracy/50",
    written: true,
  },
  {
    id: "recording",
    label: { th: "มีวิดีโอหรือไลฟ์", en: "Recording" },
    bar: "bg-lavender-500",
    written: false,
  },
  {
    id: "admin_only",
    label: { th: "มีแค่เอกสารธุรการ", en: "Admin papers only" },
    bar: "bg-dignity",
    written: false,
  },
  {
    id: "photos_or_links",
    label: { th: "มีแค่ภาพหรือลิงก์", en: "Photos or links only" },
    bar: "bg-warm-300",
    written: false,
  },
  {
    id: "deleted",
    label: { th: "ถูกลบไปแล้ว", en: "Deleted" },
    bar: "bg-warm-500",
    written: false,
  },
  { id: "none", label: { th: "ไม่มีอะไรเลย", en: "Nothing" }, bar: "bg-warm-400", written: false },
  { id: "unknown", label: { th: "ไม่ทราบ", en: "Unknown" }, bar: "bg-white", written: false },
];
const LEVEL = Object.fromEntries(LEVELS.map((l) => [l.id, l])) as Record<
  KnowledgeLevel,
  (typeof LEVELS)[number]
>;

const NONE = "__none__"; // filter value for items without a role/topic

const ROLE_LABEL: Record<string, Localized> = {
  delivered_by_swing: { th: "SWING จัดหรือสอนเอง", en: "Delivered by SWING" },
  co_organised: { th: "จัดร่วม", en: "Co-organised" },
  speaker_at_external: { th: "เป็นวิทยากรในงานภายนอก", en: "Speaker at external event" },
  internal_staff_training: { th: "อบรมภายใน", en: "Internal staff training" },
  attended_external: { th: "ไปร่วมงานภายนอก", en: "Attended external" },
  internal_meeting: { th: "ประชุมภายใน", en: "Internal meeting" },
  unclear: { th: "ไม่ชัดเจน", en: "Unclear" },
  [NONE]: { th: "ไม่ระบุ", en: "Not set" },
};

const STATUS_LABEL: Record<string, Localized> = {
  happened: { th: "จัดแล้ว", en: "Happened" },
  planned_unconfirmed: { th: "นัดไว้ ไม่พบหลักฐานว่าจัด", en: "Planned, unconfirmed" },
  planned_future: { th: "นัดไว้ในอนาคต", en: "Planned (future)" },
  cancelled: { th: "ยกเลิก", en: "Cancelled" },
};

const TYPE_LABEL: Record<string, Localized> = {
  training: { th: "อบรม", en: "Training" },
  workshop: { th: "เวิร์กช็อป", en: "Workshop" },
  conference_session: { th: "เวทีวิชาการ / ประชุมวิชาการ", en: "Conference session" },
  webinar: { th: "เว็บบินาร์", en: "Webinar" },
  lesson_learning: { th: "ถอดบทเรียน", en: "Lesson learning" },
  coaching: { th: "โค้ช / หนุนเสริม", en: "Coaching" },
  internal_meeting: { th: "ประชุมภายใน", en: "Internal meeting" },
  partner_meeting: { th: "ประชุมกับภาคี", en: "Partner meeting" },
  government_meeting: { th: "ประชุมกับหน่วยงานรัฐ", en: "Government meeting" },
  planning: { th: "ประชุมวางแผน", en: "Planning" },
  interview: { th: "สัมภาษณ์", en: "Interview" },
  other: { th: "อื่นๆ", en: "Other" },
  [NONE]: { th: "ไม่ระบุ", en: "Not set" },
};

const SENSITIVITY_LABEL: Record<string, Localized> = {
  none: { th: "ไม่พบข้อมูลอ่อนไหว", en: "No sensitive data found" },
  staff_names: { th: "มีชื่อทีมงาน", en: "Staff names" },
  community_identifiable: { th: "อาจระบุตัวคนในชุมชนได้", en: "Community member identifiable" },
  health_info_about_individuals: {
    th: "มีข้อมูลสุขภาพของบุคคล",
    en: "Individual health information",
  },
};

const CONFIDENCE_LABEL: Record<string, Localized> = {
  high: { th: "สูง", en: "High" },
  medium: { th: "กลาง", en: "Medium" },
  low: { th: "ต่ำ", en: "Low" },
};

const SOURCE_LABEL: Record<Source, Localized> = {
  line_chat: { th: "แชต LINE", en: "LINE chat" },
  ai_summary: { th: "สรุปจาก AI", en: "AI summary" },
  knowledge_product: { th: "Knowledge Product", en: "Knowledge Product" },
  document: { th: "เอกสาร", en: "Document" },
  other: { th: "อื่นๆ", en: "Other" },
};

const PAGE_ROWS = 100;
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const hasThai = (s: string) => /[฀-๿]/.test(s);

function countBy<T>(items: T[], key: (i: T) => string | null) {
  const m = new Map<string, number>();
  for (const i of items) {
    const k = key(i) || NONE;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function errorKind(err: unknown): "missing" | "forbidden" | "other" | null {
  if (!err) return null;
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("BASELINE_TABLE_MISSING")) return "missing";
  if (msg.includes("BASELINE_FORBIDDEN") || msg.includes("Unauthorized")) return "forbidden";
  return "other";
}

function csvCell(v: unknown) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // keep spreadsheets from running it as a formula
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Same header names mapInventory reads, so an export can be corrected and re-imported. */
function toCsv(items: BaselineItem[]) {
  const cols: [string, (i: BaselineItem) => unknown][] = [
    ["id", (i) => i.externalId],
    ["date_start", (i) => i.dateNote ?? i.dateStart],
    ["date_end", (i) => i.dateEnd],
    ["title", (i) => i.title],
    ["topic_area", (i) => i.topicArea],
    ["swing_role", (i) => i.swingRole],
    ["organiser", (i) => i.organiser],
    ["audience", (i) => i.audience],
    ["format", (i) => i.format],
    ["status", (i) => i.status],
    ["artifacts", (i) => i.artifacts],
    ["groups", (i) => i.sourceGroup],
    ["confidence", (i) => i.confidence],
    ["verified", (i) => (i.verified ? "true" : "false")],
    ["evidence", (i) => i.evidence],
    ["knowledge_level", (i) => i.knowledgeLevel],
    ["source", (i) => i.source],
    ["item_type", (i) => i.itemType],
    ["language", (i) => i.language],
    [
      "has_action_items",
      (i) => (i.hasActionItems == null ? "" : i.hasActionItems ? "true" : "false"),
    ],
    ["sensitivity", (i) => i.sensitivity],
    ["sensitivity_note", (i) => i.sensitivityNote],
    ["linked_item", (i) => i.linkedItem],
    ["sample_set", (i) => i.sampleSet],
    ["source_url", (i) => i.sourceUrl],
    ["content_chars", (i) => i.contentChars],
    ["content_md", (i) => i.contentMd],
  ];
  const lines = [
    cols.map(([c]) => c).join(","),
    ...items.map((i) => cols.map(([, f]) => csvCell(f(i))).join(",")),
  ];
  return "\uFEFF" + lines.join("\r\n");
}

function monthLabel(ym: string, lang: string) {
  const [y, m] = ym.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, 1));
  const locale = lang === "th" ? "th-TH" : "en-GB";
  return {
    month: new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(date),
    // Two-digit year: Buddhist era in Thai (2026 -> 69), Common Era in English (26)
    year: String((lang === "th" ? y + 543 : y) % 100).padStart(2, "0"),
  };
}

/** Every month between the first and last, including empty ones, so gaps are visible. */
function fillMonths(counts: [string, number][]): [string, number][] {
  if (!counts.length) return [];
  const map = new Map(counts);
  const keys = [...map.keys()].sort();
  const [y0, m0] = keys[0].split("-").map(Number);
  const [y1, m1] = keys[keys.length - 1].split("-").map(Number);
  const span = (y1 - y0) * 12 + (m1 - m0);
  if (span > 36) return keys.map((k) => [k, map.get(k)!]); // too long: show only months with data
  const out: [string, number][] = [];
  for (let i = 0; i <= span; i++) {
    const y = y0 + Math.floor((m0 - 1 + i) / 12);
    const m = ((m0 - 1 + i) % 12) + 1;
    const k = `${y}-${String(m).padStart(2, "0")}`;
    out.push([k, map.get(k) ?? 0]);
  }
  return out;
}

function BaselinePage() {
  const list = useServerFn(listBaselineItems);
  const query = useQuery({ queryKey: ["baseline-items"], queryFn: () => list(), retry: false });
  return (
    <BaselineView
      items={query.data?.items}
      access={query.data?.access}
      isLoading={query.isLoading}
      isFetching={query.isFetching}
      error={query.error}
      onRefresh={() => query.refetch()}
    />
  );
}

/** Presentational part, kept separate from data loading. */
export function BaselineView({
  items: loaded,
  access,
  isLoading,
  isFetching,
  error,
  onRefresh,
}: {
  items: BaselineItem[] | undefined;
  access: BaselineAccess | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  onRefresh: () => void;
}) {
  const { t, lang } = useLanguage();
  const items = useMemo(() => loaded ?? [], [loaded]);

  const [happenedOnly, setHappenedOnly] = useState(true);
  // Default to the LINE export window used for the Round 0 inventory; clear to see everything.
  const [from, setFrom] = useState("2026-03-04");
  const [to, setTo] = useState("2026-10-11");
  const [includeUndated, setIncludeUndated] = useState(false);
  const [q, setQ] = useState("");
  const query = useDeferredValue(q);
  const [level, setLevel] = useState<KnowledgeLevel | "">("");
  const [role, setRole] = useState("");
  const [type, setType] = useState("");
  // Sources count different units (events vs documents), so the page looks at one at a time.
  const [source, setSource] = useState<Source | "">("line_chat");
  const sourceCounts = useMemo(() => new Map(countBy(items, (i) => i.source)), [items]);
  const activeSource = source && sourceCounts.has(source) ? source : "";
  const [open, setOpen] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE_ROWS);
  const [importOpen, setImportOpen] = useState(false);

  const ranged = !!(from || to);
  const lo = from && to && from > to ? to : from;
  const hi = from && to && from > to ? from : to;
  const scoped = useMemo(
    () =>
      items.filter((i) => {
        if (activeSource && i.source !== activeSource) return false;
        if (happenedOnly && i.status !== "happened") return false;
        if (!ranged) return true;
        if (!i.dateStart) return includeUndated;
        const end = i.dateEnd ?? i.dateStart;
        return (!lo || end >= lo) && (!hi || i.dateStart <= hi);
      }),
    [items, activeSource, happenedOnly, ranged, lo, hi, includeUndated],
  );
  const undatedOut = useMemo(
    () =>
      ranged && !includeUndated
        ? items.filter(
            (i) =>
              (!activeSource || i.source === activeSource) &&
              !i.dateStart &&
              (!happenedOnly || i.status === "happened"),
          ).length
        : 0,
    [items, activeSource, ranged, includeUndated, happenedOnly],
  );

  const haystacks = useMemo(
    () =>
      new Map(
        items.map((i) => [
          i.id,
          [i.title, i.topicArea, i.organiser, i.externalId].filter(Boolean).join(" ").toLowerCase(),
        ]),
      ),
    [items],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return scoped.filter(
      (i) =>
        (!level || i.knowledgeLevel === level) &&
        (!role || (role === NONE ? !i.swingRole : i.swingRole === role)) &&
        (!type || (type === NONE ? !i.itemType : i.itemType === type)) &&
        (!needle || haystacks.get(i.id)!.includes(needle)),
    );
  }, [scoped, query, level, role, type, haystacks]);

  const total = scoped.length;
  const levelCounts = useMemo(() => new Map(countBy(scoped, (i) => i.knowledgeLevel)), [scoped]);
  const written = LEVELS.filter((l) => l.written).reduce(
    (n, l) => n + (levelCounts.get(l.id) ?? 0),
    0,
  );
  const thin =
    (levelCounts.get("admin_only") ?? 0) +
    (levelCounts.get("photos_or_links") ?? 0) +
    (levelCounts.get("none") ?? 0) +
    (levelCounts.get("deleted") ?? 0);
  const byRole = useMemo(() => countBy(scoped, (i) => i.swingRole), [scoped]);
  const byTopic = useMemo(() => countBy(scoped, (i) => i.topicArea).slice(0, 10), [scoped]);
  const byType = useMemo(() => countBy(scoped, (i) => i.itemType), [scoped]);
  const showType = scoped.some((i) => i.itemType);
  const byMonth = useMemo(
    () =>
      fillMonths(
        countBy(
          scoped.filter((i) => i.dateStart),
          (i) => i.dateStart!.slice(0, 7),
        ),
      ),
    [scoped],
  );
  const maxMonth = Math.max(1, ...byMonth.map(([, n]) => n));

  const kind = errorKind(error);
  const canWrite = !!access?.canWrite;
  const filtersActive = !!(q || level || role || type);

  const exportCsv = () => {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `baseline_round0_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const clearFilters = () => {
    setQ("");
    setLevel("");
    setRole("");
    setType("");
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-navy-900">
            <FlaskConical className="h-6 w-6 text-accuracy" aria-hidden />
            {t({ th: "Baseline (รอบ 0)", en: "Baseline (Round 0)" })}
          </h1>
          <p lang={lang} className="mt-1 max-w-2xl text-sm text-warm-600">
            {t({
              th: "ความรู้ที่มีอยู่แล้วก่อนเริ่ม CVSK: กิจกรรมการเรียนรู้ที่เกิดขึ้น และสิ่งที่เหลืออยู่ให้หยิบมาใช้ซ้ำได้",
              en: "What already exists before CVSK: learning events that happened, and what is left that can be reused.",
            })}
          </p>
        </div>
        {kind !== "forbidden" && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onRefresh}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-warm-300 bg-white px-3 text-sm font-medium text-navy-900 hover:bg-warm-50"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden />
              {t({ th: "รีเฟรช", en: "Refresh" })}
            </button>
            <button
              onClick={exportCsv}
              disabled={!filtered.length}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-warm-300 bg-white px-3 text-sm font-medium text-navy-900 hover:bg-warm-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden />
              {t({ th: `ส่งออก CSV (${filtered.length})`, en: `Export CSV (${filtered.length})` })}
            </button>
            {canWrite && (
              <button
                onClick={() => setImportOpen(true)}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-navy-500 px-4 text-sm font-semibold text-white hover:bg-navy-700"
              >
                <Upload className="h-4 w-4" aria-hidden />
                {t({ th: "นำเข้า CSV", en: "Import CSV" })}
              </button>
            )}
          </div>
        )}
      </header>

      {kind === "forbidden" && (
        <div className="rounded-lg border border-warm-200 bg-white px-6 py-12 text-center">
          <Lock className="mx-auto h-8 w-8 text-warm-500" aria-hidden />
          <p lang={lang} className="mt-3 text-sm text-navy-500">
            {t({
              th: "หน้านี้เปิดได้เฉพาะผู้ดูแลระบบและทีมวิจัย (researcher, data steward) ถ้าต้องการสิทธิ์ ติดต่อผู้ดูแลระบบ",
              en: "Only admins and the research team (researcher, data steward) can open this page. Ask an admin for access.",
            })}
          </p>
        </div>
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
                  th: "ยังไม่มีตาราง baseline_items ในฐานข้อมูล ให้สั่ง Lovable รัน migration 20261012090000_baseline_items.sql ก่อน",
                  en: "The baseline_items table does not exist yet. Ask Lovable to run migration 20261012090000_baseline_items.sql.",
                })
              : t({
                  th: "โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชอีกครั้ง",
                  en: "Could not load. Refresh to try again.",
                })}
          </p>
        </div>
      )}

      {isLoading && (
        <p role="status" aria-busy="true" className="text-sm text-warm-600">
          {t({ th: "กำลังโหลด...", en: "Loading..." })}
        </p>
      )}

      {!kind && !isLoading && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-warm-300 bg-white px-6 py-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-warm-400" aria-hidden />
          <p lang={lang} className="mt-3 text-sm text-warm-600">
            {t({
              th: "ยังไม่มีรายการ นำเข้าไฟล์ Baseline_training_inventory_LINE.csv เพื่อเริ่ม",
              en: "No items yet. Import Baseline_training_inventory_LINE.csv to start.",
            })}
          </p>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div
            role="group"
            aria-label={t({ th: "แหล่งข้อมูล", en: "Source" })}
            className="flex flex-wrap gap-2"
          >
            {[...BASELINE_SOURCES.filter((s) => sourceCounts.has(s)), "" as const].map((s) => (
              <button
                key={s || "all"}
                onClick={() => {
                  setSource(s);
                  setShown(PAGE_ROWS);
                  setType("");
                }}
                aria-pressed={activeSource === s}
                className={`inline-flex min-h-10 items-center gap-2 rounded-pill border px-4 text-sm font-medium transition-colors ${
                  activeSource === s
                    ? "border-navy-500 bg-navy-500 text-white"
                    : "border-warm-300 bg-white text-navy-500 hover:bg-warm-50"
                }`}
              >
                {s ? t(SOURCE_LABEL[s]) : t({ th: "ทุกแหล่งรวมกัน", en: "All sources" })}
                <span className={activeSource === s ? "text-white/80" : "text-warm-600"}>
                  {s ? sourceCounts.get(s) : items.length}
                </span>
              </button>
            ))}
          </div>
          {!activeSource && sourceCounts.size > 1 && (
            <p lang={lang} className="text-xs text-warm-600">
              {t({
                th: "หมายเหตุ: แต่ละแหล่งนับคนละหน่วย (กิจกรรมจาก LINE กับเอกสารสรุปจาก AI) และบางเรื่องอยู่ทั้งสองแหล่ง ผลรวมจึงนับซ้ำได้",
                en: "Note: sources count different units (LINE events vs AI summary documents) and some events appear in both, so totals can double count.",
              })}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-warm-200 bg-white px-4 py-3 text-sm text-navy-500">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={happenedOnly}
                onChange={(e) => setHappenedOnly(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-accuracy)]"
              />
              {t({ th: "นับเฉพาะกิจกรรมที่จัดแล้ว", en: "Only events that happened" })}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <span>{t({ th: "ช่วงวันที่", en: "Date range" })}</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                aria-label={t({ th: "ตั้งแต่วันที่", en: "From" })}
                className="h-9 rounded-md border border-warm-300 px-2"
              />
              <span aria-hidden>–</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                aria-label={t({ th: "ถึงวันที่", en: "To" })}
                className="h-9 rounded-md border border-warm-300 px-2"
              />
              {ranged && (
                <button
                  onClick={() => {
                    setFrom("");
                    setTo("");
                  }}
                  className="h-9 rounded-md px-2 text-accuracy-ink underline-offset-2 hover:underline"
                >
                  {t({ th: "ดูทุกช่วงเวลา", en: "All dates" })}
                </button>
              )}
            </div>
            {ranged && (
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeUndated}
                  onChange={(e) => setIncludeUndated(e.target.checked)}
                  className="h-4 w-4 accent-[var(--color-accuracy)]"
                />
                {t({ th: "รวมรายการที่ไม่ทราบวันที่", en: "Include undated items" })}
              </label>
            )}
            <span className="ml-auto text-warm-600" role="status">
              {t({
                th: `อยู่ในขอบเขต ${scoped.length} จาก ${items.length}${undatedOut ? ` · ไม่นับ ${undatedOut} รายการที่ไม่ทราบวันที่` : ""}`,
                en: `${scoped.length} of ${items.length} in scope${undatedOut ? ` · ${undatedOut} undated left out` : ""}`,
              })}
            </span>
          </div>

          {/* Headline numbers */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={t({ th: "กิจกรรมในขอบเขต", en: "Events in scope" })} value={total} />
            <Stat
              label={t({ th: "มีความรู้ที่เขียนไว้", en: "Written knowledge" })}
              value={written}
              note={`${pct(written, total)}%`}
              tone="text-accuracy-ink"
            />
            <Stat
              label={t({ th: "เหลือแค่ภาพ ธุรการ หรือไม่มี", en: "Photos, admin or nothing" })}
              value={thin}
              note={`${pct(thin, total)}%`}
              tone="text-dignity-ink"
            />
            <Stat
              label={t({ th: "SWING จัด สอน หรือจัดร่วม", en: "SWING delivered, spoke or co-ran" })}
              value={
                scoped.filter((i) =>
                  ["delivered_by_swing", "co_organised", "speaker_at_external"].includes(
                    i.swingRole ?? "",
                  ),
                ).length
              }
            />
          </div>

          {/* What knowledge survives */}
          <section className="rounded-lg border border-warm-200 bg-white p-5">
            <h2 className="text-base font-semibold text-navy-500">
              {t({ th: "ความรู้ที่เหลืออยู่ให้ใช้ซ้ำ", en: "What knowledge survives" })}
            </h2>
            <div
              className="mt-4 flex h-4 w-full overflow-hidden rounded-pill border border-warm-300 bg-warm-100"
              aria-hidden
            >
              {LEVELS.map((l) => {
                const n = levelCounts.get(l.id) ?? 0;
                return n ? (
                  <span
                    key={l.id}
                    className={`${l.bar} border-r border-white last:border-r-0`}
                    style={{ width: `${pct(n, total)}%` }}
                  />
                ) : null;
              })}
            </div>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {LEVELS.filter((l) => levelCounts.get(l.id)).map((l) => (
                <li key={l.id}>
                  <button
                    onClick={() => setLevel(level === l.id ? "" : l.id)}
                    aria-pressed={level === l.id}
                    className={`flex min-h-11 w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      level === l.id
                        ? "border-navy-500 bg-navy-100/40"
                        : "border-warm-200 hover:bg-warm-50"
                    }`}
                  >
                    <span
                      className={`h-3 w-3 shrink-0 rounded-sm border border-warm-500 ${l.bar}`}
                      aria-hidden
                    />
                    <span lang={lang} className="flex-1 text-navy-500">
                      {t(l.label)}
                    </span>
                    <span className="font-semibold text-navy-500">{levelCounts.get(l.id)}</span>
                    <span className="w-12 text-right text-xs text-warm-600">
                      {pct(levelCounts.get(l.id) ?? 0, total)}%
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p lang={lang} className="mt-3 text-xs text-warm-600">
              {t({
                th: "นับระดับที่ดีที่สุดของแต่ละกิจกรรม ไฟล์ที่เคยแชร์ในแชตไม่ได้แปลว่าวันนี้ยังเปิดได้ ตัวเลขนี้จึงเป็นค่าสูงสุดที่เป็นไปได้",
                en: "Each event counts at its best level. A file once shared in chat may no longer open today, so these are upper bounds.",
              })}
            </p>
          </section>

          {/* Breakdowns */}
          <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
            {showType ? (
              <Breakdown
                title={t({ th: "ประเภท", en: "Type" })}
                rows={byType.map(([k, n]) => [k, TYPE_LABEL[k] ? t(TYPE_LABEL[k]) : k, n])}
                total={total}
                active={type}
                onPick={(k) => setType(type === k ? "" : k)}
              />
            ) : (
              <Breakdown
                title={t({ th: "บทบาทของ SWING", en: "SWING's role" })}
                rows={byRole.map(([k, n]) => [k, ROLE_LABEL[k] ? t(ROLE_LABEL[k]) : k, n])}
                total={total}
                active={role}
                onPick={(k) => setRole(role === k ? "" : k)}
              />
            )}
            <Breakdown
              title={t({ th: "หัวข้อ (10 อันดับแรก)", en: "Topics (top 10)" })}
              rows={byTopic.map(([k, n]) => [k, k === NONE ? t(ROLE_LABEL[NONE]) : k, n])}
              total={total}
            />
            <section className="rounded-lg border border-warm-200 bg-white p-5">
              <h2 className="text-base font-semibold text-navy-500">
                {t({ th: "รายเดือน", en: "By month" })}
              </h2>
              {byMonth.length === 0 ? (
                <p className="mt-4 text-sm text-warm-600">
                  {t({
                    th: "ไม่มีรายการที่มีวันที่ในช่วงนี้",
                    en: "No dated events in this range",
                  })}
                </p>
              ) : (
                <ol
                  className="mt-4 flex h-44 items-end gap-1.5 overflow-x-auto overflow-y-hidden pt-2"
                  aria-label={t({ th: "จำนวนกิจกรรมรายเดือน", en: "Events per month" })}
                >
                  {byMonth.map(([m, n]) => (
                    <li key={m} className="flex min-w-8 flex-1 flex-col items-center gap-1">
                      <span className="text-xs font-semibold text-navy-500">{n}</span>
                      <span
                        className="w-full rounded-t-sm bg-accuracy/70"
                        style={{ height: `${(n / maxMonth) * 88}px` }}
                        aria-hidden
                      />
                      <span className="text-center text-xs leading-tight whitespace-nowrap text-warm-600">
                        {monthLabel(m, lang).month}
                        <br />
                        {monthLabel(m, lang).year}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          {/* Filters + table */}
          <section className="rounded-lg border border-warm-200 bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-warm-200 p-3">
              <label className="relative min-w-56 flex-1">
                <span className="sr-only">{t({ th: "ค้นหา", en: "Search" })}</span>
                <Search
                  className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-warm-400"
                  aria-hidden
                />
                <input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setShown(PAGE_ROWS);
                  }}
                  placeholder={t({
                    th: "ค้นหาชื่อ หัวข้อ ผู้จัด",
                    en: "Search title, topic, organiser",
                  })}
                  className="h-10 w-full rounded-md border border-warm-300 pr-3 pl-9 text-sm"
                />
              </label>
              <Select
                label={t({ th: "ระดับความรู้", en: "Knowledge level" })}
                value={level}
                onChange={(v) => setLevel(v as KnowledgeLevel | "")}
                options={LEVELS.map((l) => [l.id, t(l.label)])}
              />
              <Select
                label={t({ th: "บทบาท", en: "Role" })}
                value={role}
                onChange={setRole}
                options={Object.entries(ROLE_LABEL).map(([k, v]) => [k, t(v)])}
              />
              {showType && (
                <Select
                  label={t({ th: "ประเภท", en: "Type" })}
                  value={type}
                  onChange={setType}
                  options={byType.map(([k]) => [k, TYPE_LABEL[k] ? t(TYPE_LABEL[k]) : k])}
                />
              )}
              <span className="ml-auto text-sm text-warm-600" role="status">
                {t({ th: `${filtered.length} รายการ`, en: `${filtered.length} items` })}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-warm-50 text-left text-xs text-warm-600">
                  <tr>
                    <th className="w-8 px-3 py-2">
                      <span className="sr-only">{t({ th: "รายละเอียด", en: "Details" })}</span>
                    </th>
                    <th className="px-3 py-2 font-semibold">{t({ th: "วันที่", en: "Date" })}</th>
                    <th className="px-3 py-2 font-semibold">{t({ th: "กิจกรรม", en: "Event" })}</th>
                    <th className="px-3 py-2 font-semibold">{t({ th: "บทบาท", en: "Role" })}</th>
                    <th className="px-3 py-2 font-semibold">
                      {t({ th: "ความรู้ที่เหลือ", en: "Knowledge" })}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-warm-600">
                        {t({
                          th: "ไม่มีรายการที่ตรงกับตัวกรอง",
                          en: "No items match these filters",
                        })}
                        {filtersActive && (
                          <button
                            onClick={clearFilters}
                            className="ml-2 font-semibold text-accuracy-ink underline-offset-2 hover:underline"
                          >
                            {t({ th: "ล้างตัวกรอง", en: "Clear filters" })}
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                  {filtered.slice(0, shown).map((i) => (
                    <ItemRow
                      key={i.id}
                      item={i}
                      isOpen={open === i.id}
                      onToggle={() => setOpen(open === i.id ? null : i.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length > shown && (
              <div className="border-t border-warm-200 p-3 text-center">
                <button
                  onClick={() => setShown((n) => n + PAGE_ROWS)}
                  className="h-10 rounded-md border border-warm-300 bg-white px-4 text-sm font-medium text-navy-500 hover:bg-warm-50"
                >
                  {t({
                    th: `แสดงเพิ่ม (เหลืออีก ${filtered.length - shown})`,
                    en: `Show more (${filtered.length - shown} left)`,
                  })}
                </button>
              </div>
            )}
          </section>
        </>
      )}

      {canWrite && (
        <ImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          canReplace={!!access?.canDelete}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  tone = "text-navy-500",
}: {
  label: string;
  value: number;
  note?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-warm-200 bg-white p-4">
      <p className="text-xs text-warm-600">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${tone}`}>
        {value}
        {note && <span className="ml-2 text-base font-medium text-warm-600">{note}</span>}
      </p>
    </div>
  );
}

function Breakdown({
  title,
  rows,
  total,
  onPick,
  active,
}: {
  title: string;
  rows: [string, string, number][];
  total: number;
  onPick?: (key: string) => void;
  active?: string;
}) {
  return (
    <section className="rounded-lg border border-warm-200 bg-white p-5">
      <h2 className="text-base font-semibold text-navy-500">{title}</h2>
      <ul className="mt-3 space-y-1.5">
        {rows.map(([key, label, n]) => {
          const inner = (
            <>
              <span className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-navy-500">{label}</span>
                <span className="shrink-0 font-semibold text-navy-500">{n}</span>
              </span>
              <span className="mt-1 block h-1.5 rounded-pill bg-warm-100" aria-hidden>
                <span
                  className="block h-full rounded-pill bg-navy-300"
                  style={{ width: `${pct(n, total)}%` }}
                />
              </span>
            </>
          );
          return (
            <li key={key}>
              {onPick ? (
                <button
                  onClick={() => onPick(key)}
                  aria-pressed={active === key}
                  className={`block w-full rounded-md px-2 py-1.5 text-left ${active === key ? "bg-navy-100/50" : "hover:bg-warm-50"}`}
                >
                  {inner}
                </button>
              ) : (
                <div className="px-2 py-1.5">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  const { t } = useLanguage();
  return (
    <label className="text-sm">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-md border border-warm-300 bg-white px-2 text-sm text-navy-500"
      >
        <option value="">
          {label}: {t({ th: "ทั้งหมด", en: "All" })}
        </option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function ItemRow({
  item: i,
  isOpen,
  onToggle,
}: {
  item: BaselineItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { t, lang } = useLanguage();
  const level = LEVEL[i.knowledgeLevel] ?? LEVEL.unknown;
  const role = i.swingRole ? ROLE_LABEL[i.swingRole] : ROLE_LABEL[NONE];
  const status = i.status ? STATUS_LABEL[i.status] : undefined;
  const confidence = i.confidence ? CONFIDENCE_LABEL[i.confidence] : undefined;
  const approx = !!(i.dateNote && i.dateStart);
  const detailsId = `baseline-details-${i.id}`;
  return (
    <>
      <tr className="border-t border-warm-100 align-top hover:bg-warm-50/60">
        <td className="px-3 py-2">
          <button
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-controls={detailsId}
            aria-label={`${t({ th: "ดูรายละเอียด", en: "Show details" })}: ${i.title}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-warm-600 hover:bg-warm-100"
          >
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-warm-600">
          {i.dateStart ? (
            <span title={i.dateNote ?? undefined}>
              {approx ? "≈ " : ""}
              {approx ? i.dateStart.slice(0, 7) : i.dateStart}
            </span>
          ) : (
            t({ th: "ไม่ทราบ", en: "Unknown" })
          )}
        </td>
        <td className="px-3 py-2">
          <span lang={hasThai(i.title) ? "th" : "en"} className="font-medium text-navy-500">
            {i.title}
          </span>
          <span className="mt-0.5 block text-xs text-warm-600">
            {[
              i.externalId,
              i.itemType && TYPE_LABEL[i.itemType] ? t(TYPE_LABEL[i.itemType]) : null,
              i.topicArea,
              i.organiser,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          {(i.sampleSet ||
            (i.sensitivity && i.sensitivity !== "none" && i.sensitivity !== "staff_names")) && (
            <span className="mt-1 flex flex-wrap gap-1.5">
              {i.sampleSet && (
                <span className="rounded-pill bg-accuracy-soft px-2 py-0.5 text-xs font-medium text-accuracy-ink">
                  {t({ th: "อยู่ในตัวอย่าง 30 ชิ้น", en: "In the sample of 30" })}
                </span>
              )}
              {i.sensitivity && i.sensitivity !== "none" && i.sensitivity !== "staff_names" && (
                <span className="rounded-pill bg-dignity-soft px-2 py-0.5 text-xs font-medium text-dignity-ink">
                  {t(SENSITIVITY_LABEL[i.sensitivity])}
                </span>
              )}
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-warm-600">{role ? t(role) : i.swingRole}</td>
        <td className="px-3 py-2">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span
              className={`h-2.5 w-2.5 rounded-sm border border-warm-500 ${level.bar}`}
              aria-hidden
            />
            <span lang={lang} className="text-navy-500">
              {t(level.label)}
            </span>
          </span>
        </td>
      </tr>
      {isOpen && (
        <tr id={detailsId} className="bg-warm-50/60">
          <td />
          <td colSpan={4} className="px-3 pb-3 text-xs text-warm-700">
            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[max-content_1fr]">
              <dt className="font-semibold">{t({ th: "วันที่", en: "Date" })}</dt>
              <dd>
                {[i.dateStart, i.dateEnd && i.dateEnd !== i.dateStart ? i.dateEnd : null]
                  .filter(Boolean)
                  .join(" – ") || "-"}
                {i.dateNote ? ` (${i.dateNote})` : ""}
              </dd>
              <dt className="font-semibold">{t({ th: "สถานะ", en: "Status" })}</dt>
              <dd>{status ? t(status) : (i.status ?? "-")}</dd>
              <dt className="font-semibold">{t({ th: "ผู้เข้าร่วม", en: "Audience" })}</dt>
              <dd>{i.audience ?? "-"}</dd>
              <dt className="font-semibold">{t({ th: "รูปแบบ", en: "Format" })}</dt>
              <dd>{i.format ?? "-"}</dd>
              <dt className="font-semibold">{t({ th: "สิ่งที่แชร์ไว้", en: "Artifacts" })}</dt>
              <dd>{i.artifacts ?? "-"}</dd>
              <dt className="font-semibold">{t({ th: "หลักฐาน", en: "Evidence" })}</dt>
              <dd className="break-all">{i.evidence ?? "-"}</dd>
              {i.itemType && (
                <>
                  <dt className="font-semibold">{t({ th: "ประเภท", en: "Type" })}</dt>
                  <dd>{TYPE_LABEL[i.itemType] ? t(TYPE_LABEL[i.itemType]) : i.itemType}</dd>
                </>
              )}
              {i.linkedItem && (
                <>
                  <dt className="font-semibold">
                    {t({ th: "เรื่องเดียวกับ", en: "Same event as" })}
                  </dt>
                  <dd>{i.linkedItem}</dd>
                </>
              )}
              {i.sensitivity && (
                <>
                  <dt className="font-semibold">{t({ th: "ข้อมูลอ่อนไหว", en: "Sensitivity" })}</dt>
                  <dd>
                    {SENSITIVITY_LABEL[i.sensitivity]
                      ? t(SENSITIVITY_LABEL[i.sensitivity])
                      : i.sensitivity}
                    {i.sensitivityNote ? ` · ${i.sensitivityNote}` : ""}
                  </dd>
                </>
              )}
              {i.hasActionItems != null && (
                <>
                  <dt className="font-semibold">
                    {t({ th: "มีสิ่งที่ต้องทำต่อ", en: "Action items" })}
                  </dt>
                  <dd>
                    {i.hasActionItems ? t({ th: "มี", en: "Yes" }) : t({ th: "ไม่มี", en: "No" })}
                  </dd>
                </>
              )}
              {i.sourceUrl && (
                <>
                  <dt className="font-semibold">{t({ th: "ต้นฉบับ", en: "Original" })}</dt>
                  <dd>
                    <a
                      href={i.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-accuracy-ink underline underline-offset-2"
                    >
                      {t({ th: "เปิดใน Notion", en: "Open in Notion" })}
                    </a>
                  </dd>
                </>
              )}
              <dt className="font-semibold">{t({ th: "ความเชื่อมั่น", en: "Confidence" })}</dt>
              <dd>
                {confidence ? t(confidence) : (i.confidence ?? "-")}
                {i.verified
                  ? ` · ${t({ th: "ตรวจกับต้นฉบับแล้ว", en: "verified against source" })}`
                  : ""}
              </dd>
            </dl>
            {i.contentMd && (
              <div className="mt-3">
                <p className="font-semibold">
                  {t({ th: "เนื้อหาสรุป", en: "Summary content" })}
                  {i.contentChars
                    ? ` · ${i.contentChars.toLocaleString()} ${t({ th: "ตัวอักษร", en: "characters" })}`
                    : ""}
                </p>
                <div
                  lang={hasThai(i.contentMd) ? "th" : "en"}
                  className="mt-1 max-h-96 overflow-auto rounded-md border border-warm-200 bg-white p-3 text-sm leading-relaxed whitespace-pre-wrap text-navy-500"
                >
                  {i.contentMd}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

type Checked = ParsedInventory & { invalid: { line: number; problem: string }[]; garbled: boolean };

function ImportDialog({
  open,
  onOpenChange,
  canReplace,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  canReplace: boolean;
}) {
  const { t, lang } = useLanguage();
  const qc = useQueryClient();
  const importFn = useServerFn(importBaselineItems);
  const [source, setSource] = useState<Source>("line_chat");
  const [fileName, setFileName] = useState<string | null>(null);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [replace, setReplace] = useState(false);
  const readToken = useRef(0);

  const reset = () => {
    readToken.current++;
    setFileName(null);
    setChecked(null);
    setReplace(false);
  };

  const run = useMutation({
    mutationFn: async () => {
      if (!checked?.rows.length) throw new Error("no rows");
      return importFn({ data: { source, fileName, replace, rows: checked.rows } });
    },
    onSuccess: (res) => {
      const extra =
        res.removed > 0
          ? t({ th: ` · ลบรายการเก่า ${res.removed}`, en: ` · removed ${res.removed} old` })
          : res.stale > 0
            ? t({
                th: ` · มีรายการเดิม ${res.stale} รายการที่ไม่อยู่ในไฟล์นี้`,
                en: ` · ${res.stale} existing items are not in this file`,
              })
            : "";
      toast.success(
        t({ th: `นำเข้าแล้ว ${res.saved} รายการ`, en: `Imported ${res.saved} items` }) + extra,
      );
      reset();
      onOpenChange(false);
    },
    onError: (err) => {
      const kind = errorKind(err);
      console.error("[baseline import]", err);
      toast.error(
        kind === "missing"
          ? t({
              th: "ยังไม่ได้รัน migration baseline_items",
              en: "baseline_items migration not applied yet",
            })
          : kind === "forbidden"
            ? t({
                th: "บัญชีนี้ไม่มีสิทธิ์นำเข้าหรือลบ",
                en: "This account cannot import or delete",
              })
            : t({
                th: "นำเข้าไม่สำเร็จ ข้อมูลเดิมยังอยู่ครบ ลองใหม่อีกครั้ง",
                en: "Import failed. Existing data is unchanged. Try again.",
              }),
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["baseline-items"] }),
  });

  const close = () => {
    if (run.isPending) return;
    reset();
    onOpenChange(false);
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const token = ++readToken.current;
    if (!file) {
      setFileName(null);
      setChecked(null);
      return;
    }
    try {
      const text = await file.text();
      if (token !== readToken.current) return; // a newer file was picked meanwhile
      const parsed = mapInventory(parseCsv(text));
      const invalid: Checked["invalid"] = [];
      parsed.rows.forEach((r, idx) => {
        const res = ImportRow.safeParse(r);
        if (!res.success) {
          invalid.push({
            line: idx + 2,
            problem: res.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; "),
          });
        }
      });
      setFileName(file.name);
      setChecked({ ...parsed, invalid, garbled: text.includes("\uFFFD") });
    } catch (err) {
      console.error(err);
      toast.error(t({ th: "อ่านไฟล์ไม่ได้", en: "Could not read the file" }));
      setChecked(null);
    }
  };

  const levels = checked ? countBy(checked.rows, (r) => r.knowledgeLevel) : [];
  const blocked =
    !checked ||
    !checked.rows.length ||
    checked.missingColumns.length > 0 ||
    checked.invalid.length > 0 ||
    checked.garbled ||
    checked.rows.length > 1000;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent
        className="max-w-lg"
        onEscapeKeyDown={(e) => run.isPending && e.preventDefault()}
        onInteractOutside={(e) => run.isPending && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {t({ th: "นำเข้ารายการ Baseline", en: "Import baseline items" })}
          </DialogTitle>
          <DialogDescription lang={lang}>
            {t({
              th: "รองรับไฟล์ CSV (UTF-8) แบบ Baseline_training_inventory_LINE.csv รายการที่ id ซ้ำกับของเดิมจะถูกอัปเดต ไม่สร้างซ้ำ",
              en: "Accepts CSV (UTF-8) like Baseline_training_inventory_LINE.csv. Rows whose id already exists are updated, not duplicated.",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-navy-500">
              {t({ th: "แหล่งที่มา", en: "Source" })}
            </span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as Source)}
              className="h-10 w-full rounded-md border border-warm-300 bg-white px-2"
            >
              {BASELINE_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {t(SOURCE_LABEL[s])}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-navy-500">
              {t({ th: "ไฟล์ CSV", en: "CSV file" })}
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={onFile}
              className="block w-full text-sm"
            />
          </label>

          {checked && (
            <div
              className="space-y-2 rounded-md border border-warm-200 bg-warm-50 p-3 text-sm"
              role="status"
            >
              {checked.missingColumns.length > 0 ? (
                <p className="text-dignity-ink">
                  {t({ th: "ไม่พบคอลัมน์ที่จำเป็น: ", en: "Missing required columns: " })}
                  {checked.missingColumns.join(", ")}
                </p>
              ) : checked.garbled ? (
                <p lang={lang} className="text-dignity-ink">
                  {t({
                    th: "ภาษาไทยในไฟล์อ่านไม่ออก ให้บันทึกไฟล์ใหม่เป็น “CSV UTF-8” แล้วเลือกอีกครั้ง",
                    en: "Thai text in this file is unreadable. Save it again as “CSV UTF-8” and pick it again.",
                  })}
                </p>
              ) : (
                <>
                  <p className="font-medium text-navy-500">
                    {t({
                      th: `พร้อมนำเข้า ${checked.rows.length} รายการ`,
                      en: `${checked.rows.length} rows ready`,
                    })}
                    {checked.skipped.length > 0 &&
                      t({
                        th: ` · ข้าม ${checked.skipped.length} แถว`,
                        en: ` · ${checked.skipped.length} skipped`,
                      })}
                  </p>
                  {checked.rows.length > 1000 && (
                    <p className="text-dignity-ink">
                      {t({
                        th: "นำเข้าได้ครั้งละไม่เกิน 1,000 รายการ",
                        en: "At most 1,000 rows per import",
                      })}
                    </p>
                  )}
                  <ul className="list-disc pl-5 text-xs text-warm-700">
                    {checked.rows.slice(0, 3).map((r) => (
                      <li key={r.externalId}>
                        {r.externalId} · {r.title}
                      </li>
                    ))}
                  </ul>
                  <ul className="grid grid-cols-2 gap-x-4 text-xs text-warm-700">
                    {levels.map(([k, n]) => (
                      <li key={k}>
                        {LEVEL[k as KnowledgeLevel] ? t(LEVEL[k as KnowledgeLevel].label) : k}: {n}
                      </li>
                    ))}
                  </ul>
                  {checked.skipped.length > 0 && (
                    <p className="text-xs text-warm-700">
                      {t({ th: "แถวที่ข้าม: ", en: "Skipped lines: " })}
                      {checked.skipped
                        .slice(0, 10)
                        .map((s) => `${s.line} (${s.reason})`)
                        .join(", ")}
                    </p>
                  )}
                  {checked.invalid.length > 0 && (
                    <p className="text-xs text-dignity-ink">
                      {t({
                        th: "แก้แถวเหล่านี้ก่อนนำเข้า: ",
                        en: "Fix these lines before importing: ",
                      })}
                      {checked.invalid
                        .slice(0, 10)
                        .map((s) => `${s.line} (${s.problem})`)
                        .join(", ")}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {canReplace && (
            <label className="flex items-start gap-2 text-sm text-navy-500">
              <input
                type="checkbox"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span lang={lang}>
                {t({
                  th: "ลบรายการเดิมของแหล่งนี้ที่ไม่อยู่ในไฟล์ (ทำหลังนำเข้าสำเร็จเท่านั้น)",
                  en: "Remove existing items of this source that are not in the file (only after a successful import)",
                })}
              </span>
            </label>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={close}
            disabled={run.isPending}
            className="h-10 rounded-md border border-warm-300 bg-white px-4 text-sm font-medium text-navy-500 disabled:opacity-50"
          >
            {t({ th: "ยกเลิก", en: "Cancel" })}
          </button>
          <button
            onClick={() => {
              if (
                replace &&
                !window.confirm(
                  t({
                    th: "นำเข้าแล้วลบรายการเดิมของแหล่งนี้ที่ไม่อยู่ในไฟล์?",
                    en: "Import, then remove existing items of this source that are not in the file?",
                  }),
                )
              )
                return;
              run.mutate();
            }}
            disabled={blocked || run.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-navy-500 px-4 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" aria-hidden />
            {run.isPending
              ? t({ th: "กำลังนำเข้า...", en: "Importing..." })
              : t({ th: "นำเข้า", en: "Import" })}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
