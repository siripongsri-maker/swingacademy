import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search, Eye, EyeOff, Globe, Lock, Star, StarOff, Trash2, Save, X, ExternalLink, RefreshCw, FileText,
  Paperclip, Upload, Download, History,
} from "lucide-react";
import {
  listAllKnowledge,
  upsertKnowledge,
  setKnowledgePublishState,
  setKnowledgeAttachments,
  deleteKnowledge,
  listKnowledgeActivity,
  type KnowledgeRow,
  type KnowledgeAttachment,
  type KnowledgeActivityLog,
} from "@/lib/knowledge.functions";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/lib/language-context";

export const Route = createFileRoute("/staff/knowledge-library")({
  component: KnowledgeLibraryPage,
});

const STATUS_STYLES: Record<KnowledgeRow["status"], string> = {
  draft: "bg-warm-200 text-warm-700",
  in_review: "bg-amber-100 text-amber-700",
  published: "bg-emerald-100 text-emerald-700",
};

function KnowledgeLibraryPage() {
  const { t } = useLanguage();
  const list = useServerFn(listAllKnowledge);
  const upsert = useServerFn(upsertKnowledge);
  const setState = useServerFn(setKnowledgePublishState);
  const del = useServerFn(deleteKnowledge);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["staff", "knowledge-library"],
    queryFn: () => list(),
  });

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | KnowledgeRow["status"]>("all");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | KnowledgeRow["visibility"]>("all");
  const [editing, setEditing] = useState<KnowledgeRow | null>(null);
  const [historyFor, setHistoryFor] = useState<KnowledgeRow | null>(null);

  const items = query.data?.items ?? [];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (visibilityFilter !== "all" && i.visibility !== visibilityFilter) return false;
      if (!needle) return true;
      return (
        i.titleTh.toLowerCase().includes(needle) ||
        (i.titleEn ?? "").toLowerCase().includes(needle) ||
        i.slug.toLowerCase().includes(needle) ||
        i.tags.some((t) => t.toLowerCase().includes(needle))
      );
    });
  }, [items, q, statusFilter, visibilityFilter]);

  type PatchData = { id: string; status?: KnowledgeRow["status"]; visibility?: KnowledgeRow["visibility"]; isFeatured?: boolean; featuredOrder?: number };
  async function patch(_row: KnowledgeRow, patchData: PatchData) {
    try {
      await setState({ data: patchData as never });
      toast.success(t({ th: "อัปเดตแล้ว", en: "Updated" }));
      qc.invalidateQueries({ queryKey: ["staff", "knowledge-library"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleDelete(row: KnowledgeRow) {
    if (!confirm(t({ th: `ลบ "${row.titleTh}"?`, en: `Delete "${row.titleTh}"?` }))) return;
    try {
      await del({ data: { id: row.id } });
      toast.success(t({ th: "ลบแล้ว", en: "Deleted" }));
      qc.invalidateQueries({ queryKey: ["staff", "knowledge-library"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const counts = useMemo(() => ({
    total: items.length,
    published: items.filter((i) => i.status === "published").length,
    public: items.filter((i) => i.visibility === "public" && i.status === "published").length,
    draft: items.filter((i) => i.status === "draft").length,
    featured: items.filter((i) => i.isFeatured).length,
  }), [items]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-warm-500">Knowledge Library · Database</p>
          <h1 className="mt-1 text-3xl font-semibold text-navy-500">{t({ th: "คลังความรู้ (ฐานข้อมูล)", en: "Knowledge Library" })}</h1>
          <p className="mt-1 text-sm text-warm-500">
            {t({
              th: "แก้ไข เผยแพร่/ซ่อน ตั้งเป็นรายการแนะนำ และตรวจสอบสถานะของความรู้ที่บันทึกอยู่ในระบบจริง",
              en: "Edit, publish/hide, feature and audit every knowledge product stored in the database",
            })}
          </p>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ["staff", "knowledge-library"] })}
          className="inline-flex items-center gap-2 rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm font-medium text-navy-500 hover:bg-warm-50"
        >
          <RefreshCw className="h-4 w-4" /> {t({ th: "รีเฟรช", en: "Refresh" })}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label={t({ th: "ทั้งหมด", en: "Total" })} value={counts.total} />
        <Stat label={t({ th: "เผยแพร่แล้ว", en: "Published" })} value={counts.published} accent="text-emerald-600" />
        <Stat label={t({ th: "สาธารณะ", en: "Public" })} value={counts.public} accent="text-magenta-600" />
        <Stat label={t({ th: "ฉบับร่าง", en: "Draft" })} value={counts.draft} accent="text-warm-600" />
        <Stat label={t({ th: "แนะนำหน้าแรก", en: "Featured" })} value={counts.featured} accent="text-amber-600" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t({ th: "ค้นหา ชื่อ slug แท็ก…", en: "Search title, slug, tag…" })}
            className="w-full rounded-lg border border-warm-200 bg-white py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as never)}
          className="rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm">
          <option value="all">{t({ th: "ทุกสถานะ", en: "All status" })}</option>
          <option value="draft">Draft</option>
          <option value="in_review">In review</option>
          <option value="published">Published</option>
        </select>
        <select value={visibilityFilter} onChange={(e) => setVisibilityFilter(e.target.value as never)}
          className="rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm">
          <option value="all">{t({ th: "ทุกระดับ", en: "Any visibility" })}</option>
          <option value="public">Public</option>
          <option value="internal">Internal</option>
        </select>
      </div>

      {query.isLoading ? (
        <p className="py-10 text-center text-sm text-warm-500">{t({ th: "กำลังโหลด…", en: "Loading…" })}</p>
      ) : query.isError ? (
        <p className="py-10 text-center text-sm text-red-600">{(query.error as Error).message}</p>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-warm-500">{t({ th: "ไม่พบความรู้", en: "Nothing here" })}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-warm-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-warm-50 text-left text-xs uppercase tracking-wider text-warm-500">
              <tr>
                <th className="px-4 py-3">{t({ th: "ความรู้", en: "Knowledge" })}</th>
                <th className="px-4 py-3">{t({ th: "สถานะ", en: "Status" })}</th>
                <th className="px-4 py-3">{t({ th: "การมองเห็น", en: "Visibility" })}</th>
                <th className="px-4 py-3">{t({ th: "แนะนำ", en: "Featured" })}</th>
                <th className="px-4 py-3 text-right">{t({ th: "การจัดการ", en: "Actions" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-warm-50/60">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-navy-500">{row.titleTh}</div>
                    {row.titleEn && <div className="text-xs text-warm-500">{row.titleEn}</div>}
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-warm-400">
                      <code className="rounded bg-warm-100 px-1.5 py-0.5">/{row.slug}</code>
                      <span>·</span>
                      <span>{new Date(row.updatedAt).toLocaleDateString("th-TH")}</span>
                      {row.contentMd && <><span>·</span><span>{row.contentMd.length.toLocaleString()} ตัวอักษร</span></>}
                      {row.attachments?.length > 0 && <><span>·</span><span className="inline-flex items-center gap-0.5"><Paperclip className="h-3 w-3" />{row.attachments.length}</span></>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[row.status]}`}>{row.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => patch(row, { id: row.id, visibility: row.visibility === "public" ? "internal" : "public" })}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        row.visibility === "public" ? "bg-magenta-100 text-magenta-700" : "bg-warm-100 text-warm-600"
                      }`}
                      title={t({ th: "คลิกเพื่อสลับ", en: "Click to toggle" })}
                    >
                      {row.visibility === "public" ? <><Globe className="h-3 w-3" /> public</> : <><Lock className="h-3 w-3" /> internal</>}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => patch(row, { id: row.id, isFeatured: !row.isFeatured })}
                        className={`rounded-md p-1 ${row.isFeatured ? "text-amber-500" : "text-warm-300 hover:text-amber-500"}`}
                        title={t({ th: "ตั้ง/ยกเลิกแนะนำ", en: "Toggle featured" })}
                      >
                        {row.isFeatured ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
                      </button>
                      {row.isFeatured && (
                        <input
                          type="number"
                          min={0}
                          defaultValue={row.featuredOrder}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (v !== row.featuredOrder) patch(row, { id: row.id, featuredOrder: v });
                          }}
                          className="w-14 rounded border border-warm-200 px-1.5 py-0.5 text-xs"
                          title={t({ th: "ลำดับ", en: "Order" })}
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {row.status === "published" ? (
                        <button onClick={() => patch(row, { id: row.id, status: "draft" })}
                          className="inline-flex items-center gap-1 rounded-md border border-warm-200 px-2 py-1 text-xs text-warm-600 hover:bg-warm-50"
                          title={t({ th: "ซ่อน (กลับเป็นร่าง)", en: "Unpublish" })}>
                          <EyeOff className="h-3.5 w-3.5" /> {t({ th: "ซ่อน", en: "Hide" })}
                        </button>
                      ) : (
                        <button onClick={() => patch(row, { id: row.id, status: "published" })}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                          <Eye className="h-3.5 w-3.5" /> {t({ th: "เผยแพร่", en: "Publish" })}
                        </button>
                      )}
                      <button onClick={() => setEditing(row)}
                        className="rounded-md border border-warm-200 p-1.5 text-warm-600 hover:bg-warm-50"
                        title={t({ th: "แก้ไข", en: "Edit" })}>
                        <FileText className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setHistoryFor(row)}
                        className="rounded-md border border-warm-200 p-1.5 text-warm-600 hover:bg-warm-50"
                        title={t({ th: "ประวัติไฟล์แนบ", en: "Attachment history" })}>
                        <History className="h-3.5 w-3.5" />
                      </button>
                      {row.visibility === "public" && row.status === "published" && (
                        <Link to="/knowledge/$slug" params={{ slug: row.slug }} target="_blank"
                          className="rounded-md border border-warm-200 p-1.5 text-warm-600 hover:bg-warm-50"
                          title={t({ th: "ดูหน้าจริง", en: "View live" })}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      <button onClick={() => handleDelete(row)}
                        className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                        title={t({ th: "ลบ", en: "Delete" })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditorModal
          row={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            try {
              await upsert({ data: { ...patch, id: editing.id } });
              toast.success(t({ th: "บันทึกแล้ว", en: "Saved" }));
              setEditing(null);
              qc.invalidateQueries({ queryKey: ["staff", "knowledge-library"] });
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        />
      )}

      {historyFor && (
        <HistoryModal row={historyFor} onClose={() => setHistoryFor(null)} />
      )}
    </div>
  );
}

function Stat({ label, value, accent = "text-navy-500" }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-lg border border-warm-200 bg-white p-3">
      <div className="text-[11px] uppercase tracking-wider text-warm-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent}`}>{value}</div>
    </div>
  );
}

type EditorPayload = {
  slug: string;
  titleTh: string;
  titleEn: string | null;
  summary: string | null;
  keyMessage: string | null;
  contentMd: string;
  tags: string[];
  categories: string[];
};

function EditorModal({ row, onClose, onSave }: { row: KnowledgeRow; onClose: () => void; onSave: (p: EditorPayload) => Promise<void> }) {
  const { t } = useLanguage();
  const [slug, setSlug] = useState(row.slug);
  const [titleTh, setTitleTh] = useState(row.titleTh);
  const [titleEn, setTitleEn] = useState(row.titleEn ?? "");
  const [summary, setSummary] = useState(row.summary ?? "");
  const [keyMessage, setKeyMessage] = useState(row.keyMessage ?? "");
  const [contentMd, setContentMd] = useState(row.contentMd);
  const [tags, setTags] = useState(row.tags.join(", "));
  const [categories, setCategories] = useState(row.categories.join(", "));
  const [attachments, setAttachments] = useState<KnowledgeAttachment[]>(row.attachments ?? []);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const saveAttachments = useServerFn(setKnowledgeAttachments);

  async function persistAttachments(next: KnowledgeAttachment[]) {
    const res = await saveAttachments({ data: { id: row.id, attachments: next.map(({ url: _u, ...a }) => a) } });
    setAttachments(res.item.attachments);
  }

  async function onFilesPicked(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newOnes: KnowledgeAttachment[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 50 * 1024 * 1024) {
          toast.error(t({ th: `ไฟล์ใหญ่เกิน 50MB: ${file.name}`, en: `File over 50MB: ${file.name}` }));
          continue;
        }
        const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-200);
        const path = `${row.id}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("knowledge-attachments")
          .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
        if (upErr) {
          toast.error(`${file.name}: ${upErr.message}`);
          continue;
        }
        newOnes.push({
          path,
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
          uploadedAt: new Date().toISOString(),
        });
      }
      if (newOnes.length) {
        await persistAttachments([...attachments, ...newOnes]);
        toast.success(t({ th: `แนบ ${newOnes.length} ไฟล์แล้ว`, en: `Attached ${newOnes.length} file(s)` }));
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeAttachment(att: KnowledgeAttachment) {
    if (!confirm(t({ th: `ลบไฟล์ "${att.name}"?`, en: `Delete file "${att.name}"?` }))) return;
    try {
      await supabase.storage.from("knowledge-attachments").remove([att.path]);
      await persistAttachments(attachments.filter((a) => a.path !== att.path));
      toast.success(t({ th: "ลบไฟล์แล้ว", en: "File removed" }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-warm-200 px-5 py-3">
          <h2 className="text-lg font-semibold text-navy-500">{t({ th: "แก้ไขความรู้", en: "Edit knowledge" })}</h2>
          <button onClick={onClose} className="rounded p-1 text-warm-500 hover:bg-warm-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-auto px-5 py-4">
          <Field label="Slug"><input value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full rounded border border-warm-200 px-3 py-2 text-sm font-mono" /></Field>
          <Field label={t({ th: "ชื่อ (ไทย)", en: "Title (TH)" })}><input value={titleTh} onChange={(e) => setTitleTh(e.target.value)} className="w-full rounded border border-warm-200 px-3 py-2 text-sm" /></Field>
          <Field label={t({ th: "ชื่อ (อังกฤษ)", en: "Title (EN)" })}><input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className="w-full rounded border border-warm-200 px-3 py-2 text-sm" /></Field>
          <Field label={t({ th: "สรุปย่อ", en: "Summary" })}><textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} className="w-full rounded border border-warm-200 px-3 py-2 text-sm" /></Field>
          <Field label="Key message"><textarea value={keyMessage} onChange={(e) => setKeyMessage(e.target.value)} rows={2} className="w-full rounded border border-warm-200 px-3 py-2 text-sm" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t({ th: "หมวด (คั่นด้วย ,)", en: "Categories" })}><input value={categories} onChange={(e) => setCategories(e.target.value)} className="w-full rounded border border-warm-200 px-3 py-2 text-sm" /></Field>
            <Field label={t({ th: "แท็ก (คั่นด้วย ,)", en: "Tags" })}><input value={tags} onChange={(e) => setTags(e.target.value)} className="w-full rounded border border-warm-200 px-3 py-2 text-sm" /></Field>
          </div>
          <Field label={t({ th: "เนื้อหา (Markdown)", en: "Content (Markdown)" })}>
            <textarea value={contentMd} onChange={(e) => setContentMd(e.target.value)} rows={14} className="w-full rounded border border-warm-200 px-3 py-2 font-mono text-xs" />
          </Field>

          {/* Attachments */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-warm-500">
                <Paperclip className="mr-1 inline h-3.5 w-3.5" />
                {t({ th: "ไฟล์แนบ", en: "Attachments" })} ({attachments.length})
              </span>
              <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-warm-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-500 hover:bg-warm-50 ${uploading ? "opacity-60" : ""}`}>
                <Upload className="h-3.5 w-3.5" />
                {uploading ? t({ th: "กำลังอัปโหลด…", en: "Uploading…" }) : t({ th: "อัปโหลดไฟล์", en: "Upload" })}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => onFilesPicked(e.target.files)}
                />
              </label>
            </div>
            {attachments.length === 0 ? (
              <p className="rounded-md border border-dashed border-warm-200 bg-warm-50 px-3 py-4 text-center text-xs text-warm-500">
                {t({ th: "ยังไม่มีไฟล์แนบ — รองรับ PDF, รูปภาพ และไฟล์อื่น ๆ สูงสุด 50MB ต่อไฟล์", en: "No attachments yet — PDF, images, and other files up to 50MB each" })}
              </p>
            ) : (
              <ul className="divide-y divide-warm-100 rounded-md border border-warm-200">
                {attachments.map((a) => (
                  <li key={a.path} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-warm-500" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-navy-500">{a.name}</div>
                      <div className="text-[11px] text-warm-500">{formatSize(a.size)} · {a.contentType}</div>
                    </div>
                    {a.url && (
                      <a href={a.url} target="_blank" rel="noopener noreferrer" download
                        className="rounded-md border border-warm-200 p-1.5 text-warm-600 hover:bg-warm-50"
                        title={t({ th: "ดาวน์โหลด", en: "Download" })}>
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button onClick={() => removeAttachment(a)}
                      className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                      title={t({ th: "ลบ", en: "Delete" })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-warm-200 bg-warm-50 px-5 py-3">
          <button onClick={onClose} className="rounded-md border border-warm-200 bg-white px-3 py-2 text-sm">{t({ th: "ยกเลิก", en: "Cancel" })}</button>
          <button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onSave({
                slug: slug.trim(),
                titleTh: titleTh.trim(),
                titleEn: titleEn.trim() || null,
                summary: summary.trim() || null,
                keyMessage: keyMessage.trim() || null,
                contentMd,
                tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
                categories: categories.split(",").map((s) => s.trim()).filter(Boolean),
              });
              setSaving(false);
            }}
            className="inline-flex items-center gap-2 rounded-md bg-magenta-600 px-4 py-2 text-sm font-semibold text-white hover:bg-magenta-700 disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {t({ th: "บันทึก", en: "Save" })}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-warm-500">{label}</span>
      {children}
    </label>
  );
}
