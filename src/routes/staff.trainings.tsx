import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Plus, MapPin, Users, Tag, X, Upload, Trash2,
  Globe, Lock, Eye, EyeOff, Languages, FileText, Image as ImageIcon, Loader2, CheckCircle2, BookOpen,
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import {
  listTrainings, getTraining, upsertTraining, deleteTraining,
  createUploadUrl, recordAttachment, setAttachmentPublic, deleteAttachment, signAttachmentUrl,
} from "@/lib/trainings.functions";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/staff/trainings")({
  head: () => pageHead({
    title: "Training history – Staff Console",
    description: "Record SWING trainings, workshops, meetings, and conferences. Upload photos and presentations, then publish translated knowledge products.",
    path: "/staff/trainings",
    noindex: true,
  }),
  component: TrainingsPage,
});

type Training = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  topics: string | null;
  visit_type: string | null;
  sites: string | null;
  location: string | null;
  notes: string | null;
  meeting_notes: string | null;
  participants: string | null;
  outcomes: string | null;
  source: string | null;
  published: boolean;
  public_title_en: string | null;
  public_title_th: string | null;
  public_summary_en: string | null;
  public_summary_th: string | null;
  cover_attachment_id: string | null;
  created_at: string;
  updated_at: string;
};

type Attachment = {
  id: string;
  training_id: string;
  kind: string;
  label: string | null;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  is_public: boolean;
  created_at: string;
};

const tx = {
  title: { en: "Training history", th: "ประวัติการอบรม" },
  sub: {
    en: "Workshops, conferences and meetings logged by SWING. Record details, attach photos and slides, then translate and publish as a public knowledge product.",
    th: "บันทึกการอบรม การประชุม และการสัมมนาของ SWING แนบรูปและสไลด์ จากนั้นแปลและเผยแพร่เป็นผลิตภัณฑ์ความรู้สาธารณะ",
  },
  search: { en: "Search topic, site, location…", th: "ค้นหาหัวข้อ พื้นที่ สถานที่…" },
  all: { en: "All", th: "ทั้งหมด" },
  published: { en: "Published", th: "เผยแพร่แล้ว" },
  drafts: { en: "Internal only", th: "ภายในเท่านั้น" },
  newRecord: { en: "New record", th: "บันทึกใหม่" },
  showing: { en: "Showing", th: "แสดง" },
  of: { en: "of", th: "จาก" },
  empty: { en: "No trainings match your filters.", th: "ไม่พบรายการที่ตรงกับตัวกรอง" },
  emptyAll: {
    en: "No training records yet. Record your first workshop, meeting, or conference to start building your knowledge history.",
    th: "ยังไม่มีรายการอบรม บันทึกการอบรม ประชุม หรือสัมมนาครั้งแรกเพื่อเริ่มสร้างประวัติความรู้",
  },
};

