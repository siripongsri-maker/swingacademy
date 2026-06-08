import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useEffect } from "react";
import { z } from "zod";
import {
  Search,
  Plus,
  X,
  Sparkles,
  Save,
  Send,
  Trash2,
  FileText,
  Image as ImageIcon,
  Video,
  Presentation,
  Loader2,
  ArrowLeft,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import {
  useProductKnowledge,
  type KnowledgeAsset,
  type KnowledgeTranslation,
  type Language,
  type TranslationStatus,
  type Attachment,
} from "@/lib/product-knowledge-store";
import { translateKnowledge } from "@/lib/knowledge-ai.functions";

const searchSchema = z.object({
  from: z.string().optional(),
  edit: z.string().optional(),
});

export const Route = createFileRoute("/staff/knowledge-translation")({
  validateSearch: (s) => searchSchema.parse(s),
  component: KnowledgeTranslationPage,
});

const STATUS_STYLES: Record<TranslationStatus, string> = {
  draft: "bg-warm-200 text-warm-700",
  ready: "bg-gold/15 text-gold",
  published: "bg-success/15 text-success",
};
const STATUS_LABEL: Record<TranslationStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  published: "Published",
};
const ATTACHMENT_ICON: Record<Attachment["kind"], React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  slides: Presentation,
  image: ImageIcon,
  video_url: Video,
  audio: Video,
};

function KnowledgeTranslationPage() {
  const pk = useProductKnowledge();
  const { from, edit } = Route.useSearch();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [sourceAsset, setSourceAsset] = useState<KnowledgeAsset | null>(null);
  const [editingTr, setEditingTr] = useState<KnowledgeTranslation | null>(null);

  // Auto-open editor when `from` or `edit` is present in URL
  useEffect(() => {
    if (from) {
      const a = pk.getAsset(from);
      if (a) {
        setSourceAsset(a);
        setEditingTr(null);
        setEditorOpen(true);
      } else {
        toast.error("ไม่พบ source asset");
      }
      // Clear the param so re-renders don't re-open
      navigate({ to: "/staff/knowledge-translation", search: {}, replace: true });
    } else if (edit) {
      const t = pk.getTranslation(edit);
      if (t) {
        const a = pk.getAsset(t.assetId);
        setSourceAsset(a ?? null);
        setEditingTr(t);
        setEditorOpen(true);
      }
      navigate({ to: "/staff/knowledge-translation", search: {}, replace: true });
    }
  }, [from, edit, pk, navigate]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return pk.translations.filter((t) => {
      if (!needle) return true;
      const asset = pk.getAsset(t.assetId);
      return (
        t.instruction.toLowerCase().includes(needle) ||
        t.outputMd.toLowerCase().includes(needle) ||
        t.audience.toLowerCase().includes(needle) ||
        t.format.toLowerCase().includes(needle) ||
        (asset?.titleEn ?? "").toLowerCase().includes(needle) ||
        (asset?.titleTh ?? "").toLowerCase().includes(needle)
      );
    });
  }, [pk, q]);

  function openNew() {
    setSourceAsset(null);
    setEditingTr(null);
    setEditorOpen(true);
  }

  function handleDelete(t: KnowledgeTranslation) {
    if (!confirm("Delete this translation?")) return;
    pk.removeTranslation(t.id);
    toast.success("Deleted");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Knowledge Translation</h1>
          <p className="text-sm text-muted-foreground">
            แปลงความรู้ในคลังให้เหมาะกับกลุ่มเป้าหมาย รูปแบบ และโทนภาษา
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-md bg-magenta-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-magenta-600"
        >
          <Plus className="h-4 w-4" /> New translation
        </button>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาตาม instruction, audience, format, ต้นทาง…"
          className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          ยังไม่มี translation — กด "Translate" จาก{" "}
          <Link to="/staff/product-knowledge" className="font-semibold text-magenta-700 hover:underline">
            Product Knowledge
          </Link>{" "}
          เพื่อเริ่ม
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((t) => {
            const src = pk.getAsset(t.assetId);
            return (
              <li
                key={t.id}
                className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[t.status]}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
                  <span className="rounded-full bg-warm-100 px-2 py-0.5 text-[11px] font-medium text-warm-700">
                    {pk.audiences.find((a) => a.id === t.audience)?.en ?? t.audience}
                  </span>
                  <span className="rounded-full bg-magenta-50 px-2 py-0.5 text-[11px] text-magenta-700">
                    {pk.formats.find((f) => f.id === t.format)?.en ?? t.format}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  From: <span className="font-medium text-foreground">{src?.titleEn ?? "—"}</span>
                </div>
                <p className="line-clamp-3 text-sm text-foreground/80">
                  {t.outputMd || t.instruction || "(empty)"}
                </p>
                <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
                  <span>Updated {new Date(t.updatedAt).toLocaleDateString()}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setSourceAsset(src ?? null);
                        setEditingTr(t);
                        setEditorOpen(true);
                      }}
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-warm-50"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => handleDelete(t)}
                      className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-destructive hover:bg-destructive/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editorOpen && (
        <TranslationEditor
          source={sourceAsset}
          translation={editingTr}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </div>
  );
}

