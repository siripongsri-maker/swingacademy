import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useRef, type ChangeEvent } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  Video,
  Presentation,
  Link as LinkIcon,
  Archive,
  Send,
  RotateCcw,
  Save,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  useProductKnowledge,
  type KnowledgeAsset,
  type KnowledgeStatus,
  type KnowledgeType,
  type Language,
  type Attachment,
} from "@/lib/product-knowledge-store";

export const Route = createFileRoute("/staff/product-knowledge")({
  component: ProductKnowledgePage,
});

const STATUS_STYLES: Record<KnowledgeStatus, string> = {
  draft: "bg-warm-200 text-warm-700",
  published: "bg-success/15 text-success",
  archived: "bg-warm-100 text-warm-500",
};

const STATUS_LABEL: Record<KnowledgeStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

const ATTACHMENT_ICON: Record<Attachment["kind"], React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  slides: Presentation,
  image: ImageIcon,
  video_url: Video,
};

function ProductKnowledgePage() {
  const pk = useProductKnowledge();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<KnowledgeStatus | "all">("all");
  const [type, setType] = useState<KnowledgeType | "all">("all");
  const [editing, setEditing] = useState<KnowledgeAsset | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return pk.assets.filter((a) => {
      if (status !== "all" && a.status !== status) return false;
      if (type !== "all" && a.type !== type) return false;
      if (!needle) return true;
      return (
        a.titleTh.toLowerCase().includes(needle) ||
        a.titleEn.toLowerCase().includes(needle) ||
        a.keyMessage.toLowerCase().includes(needle) ||
        a.tags.some((t) => t.toLowerCase().includes(needle)) ||
        a.productService.toLowerCase().includes(needle)
      );
    });
  }, [pk.assets, q, status, type]);

  const counts = useMemo(() => {
    const c = { draft: 0, published: 0, archived: 0 };
    pk.assets.forEach((a) => (c[a.status] += 1));
    return c;
  }, [pk.assets]);

  function handleStatusChange(asset: KnowledgeAsset, next: KnowledgeStatus) {
    if (asset.status === next) return;
    pk.updateAsset(asset.id, { status: next }, `Status → ${STATUS_LABEL[next]}`);
    toast.success(`${asset.titleEn} → ${STATUS_LABEL[next]}`);
  }

  function handleDelete(asset: KnowledgeAsset) {
    if (!confirm(`Delete "${asset.titleEn}"? This cannot be undone.`)) return;
    pk.removeAsset(asset.id);
    toast.success("Deleted");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Product Knowledge</h1>
          <p className="text-sm text-muted-foreground">
            ศูนย์กลางบันทึก จัดเก็บ และจัดการความรู้ของ SWING Academy
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-md bg-magenta-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-magenta-600"
        >
          <Plus className="h-4 w-4" /> New asset
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {(["draft", "published", "archived"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(status === s ? "all" : s)}
            className={`rounded-lg border bg-card p-4 text-left transition-colors ${
              status === s ? "border-magenta-500 ring-1 ring-magenta-500/30" : "border-border hover:border-magenta-500/40"
            }`}
          >
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {STATUS_LABEL[s]}
            </div>
            <div className="mt-1 text-2xl font-bold text-foreground">{counts[s]}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหา title, key message, tag…"
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as KnowledgeType | "all")}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All types</option>
          {Object.entries(pk.typeLabels).map(([id, l]) => (
            <option key={id} value={id}>
              {l.en}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as KnowledgeStatus | "all")}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          ไม่พบ knowledge asset ที่ตรงกับเงื่อนไข
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[a.status]}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                    <span className="rounded-full bg-warm-100 px-2 py-0.5 text-[11px] font-medium text-warm-700">
                      {pk.typeLabels[a.type]?.en ?? a.type}
                    </span>
                    {a.categories.map((c) => (
                      <span key={c} className="rounded-full bg-magenta-50 px-2 py-0.5 text-[11px] text-magenta-700">
                        {pk.categoryLabels[c]?.en ?? c}
                      </span>
                    ))}
                  </div>
                  <h3 className="mt-2 truncate text-base font-semibold text-foreground">{a.titleEn}</h3>
                  <p lang="th" className="truncate text-sm text-muted-foreground">{a.titleTh}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-foreground/80">{a.keyMessage}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>v{a.versionHistory.at(-1)?.v ?? "1.0"}</span>
                    <span>•</span>
                    <span>{a.attachments.length} attachment{a.attachments.length !== 1 ? "s" : ""}</span>
                    <span>•</span>
                    <span>Updated {new Date(a.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  {a.status !== "published" && (
                    <button
                      onClick={() => handleStatusChange(a, "published")}
                      className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/10 px-2 py-1 text-xs font-medium text-success hover:bg-success/20"
                      title="Publish"
                    >
                      <Send className="h-3.5 w-3.5" /> Publish
                    </button>
                  )}
                  {a.status !== "draft" && (
                    <button
                      onClick={() => handleStatusChange(a, "draft")}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-warm-50"
                      title="Move to draft"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Draft
                    </button>
                  )}
                  {a.status !== "archived" && (
                    <button
                      onClick={() => handleStatusChange(a, "archived")}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-warm-50"
                      title="Archive"
                    >
                      <Archive className="h-3.5 w-3.5" /> Archive
                    </button>
                  )}
                  <Link
                    to="/staff/knowledge-translation"
                    search={{ from: a.id }}
                    className="inline-flex items-center gap-1 rounded-md border border-magenta-500/30 bg-magenta-50 px-2 py-1 text-xs font-semibold text-magenta-700 hover:bg-magenta-100"
                    title="Create translation draft from this asset"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Translate
                  </Link>
                  <button
                    onClick={() => setEditing(a)}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-warm-50"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(a)}
                    className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {a.attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                  {a.attachments.map((att) => {
                    const Icon = ATTACHMENT_ICON[att.kind];
                    return (
                      <a
                        key={att.id}
                        href={att.externalUrl ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-[260px] items-center gap-1.5 truncate rounded-md bg-warm-50 px-2 py-1 text-xs text-foreground hover:bg-warm-100"
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0 text-magenta-500" />
                        <span className="truncate">{att.title ?? att.externalUrl}</span>
                      </a>
                    );
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {(creating || editing) && (
        <AssetEditor
          asset={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/* ============================== Editor Modal ============================== */

type FormState = {
  titleTh: string;
  titleEn: string;
  type: KnowledgeType;
  categories: string[];
  productService: string;
  audiences: string[];
  keyMessage: string;
  contentMd: string;
  source: string;
  tags: string;
  language: Language;
  status: KnowledgeStatus;
  attachments: Attachment[];
};

function blankForm(): FormState {
  return {
    titleTh: "",
    titleEn: "",
    type: "curriculum",
    categories: [],
    productService: "",
    audiences: [],
    keyMessage: "",
    contentMd: "",
    source: "",
    tags: "",
    language: "th",
    status: "draft",
    attachments: [],
  };
}

function fromAsset(a: KnowledgeAsset): FormState {
  return {
    titleTh: a.titleTh,
    titleEn: a.titleEn,
    type: a.type,
    categories: a.categories,
    productService: a.productService,
    audiences: a.audiences,
    keyMessage: a.keyMessage,
    contentMd: a.contentMd,
    source: a.source,
    tags: a.tags.join(", "),
    language: a.language,
    status: a.status,
    attachments: a.attachments,
  };
}

function AssetEditor({ asset, onClose }: { asset: KnowledgeAsset | null; onClose: () => void }) {
  const pk = useProductKnowledge();
  const isEdit = !!asset;
  const [form, setForm] = useState<FormState>(() => (asset ? fromAsset(asset) : blankForm()));
  const fileInput = useRef<HTMLInputElement>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleArr(key: "categories" | "audiences", id: string) {
    setForm((f) => {
      const has = f[key].includes(id);
      return { ...f, [key]: has ? f[key].filter((x) => x !== id) : [...f[key], id] };
    });
  }

  function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const newAtts: Attachment[] = Array.from(files).map((file) => {
      const kind: Attachment["kind"] = file.type.startsWith("image/")
        ? "image"
        : file.type === "application/pdf"
        ? "pdf"
        : file.name.match(/\.(ppt|pptx|key)$/i)
        ? "slides"
        : "pdf";
      return {
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        kind,
        title: file.name,
        externalUrl: URL.createObjectURL(file),
      };
    });
    setForm((f) => ({ ...f, attachments: [...f.attachments, ...newAtts] }));
    if (fileInput.current) fileInput.current.value = "";
  }

  function addUrlAttachment() {
    const url = prompt("Paste a URL (PDF, slides, image, or video link):");
    if (!url) return;
    const title = prompt("Title?") ?? url;
    const kind: Attachment["kind"] = /\.pdf(\?|$)/i.test(url)
      ? "pdf"
      : /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url)
      ? "image"
      : /\.(ppt|pptx|key)(\?|$)/i.test(url)
      ? "slides"
      : "video_url";
    setForm((f) => ({
      ...f,
      attachments: [
        ...f.attachments,
        {
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          kind,
          title,
          externalUrl: url,
        },
      ],
    }));
  }

  function removeAttachment(id: string) {
    setForm((f) => ({ ...f, attachments: f.attachments.filter((a) => a.id !== id) }));
  }

  function validate(): string | null {
    if (!form.titleTh.trim() && !form.titleEn.trim()) return "ต้องมีชื่อ TH หรือ EN อย่างน้อยหนึ่งภาษา";
    if (!form.keyMessage.trim()) return "Key Message is required";
    if (!form.contentMd.trim()) return "Full content is required";
    return null;
  }

  function submit(targetStatus?: KnowledgeStatus) {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    const payload = {
      titleTh: form.titleTh || form.titleEn,
      titleEn: form.titleEn || form.titleTh,
      type: form.type,
      categories: form.categories,
      productService: form.productService,
      audiences: form.audiences,
      keyMessage: form.keyMessage,
      contentMd: form.contentMd,
      source: form.source,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      language: form.language,
      status: targetStatus ?? form.status,
      attachments: form.attachments,
      ownerId: "current-user",
    };

    if (isEdit && asset) {
      pk.updateAsset(asset.id, payload, "Edited");
      toast.success("Saved changes");
    } else {
      pk.createAsset(payload);
      toast.success(targetStatus === "published" ? "Published" : "Draft created");
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-900/50 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-3xl rounded-lg border border-border bg-card shadow-xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? "Edit knowledge asset" : "New knowledge asset"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-warm-50 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <Field label="Title (TH)">
            <input
              value={form.titleTh}
              onChange={(e) => update("titleTh", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="เช่น PrEP Starter Pack"
            />
          </Field>
          <Field label="Title (EN)">
            <input
              value={form.titleEn}
              onChange={(e) => update("titleEn", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="e.g. PrEP Starter Pack"
            />
          </Field>

          <Field label="Type">
            <select
              value={form.type}
              onChange={(e) => update("type", e.target.value as KnowledgeType)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {Object.entries(pk.typeLabels).map(([id, l]) => (
                <option key={id} value={id}>
                  {l.en}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Product / Service">
            <input
              value={form.productService}
              onChange={(e) => update("productService", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="e.g. PrEP service"
            />
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
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => update("status", e.target.value as KnowledgeStatus)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </Field>

          <Field label="Categories" className="sm:col-span-2">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(pk.categoryLabels).map(([id, l]) => {
                const on = form.categories.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleArr("categories", id)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      on
                        ? "border-magenta-500 bg-magenta-500 text-white"
                        : "border-border bg-background text-foreground hover:border-magenta-500/40"
                    }`}
                  >
                    {on && <CheckCircle2 className="mr-1 inline h-3 w-3" />}
                    {l.en}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Target audiences" className="sm:col-span-2">
            <div className="flex flex-wrap gap-1.5">
              {pk.audiences.map((a) => {
                const on = form.audiences.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleArr("audiences", a.id)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      on
                        ? "border-magenta-500 bg-magenta-500 text-white"
                        : "border-border bg-background text-foreground hover:border-magenta-500/40"
                    }`}
                  >
                    {a.en}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Key message" className="sm:col-span-2">
            <textarea
              value={form.keyMessage}
              onChange={(e) => update("keyMessage", e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="ข้อความหลักที่ต้องการสื่อ"
            />
          </Field>

          <Field label="Full content (Markdown)" className="sm:col-span-2">
            <textarea
              value={form.contentMd}
              onChange={(e) => update("contentMd", e.target.value)}
              rows={10}
              className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
              placeholder="# หัวข้อ\nเนื้อหา…"
            />
          </Field>

          <Field label="Source / Citation" className="sm:col-span-2">
            <input
              value={form.source}
              onChange={(e) => update("source", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="e.g. Thailand National AIDS Program Guidelines 2024"
            />
          </Field>

          <Field label="Tags (comma-separated)" className="sm:col-span-2">
            <input
              value={form.tags}
              onChange={(e) => update("tags", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="prep, hiv-prevention, biomedical"
            />
          </Field>

          <Field label="Attachments" className="sm:col-span-2">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-magenta-500/40 bg-magenta-50 px-3 py-1.5 text-xs font-medium text-magenta-700 hover:bg-magenta-100"
                >
                  <Upload className="h-3.5 w-3.5" /> Upload files
                </button>
                <button
                  type="button"
                  onClick={addUrlAttachment}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-warm-50"
                >
                  <LinkIcon className="h-3.5 w-3.5" /> Add URL
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  hidden
                  onChange={handleFiles}
                  accept=".pdf,.ppt,.pptx,image/*"
                />
              </div>
              {form.attachments.length > 0 && (
                <ul className="space-y-1.5">
                  {form.attachments.map((a) => {
                    const Icon = ATTACHMENT_ICON[a.kind];
                    return (
                      <li
                        key={a.id}
                        className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0 text-magenta-500" />
                        <span className="flex-1 truncate text-foreground">{a.title}</span>
                        <span className="rounded bg-warm-100 px-1.5 py-0.5 text-[10px] uppercase text-warm-700">
                          {a.kind}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(a.id)}
                          className="rounded p-1 text-muted-foreground hover:bg-warm-50 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Field>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-warm-50"
          >
            Cancel
          </button>
          <button
            onClick={() => submit("draft")}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-warm-50"
          >
            <Save className="h-4 w-4" /> Save draft
          </button>
          <button
            onClick={() => submit("published")}
            className="inline-flex items-center gap-1.5 rounded-md bg-magenta-500 px-4 py-2 text-sm font-semibold text-white hover:bg-magenta-600"
          >
            <Send className="h-4 w-4" /> {isEdit ? "Save & publish" : "Publish"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