function TrainingsPage() {
  const { lang, t } = useLanguage();
  const qc = useQueryClient();
  const listFn = useServerFn(listTrainings);
  const { data, isLoading } = useQuery({
    queryKey: ["trainings"],
    queryFn: () => listFn({ data: {} }),
  });
  const rows = (data?.rows ?? []) as Training[];

  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "published" | "draft">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === "published" && !r.published) return false;
      if (tab === "draft" && r.published) return false;
      if (!n) return true;
      return [r.topics, r.visit_type, r.sites, r.location, r.public_title_en, r.public_title_th]
        .filter(Boolean).some((s) => String(s).toLowerCase().includes(n));
    });
  }, [rows, q, tab]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-warm-500">Training history</p>
          <h1 className="mt-1 text-3xl font-semibold text-navy-500">{t(tx.title)}</h1>
          <p className="mt-1 max-w-3xl text-sm text-warm-500" style={{ lineHeight: lang === "th" ? 1.75 : 1.5 }}>
            {t(tx.sub)}
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-pill bg-magenta-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-magenta-600 focus:outline-none focus:ring-2 focus:ring-magenta-500 focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" /> {t(tx.newRecord)}
        </button>
      </div>

      <div className="space-y-3 rounded-lg border border-warm-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t(tx.search)}
            className="w-full rounded-pill border border-warm-200 bg-warm-50 py-2.5 pl-10 pr-4 text-sm text-navy-500 placeholder:text-warm-400 focus:border-magenta-500 focus:bg-white focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            ["all", t(tx.all)],
            ["published", t(tx.published)],
            ["draft", t(tx.drafts)],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-pill px-3 py-1 text-xs font-semibold transition ${
                tab === k ? "bg-navy-500 text-white" : "bg-warm-100 text-warm-600 hover:bg-warm-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-warm-500">
        {t(tx.showing)} <span className="font-semibold text-navy-500">{filtered.length}</span> {t(tx.of)} {rows.length}
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-warm-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-warm-200 bg-white p-12 text-center">
          <p className="text-sm font-semibold text-navy-500">{t(tx.empty)}</p>
        </div>
      ) : (
        <ul className="divide-y divide-warm-200 overflow-hidden rounded-lg border border-warm-200 bg-white shadow-sm">
          {filtered.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => setOpenId(r.id)}
                className="flex w-full items-start gap-4 px-4 py-3 text-left transition hover:bg-warm-50 focus:bg-warm-50 focus:outline-none"
              >
                <div className="mt-0.5 flex w-32 shrink-0 flex-col text-xs text-warm-500">
                  <span className="font-mono font-semibold text-navy-500">
                    {formatDate(r.start_date)}
                  </span>
                  {r.end_date && r.end_date !== r.start_date && (
                    <span className="text-[10px]">→ {formatDate(r.end_date)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {r.visit_type && (
                      <span className="rounded-pill bg-navy-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy-500">
                        {r.visit_type}
                      </span>
                    )}
                    {r.published ? (
                      <span className="inline-flex items-center gap-1 rounded-pill bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                        <Globe className="h-3 w-3" /> {t(tx.published)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-pill bg-warm-100 px-2 py-0.5 text-[10px] font-semibold text-warm-600">
                        <Lock className="h-3 w-3" /> {t(tx.drafts)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-navy-500 whitespace-pre-line">
                    {r.topics || "(no topic)"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-warm-500">
                    {r.location && (<span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{r.location}</span>)}
                    {r.sites && (<span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{r.sites}</span>)}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {(openId || creating) && (
        <TrainingDrawer
          id={openId}
          isNew={creating}
          onClose={() => { setOpenId(null); setCreating(false); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["trainings"] }); }}
        />
      )}
    </div>
  );
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function TrainingDrawer({ id, isNew, onClose, onSaved }: { id: string | null; isNew: boolean; onClose: () => void; onSaved: () => void }) {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const getFn = useServerFn(getTraining);
  const upsertFn = useServerFn(upsertTraining);
  const delFn = useServerFn(deleteTraining);
  const uploadFn = useServerFn(createUploadUrl);
  const recordFn = useServerFn(recordAttachment);
  const setPubFn = useServerFn(setAttachmentPublic);
  const delAttFn = useServerFn(deleteAttachment);
  const signFn = useServerFn(signAttachmentUrl);

  const [tab, setTab] = useState<"record" | "attachments" | "translate">("record");
  const [form, setForm] = useState<Partial<Training>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["training", id],
    queryFn: () => id ? getFn({ data: { id } }) : Promise.resolve({ training: null, attachments: [] }),
    enabled: !!id,
  });

  useEffect(() => {
    if (isNew) {
      setForm({ visit_type: "Workshop", published: false });
    } else if (data?.training) {
      setForm(data.training as Training);
    }
  }, [isNew, data?.training, id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const attachments = (data?.attachments ?? []) as Attachment[];

  const save = async (overrides: Partial<Training> = {}) => {
    setSaving(true);
    try {
      const payload = { ...form, ...overrides } as any;
      const res = await upsertFn({ data: payload });
      setForm(res.training as Training);
      setSavedAt(Date.now());
      onSaved();
      if (isNew && res.training?.id) {
        qc.invalidateQueries({ queryKey: ["training", res.training.id] });
      } else if (res.training?.id) {
        qc.invalidateQueries({ queryKey: ["training", res.training.id] });
      }
      return res.training;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!form.id) return;
    if (!confirm("Delete this training record? This cannot be undone.")) return;
    await delFn({ data: { id: form.id } });
    onSaved();
    onClose();
  };

  const handlePublishToggle = async () => {
    await save({ published: !form.published });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    let tid = form.id;
    if (!tid) {
      const t = await save();
      tid = t?.id;
    }
    if (!tid) return;
    for (const file of Array.from(files)) {
      const { signedUrl, path } = await uploadFn({ data: { trainingId: tid, filename: file.name } });
      const up = await fetch(signedUrl, { method: "PUT", body: file, headers: { "content-type": file.type || "application/octet-stream" } });
      if (!up.ok) { alert(`Upload failed: ${file.name}`); continue; }
      await recordFn({ data: {
        training_id: tid,
        storage_path: path,
        label: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        kind: file.type.startsWith("image/") ? "photo" : "file",
        is_public: false,
      }});
    }
    qc.invalidateQueries({ queryKey: ["training", tid] });
  };

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Training details">
      <button aria-label="Close" onClick={onClose} className="flex-1 bg-navy-900/40 backdrop-blur-sm" />
      <div ref={dialogRef} className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-warm-200 px-6 py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-warm-500">
              {isNew ? "New training" : form.visit_type || "Training"}
            </p>
            <h2 className="mt-0.5 truncate text-lg font-semibold text-navy-500">
              {form.public_title_en || form.public_title_th || (form.topics?.split("\n")[0]?.replace(/^[-•]\s*/, "") || "Untitled training")}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {savedAt && Date.now() - savedAt < 2500 && (
              <span className="inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Saved</span>
            )}
            <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-warm-500 hover:bg-warm-100 hover:text-navy-500">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex gap-1 border-b border-warm-200 px-4">
          {([
            ["record", "Record", FileText],
            ["attachments", `Photos & Slides${attachments.length ? ` (${attachments.length})` : ""}`, ImageIcon],
            ["translate", "Translate & Publish", Languages],
          ] as const).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition ${
                tab === k ? "border-magenta-500 text-magenta-600" : "border-transparent text-warm-500 hover:text-navy-500"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading && !isNew ? (
            <div className="flex items-center justify-center py-12 text-warm-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : tab === "record" ? (
            <RecordForm form={form} setForm={setForm} />
          ) : tab === "attachments" ? (
            <AttachmentsTab
              trainingId={form.id}
              attachments={attachments}
              onUpload={handleFiles}
              onTogglePublic={async (a) => { await setPubFn({ data: { id: a.id, is_public: !a.is_public } }); qc.invalidateQueries({ queryKey: ["training", form.id] }); }}
              onDelete={async (a) => { if (!confirm("Delete this file?")) return; await delAttFn({ data: { id: a.id } }); qc.invalidateQueries({ queryKey: ["training", form.id] }); }}
              onPreview={async (a) => { const { url } = await signFn({ data: { path: a.storage_path } }); window.open(url, "_blank", "noopener,noreferrer"); }}
            />
          ) : (
            <TranslateTab form={form} setForm={setForm} attachments={attachments} />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-warm-200 bg-warm-50 px-6 py-3">
          <div className="flex items-center gap-2">
            {!isNew && (
              <button onClick={handleDelete} className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-xs font-semibold text-error hover:bg-error/10">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isNew && form.id && (
              <button
                onClick={handlePublishToggle}
                disabled={saving}
                className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-2 text-xs font-semibold transition ${
                  form.published ? "bg-warm-200 text-navy-500 hover:bg-warm-300" : "bg-success text-white hover:bg-success/90"
                }`}
              >
                {form.published ? <><EyeOff className="h-3.5 w-3.5" /> Unpublish</> : <><Eye className="h-3.5 w-3.5" /> Publish public version</>}
              </button>
            )}
            <button
              onClick={() => save()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-pill bg-magenta-500 px-4 py-2 text-xs font-semibold text-white hover:bg-magenta-600 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isNew ? "Create record" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-navy-500">{label}</span>
      {hint && <span className="ml-2 text-[10px] text-warm-500">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls = "w-full rounded-md border border-warm-200 bg-white px-3 py-2 text-sm text-navy-500 placeholder:text-warm-400 focus:border-magenta-500 focus:outline-none focus:ring-1 focus:ring-magenta-500";

function RecordForm({ form, setForm }: { form: Partial<Training>; setForm: (f: Partial<Training>) => void }) {
  const set = (k: keyof Training, v: any) => setForm({ ...form, [k]: v });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Start date"><input type="date" className={inputCls} value={form.start_date ?? ""} onChange={(e) => set("start_date", e.target.value || null)} /></Field>
        <Field label="End date"><input type="date" className={inputCls} value={form.end_date ?? ""} onChange={(e) => set("end_date", e.target.value || null)} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type" hint="Workshop, Meeting, Conference, Site Visit…">
          <input className={inputCls} value={form.visit_type ?? ""} onChange={(e) => set("visit_type", e.target.value)} placeholder="Workshop" />
        </Field>
        <Field label="Location"><input className={inputCls} value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} placeholder="Bangkok" /></Field>
      </div>
      <Field label="Sites / Partners">
        <input className={inputCls} value={form.sites ?? ""} onChange={(e) => set("sites", e.target.value)} placeholder="SWING BKK, All Partner…" />
      </Field>
      <Field label="Topics" hint="What was covered">
        <textarea rows={5} className={inputCls} value={form.topics ?? ""} onChange={(e) => set("topics", e.target.value)} />
      </Field>
      <Field label="Participants" hint="Who attended">
        <textarea rows={2} className={inputCls} value={form.participants ?? ""} onChange={(e) => set("participants", e.target.value)} />
      </Field>
      <Field label="Meeting / training notes">
        <textarea rows={5} className={inputCls} value={form.meeting_notes ?? ""} onChange={(e) => set("meeting_notes", e.target.value)} placeholder="Key discussion points, decisions, action items…" />
      </Field>
      <Field label="Outcomes & next steps">
        <textarea rows={3} className={inputCls} value={form.outcomes ?? ""} onChange={(e) => set("outcomes", e.target.value)} />
      </Field>
      <Field label="Internal notes" hint="Not shown publicly">
        <textarea rows={2} className={inputCls} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
      </Field>
    </div>
  );
}

function AttachmentsTab({ trainingId, attachments, onUpload, onTogglePublic, onDelete, onPreview }: {
  trainingId: string | undefined;
  attachments: Attachment[];
  onUpload: (f: FileList | null) => void;
  onTogglePublic: (a: Attachment) => void;
  onDelete: (a: Attachment) => void;
  onPreview: (a: Attachment) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); onUpload(e.dataTransfer.files); }}
        className="rounded-lg border-2 border-dashed border-warm-200 bg-warm-50 p-6 text-center"
      >
        <Upload className="mx-auto h-6 w-6 text-warm-400" />
        <p className="mt-2 text-sm font-semibold text-navy-500">Drop photos, slides, PDFs here</p>
        <p className="mt-1 text-xs text-warm-500">or</p>
        <button
          onClick={() => fileRef.current?.click()}
          className="mt-2 inline-flex items-center gap-1 rounded-pill bg-navy-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-600"
        >
          <Upload className="h-3.5 w-3.5" /> Choose files
        </button>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => onUpload(e.target.files)} />
        {!trainingId && (
          <p className="mt-2 text-[11px] text-warm-500">Record will be created automatically on first upload.</p>
        )}
      </div>

      {attachments.length === 0 ? (
        <p className="text-xs text-warm-500">No files yet.</p>
      ) : (
        <ul className="divide-y divide-warm-200 overflow-hidden rounded-md border border-warm-200">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 p-3">
              <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-navy-50 text-navy-500">
                {a.kind === "photo" ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-navy-500">{a.label || a.storage_path.split("/").pop()}</p>
                <p className="text-[11px] text-warm-500">
                  {a.mime_type || "file"}{a.size_bytes ? ` • ${Math.round(a.size_bytes / 1024)} KB` : ""}
                </p>
              </div>
              <button onClick={() => onPreview(a)} className="rounded-md px-2 py-1 text-xs font-semibold text-navy-500 hover:bg-warm-100">View</button>
              <button
                onClick={() => onTogglePublic(a)}
                className={`inline-flex items-center gap-1 rounded-pill px-2 py-1 text-[10px] font-semibold ${
                  a.is_public ? "bg-success/15 text-success" : "bg-warm-100 text-warm-600"
                }`}
                aria-label={a.is_public ? "Make private" : "Make public"}
              >
                {a.is_public ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                {a.is_public ? "Public" : "Private"}
              </button>
              <button onClick={() => onDelete(a)} aria-label="Delete file" className="rounded-md p-1.5 text-warm-500 hover:bg-error/10 hover:text-error">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TranslateTab({ form, setForm, attachments }: { form: Partial<Training>; setForm: (f: Partial<Training>) => void; attachments: Attachment[] }) {
  const set = (k: keyof Training, v: any) => setForm({ ...form, [k]: v });
  return (
    <div className="space-y-5">
      <div className="rounded-md border border-navy-100 bg-navy-50/40 p-3">
        <p className="text-xs font-semibold text-navy-500">From internal record</p>
        <p className="mt-1 whitespace-pre-line text-xs text-warm-600">{form.topics || "(empty)"}</p>
        {form.outcomes && <p className="mt-2 text-xs text-warm-500"><Tag className="mr-1 inline h-3 w-3" />{form.outcomes}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Public title (EN)">
          <input className={inputCls} value={form.public_title_en ?? ""} onChange={(e) => set("public_title_en", e.target.value)} placeholder="e.g. M&E Workshop on PrEP Indicators" />
        </Field>
        <Field label="หัวข้อสาธารณะ (TH)">
          <input className={inputCls} value={form.public_title_th ?? ""} onChange={(e) => set("public_title_th", e.target.value)} placeholder="เช่น การอบรม M&E เรื่องตัวชี้วัด PrEP" />
        </Field>
        <Field label="Public summary (EN)">
          <textarea rows={4} className={inputCls} value={form.public_summary_en ?? ""} onChange={(e) => set("public_summary_en", e.target.value)} placeholder="What other organizations can learn from this training…" />
        </Field>
        <Field label="สรุปสาธารณะ (TH)">
          <textarea rows={4} className={inputCls} value={form.public_summary_th ?? ""} onChange={(e) => set("public_summary_th", e.target.value)} placeholder="สิ่งที่องค์กรอื่นเรียนรู้ได้จากการอบรมนี้…" />
        </Field>
      </div>

      {attachments.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-navy-500">Public attachments</p>
          <p className="mt-0.5 text-[11px] text-warm-500">Only files marked Public on the Photos & Slides tab will appear with the published knowledge product.</p>
          <ul className="mt-2 space-y-1 text-xs">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-warm-600">
                {a.is_public ? <Globe className="h-3 w-3 text-success" /> : <Lock className="h-3 w-3 text-warm-400" />}
                <span className="truncate">{a.label || a.storage_path.split("/").pop()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-md border border-warm-200 bg-warm-50 p-3 text-xs text-warm-600">
        Use the <strong>Publish public version</strong> button below to make this training visible as a public knowledge product. Both EN and TH should be filled in before publishing.
      </div>
    </div>
  );
}