/* =============================== Editor =============================== */

type EditorForm = {
  assetId: string;
  audience: string;
  format: string;
  tone: string;
  language: Language;
  instruction: string;
  outputMd: string;
  status: TranslationStatus;
  attachments: Attachment[];
};

function buildPrefillFromAsset(a: KnowledgeAsset): EditorForm {
  return {
    assetId: a.id,
    audience: a.audiences[0] ?? "general_public",
    format: "short_article",
    tone: "friendly",
    language: a.language,
    instruction: `แปลงเนื้อหา "${a.titleTh || a.titleEn}" สำหรับกลุ่มเป้าหมายที่เลือก โดยเน้น key message: ${a.keyMessage}`,
    outputMd: "",
    status: "draft",
    attachments: a.attachments,
  };
}

function TranslationEditor({
  source,
  translation,
  onClose,
}: {
  source: KnowledgeAsset | null;
  translation: KnowledgeTranslation | null;
  onClose: () => void;
}) {
  const pk = useProductKnowledge();
  const aiTranslate = useServerFn(translateKnowledge);
  const [generating, setGenerating] = useState(false);
  const [picking, setPicking] = useState(!source && !translation);
  const [currentSource, setCurrentSource] = useState<KnowledgeAsset | null>(source);

  const [form, setForm] = useState<EditorForm>(() => {
    if (translation) {
      const src = pk.getAsset(translation.assetId);
      return {
        assetId: translation.assetId,
        audience: translation.audience,
        format: translation.format,
        tone: translation.tone,
        language: translation.language,
        instruction: translation.instruction,
        outputMd: translation.outputMd,
        status: translation.status,
        attachments: src?.attachments ?? [],
      };
    }
    if (source) return buildPrefillFromAsset(source);
    return {
      assetId: "",
      audience: "general_public",
      format: "short_article",
      tone: "friendly",
      language: "th",
      instruction: "",
      outputMd: "",
      status: "draft",
      attachments: [],
    };
  });

  function update<K extends keyof EditorForm>(key: K, value: EditorForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function pickSource(a: KnowledgeAsset) {
    setCurrentSource(a);
    setForm(buildPrefillFromAsset(a));
    setPicking(false);
  }

  async function generate() {
    if (!currentSource) {
      toast.error("เลือก source asset ก่อน");
      return;
    }
    if (!form.instruction.trim()) {
      toast.error("กรุณาใส่ instruction");
      return;
    }
    setGenerating(true);
    try {
      const res = await aiTranslate({
        data: {
          assetContent: currentSource.contentMd,
          audience: pk.audiences.find((a) => a.id === form.audience)?.en ?? form.audience,
          format: pk.formats.find((f) => f.id === form.format)?.en ?? form.format,
          tone: pk.tones.find((t) => t.id === form.tone)?.en ?? form.tone,
          language: form.language,
          instruction: form.instruction,
        },
      });
      update("outputMd", res.outputMd);
      toast.success("สร้างผลลัพธ์เรียบร้อย");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI error");
    } finally {
      setGenerating(false);
    }
  }

  function save(targetStatus?: TranslationStatus) {
    if (!form.assetId) {
      toast.error("เลือก source asset ก่อน");
      return;
    }
    const payload = {
      assetId: form.assetId,
      audience: form.audience,
      format: form.format,
      tone: form.tone,
      language: form.language,
      instruction: form.instruction,
      outputMd: form.outputMd,
      status: targetStatus ?? form.status,
      ownerId: "current-user",
    };
    if (translation) {
      pk.updateTranslation(translation.id, payload);
      toast.success("Saved");
    } else {
      pk.createTranslation(payload);
      toast.success(targetStatus === "published" ? "Published" : "Draft saved");
    }
    onClose();
  }

  if (picking) {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-900/50 p-4 backdrop-blur-sm">
        <div className="my-8 w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-lg font-semibold">Choose source asset</h2>
            <button onClick={onClose} className="rounded-md p-1.5 hover:bg-warm-50">
              <X className="h-4 w-4" />
            </button>
          </header>
          <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
            {pk.assets.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => pickSource(a)}
                  className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-warm-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{a.titleEn}</p>
                    <p lang="th" className="text-sm text-muted-foreground">{a.titleTh}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{a.keyMessage}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-warm-100 px-2 py-0.5 text-[11px] text-warm-700">
                    {a.attachments.length} files
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-900/50 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-4xl rounded-lg border border-border bg-card shadow-xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPicking(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-warm-50 hover:text-foreground"
              title="Change source"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-semibold">
              {translation ? "Edit translation" : "New translation"}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-warm-50">
            <X className="h-4 w-4" />
          </button>
        </header>

        {currentSource && (
          <div className="border-b border-border bg-warm-50/50 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Source asset</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{currentSource.titleEn}</p>
            <p lang="th" className="text-xs text-muted-foreground">{currentSource.titleTh}</p>
            {form.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Paperclip className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">
                  {form.attachments.length} source files carried over:
                </span>
                {form.attachments.map((att) => {
                  const Icon = ATTACHMENT_ICON[att.kind];
                  return (
                    <a
                      key={att.id}
                      href={att.externalUrl ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-[200px] items-center gap-1 truncate rounded bg-white px-1.5 py-0.5 text-[11px] text-foreground ring-1 ring-border hover:bg-warm-100"
                    >
                      <Icon className="h-3 w-3 shrink-0 text-magenta-500" />
                      <span className="truncate">{att.title}</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 px-5 py-4 md:grid-cols-4">
          <Field label="Audience">
            <select
              value={form.audience}
              onChange={(e) => update("audience", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {pk.audiences.map((a) => (
                <option key={a.id} value={a.id}>{a.en}</option>
              ))}
            </select>
          </Field>
          <Field label="Format">
            <select
              value={form.format}
              onChange={(e) => update("format", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {pk.formats.map((f) => (
                <option key={f.id} value={f.id}>{f.en}</option>
              ))}
            </select>
          </Field>
          <Field label="Tone">
            <select
              value={form.tone}
              onChange={(e) => update("tone", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {pk.tones.map((t) => (
                <option key={t.id} value={t.id}>{t.en}</option>
              ))}
            </select>
          </Field>
          <Field label="Language">
            <select
              value={form.language}
              onChange={(e) => update("language", e.target.value as Language)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="th">ไทย</option>
              <option value="en">English</option>
              <option value="bilingual">Bilingual</option>
            </select>
          </Field>

          <Field label="Instruction" className="md:col-span-4">
            <textarea
              value={form.instruction}
              onChange={(e) => update("instruction", e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="บอก AI ว่าต้องการสไตล์ใด เน้นจุดไหน"
            />
          </Field>

          <div className="md:col-span-4">
            <button
              onClick={generate}
              disabled={generating || !currentSource}
              className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-magenta-500 to-magenta-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "กำลังสร้าง…" : "Generate with AI"}
            </button>
          </div>

          <Field label="Output (Markdown)" className="md:col-span-4">
            <textarea
              value={form.outputMd}
              onChange={(e) => update("outputMd", e.target.value)}
              rows={12}
              className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
              placeholder="ผลลัพธ์จะถูกใส่ที่นี่ หรือพิมพ์เองได้"
            />
          </Field>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-warm-50"
          >
            Cancel
          </button>
          <button
            onClick={() => save("draft")}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-warm-50"
          >
            <Save className="h-4 w-4" /> Save draft
          </button>
          <button
            onClick={() => save("published")}
            className="inline-flex items-center gap-1.5 rounded-md bg-magenta-500 px-4 py-2 text-sm font-semibold text-white hover:bg-magenta-600"
          >
            <Send className="h-4 w-4" /> Publish
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
