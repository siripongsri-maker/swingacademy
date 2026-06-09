import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  CheckCircle2,
  Archive,
  Send,
  Sparkles,
  Layers,
  Plus,
  X,
  Trash2,
  Save,
  BookOpen,
  ShieldCheck,
  FileText,
  Globe,
  EyeOff,
} from "lucide-react";
import {
  useProductKnowledge,
  type KnowledgeAsset,
  type KnowledgeStatus,
  type QaChecklist,
} from "@/lib/product-knowledge-store";
import { publishKnowledgeBySlug } from "@/lib/knowledge.functions";
import { suggestKnowledgeMeta } from "@/lib/knowledge-ai.functions";
import { useConsoleRole } from "@/lib/console-role-context";

export const Route = createFileRoute("/staff/knowledge")({
  component: KnowledgeManagementPage,
});

const STATUS_STYLES: Record<KnowledgeStatus, string> = {
  draft: "bg-warm-200 text-warm-700",
  review: "bg-amber-100 text-amber-700",
  published: "bg-success/15 text-success",
  archived: "bg-warm-100 text-warm-500",
};

const QA_ITEMS: Array<{ key: keyof QaChecklist; label: string }> = [
  { key: "titleClear", label: "ชื่อเรื่องชัดเจน เข้าใจง่าย" },
  { key: "keyMessageOk", label: "Key message ครบถ้วน" },
  { key: "sourceCited", label: "อ้างอิงแหล่งที่มา" },
  { key: "languageOk", label: "ภาษาถูกต้อง สะกดดี" },
  { key: "nonStigmatizing", label: "ภาษา inclusive ไม่ตีตรา" },
  { key: "expertReviewed", label: "ผ่านการตรวจโดยผู้เชี่ยวชาญ" },
];

// Domain choices for KM (Phase 4 spec)
const DOMAINS = [
  "HIV Prevention",
  "PrEP/PEP",
  "ART",
  "Community Care",
  "Rights & Law",
  "Communication",
  "M&E",
];

function KnowledgeManagementPage() {
  const km = useProductKnowledge();
  const { can } = useConsoleRole();
  const [tab, setTab] = useState<"assets" | "collections">("assets");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | KnowledgeStatus>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [collectionEditing, setCollectionEditing] = useState<string | "new" | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return km.assets.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        a.titleTh.toLowerCase().includes(needle) ||
        a.titleEn.toLowerCase().includes(needle) ||
        a.tags.some((t) => t.toLowerCase().includes(needle))
      );
    });
  }, [km.assets, q, statusFilter]);

  if (!can("km.categorize")) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-warm-500">Knowledge Management</p>
        <h1 className="mt-2 text-2xl font-semibold text-navy-500">ต้องเป็น Trainer หรือ Admin</h1>
        <p className="mt-2 text-sm text-warm-500">
          หน้านี้สำหรับ Trainer / Admin ที่จะตรวจสอบ จัดหมวด และเชื่อมโยงความรู้
          ถ้าคุณเป็น Staff สามารถส่ง Knowledge Product ของคุณให้ review ได้จาก{" "}
          <Link to="/staff/product-knowledge" className="font-semibold text-magenta-600 hover:underline">
            Knowledge Product
          </Link>
        </p>
      </div>
    );
  }


  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-warm-500">Knowledge Management</p>
        <h1 className="mt-1 text-3xl font-semibold text-navy-500">จัดการความรู้</h1>
        <p className="mt-1 text-sm text-warm-500">
          Admin / Trainer ตรวจสอบ approve และจัดหมวด Knowledge Product, รวมเป็น collection, เชื่อม competency และ curriculum
        </p>
      </div>

      <div className="flex items-center gap-2 border-b border-warm-200">
        <TabBtn active={tab === "assets"} onClick={() => setTab("assets")}>
          Knowledge Assets ({km.assets.length})
        </TabBtn>
        <TabBtn active={tab === "collections"} onClick={() => setTab("collections")}>
          Collections ({km.collections.length})
        </TabBtn>
      </div>

      {tab === "assets" ? (
        <>
          <div className="space-y-3 rounded-lg border border-warm-200 bg-white p-4 shadow-sm">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหาตามชื่อหรือ tag…"
                className="w-full rounded-pill border border-warm-200 bg-warm-50 py-2.5 pl-10 pr-4 text-sm text-navy-500 placeholder:text-warm-400 focus:border-magenta-500 focus:bg-white focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "draft", "review", "published", "archived"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-pill border px-3 py-1 text-xs font-semibold transition-colors ${
                    statusFilter === s
                      ? "border-magenta-500 bg-magenta-500 text-white"
                      : "border-warm-200 bg-white text-warm-700 hover:border-magenta-500"
                  }`}
                >
                  {s === "all" ? "All" : s}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-3">
              {filtered.map((a) => (
                <AssetRow key={a.id} asset={a} onOpen={() => setEditingId(a.id)} />
              ))}
            </div>
          )}
        </>
      ) : (
        <CollectionsView onEdit={(id) => setCollectionEditing(id)} />
      )}

      {editingId && (
        <AssetDrawer
          asset={km.assets.find((a) => a.id === editingId)!}
          onClose={() => setEditingId(null)}
        />
      )}

      {collectionEditing && (
        <CollectionDrawer
          collectionId={collectionEditing === "new" ? null : collectionEditing}
          onClose={() => setCollectionEditing(null)}
        />
      )}

      {tab === "collections" && (
        <button
          onClick={() => setCollectionEditing("new")}
          className="fixed bottom-6 right-6 inline-flex items-center gap-2 rounded-pill bg-magenta-500 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-magenta-600"
        >
          <Plus className="h-4 w-4" /> สร้าง Collection
        </button>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
        active ? "border-magenta-500 text-magenta-600" : "border-transparent text-warm-500 hover:text-navy-500"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-warm-200 bg-white p-12 text-center">
      <p className="text-sm font-semibold text-navy-500">ยังไม่มี Knowledge Product</p>
      <p className="mt-1 text-xs text-warm-500">
        เริ่มจากปุ่ม "บันทึกความรู้" ที่ sidebar หรือไปที่{" "}
        <Link to="/staff/product-knowledge" className="text-magenta-500 underline">
          Knowledge Product
        </Link>
      </p>
    </div>
  );
}

function AssetRow({ asset, onOpen }: { asset: KnowledgeAsset; onOpen: () => void }) {
  const { updateAsset, categoryLabels } = useProductKnowledge();
  const qc = useQueryClient();
  const syncDb = useServerFn(publishKnowledgeBySlug);
  const qa = asset.qaChecklist ?? {};
  const qaCount = QA_ITEMS.filter((i) => qa[i.key]).length;
  const isPublic = asset.visibility === "public";
  const isLive = isPublic && asset.status === "published";

  const dbPayload = (overrides: { status?: "draft" | "in_review" | "published"; visibility?: "internal" | "public" }) => ({
    slug: asset.slug,
    titleTh: asset.titleTh || asset.titleEn || asset.slug,
    titleEn: asset.titleEn || null,
    summary: asset.summary || null,
    contentMd: (asset as { contentMd?: string }).contentMd ?? "",
    categories: asset.categories ?? [],
    tags: asset.tags ?? [],
    ...overrides,
  });

  const invalidatePublic = () => {
    qc.invalidateQueries({ queryKey: ["knowledge", "public", "all"] });
    qc.invalidateQueries({ queryKey: ["knowledge", "featured"] });
  };

  const approve = async () => {
    updateAsset(
      asset.id,
      { status: "published", approvedAt: new Date().toISOString(), approvedBy: "You" },
      "Approved & published",
    );
    try {
      await syncDb({ data: dbPayload({ status: "published" }) });
      invalidatePublic();
      toast.success("Approved — บันทึกในฐานข้อมูลแล้ว");
    } catch (e) {
      toast.error(`บันทึก DB ไม่สำเร็จ: ${(e as Error).message}`);
    }
  };

  const sendReview = async () => {
    updateAsset(asset.id, { status: "review" }, "Sent to review");
    try {
      await syncDb({ data: dbPayload({ status: "in_review" }) });
      toast.success("ส่งให้ตรวจสอบแล้ว");
    } catch (e) {
      toast.error(`บันทึก DB ไม่สำเร็จ: ${(e as Error).message}`);
    }
  };

  const archive = async () => {
    updateAsset(asset.id, { status: "archived" }, "Archived");
    try {
      await syncDb({ data: dbPayload({ status: "draft", visibility: "internal" }) });
      invalidatePublic();
      toast.success("Archived");
    } catch (e) {
      toast.error(`บันทึก DB ไม่สำเร็จ: ${(e as Error).message}`);
    }
  };

  const publishWeb = async () => {
    updateAsset(
      asset.id,
      {
        status: "published",
        visibility: "public",
        approvedAt: asset.approvedAt ?? new Date().toISOString(),
        approvedBy: asset.approvedBy ?? "You",
      },
      "Published to public website",
    );
    try {
      await syncDb({ data: dbPayload({ status: "published", visibility: "public" }) });
      invalidatePublic();
      toast.success("ขึ้นหน้า /knowledge แล้ว");
    } catch (e) {
      toast.error(`เผยแพร่ไม่สำเร็จ: ${(e as Error).message}`);
    }
  };

  const unpublishWeb = async () => {
    updateAsset(asset.id, { visibility: "staff" }, "Unpublished from public website");
    try {
      await syncDb({ data: dbPayload({ visibility: "internal" }) });
      invalidatePublic();
      toast.success("ถอดออกจากหน้าเว็บแล้ว");
    } catch (e) {
      toast.error(`ถอดเผยแพร่ไม่สำเร็จ: ${(e as Error).message}`);
    }
  };

  const publishWeb = () => {
    updateAsset(
      asset.id,
      {
        status: "published",
        visibility: "public",
        approvedAt: asset.approvedAt ?? new Date().toISOString(),
        approvedBy: asset.approvedBy ?? "You",
      },
      "Published to public website",
    );
    toast.success("ขึ้นหน้า /knowledge แล้ว");
  };

  const unpublishWeb = () => {
    updateAsset(
      asset.id,
      { visibility: "staff" },
      "Unpublished from public website",
    );
    toast.success("ถอดออกจากหน้าเว็บแล้ว (ยังคงเป็น Approved ภายใน)");
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-warm-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
      <button onClick={onOpen} className="flex-1 text-left">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-navy-500">{asset.titleTh || asset.titleEn}</h3>
              <span
                className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[asset.status]}`}
              >
                {asset.status}
              </span>
              {isLive ? (
                <span className="inline-flex items-center gap-1 rounded-pill bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <Globe className="h-3 w-3" /> Live · /knowledge
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-pill bg-warm-100 px-2 py-0.5 text-[11px] font-semibold text-warm-600">
                  <EyeOff className="h-3 w-3" /> Internal
                </span>
              )}
              {asset.approvedAt && (
                <span className="inline-flex items-center gap-1 rounded-pill bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                  <CheckCircle2 className="h-3 w-3" /> Approved
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-pill bg-warm-100 px-2 py-0.5 text-[11px] font-semibold text-warm-700">
                v{asset.versionHistory.at(-1)?.v ?? "1.0"}
              </span>
            </div>
            <p className="mt-1 line-clamp-1 text-xs text-warm-500">{asset.summary}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {asset.categories.map((c) => (
                <span key={c} className="inline-flex items-center rounded-pill bg-lavender-100 px-2 py-0.5 text-[11px] font-semibold text-lavender-900">
                  {categoryLabels[c]?.th ?? c}
                </span>
              ))}
              {(asset.competencyTags ?? []).slice(0, 3).map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-pill bg-magenta-500/10 px-2 py-0.5 text-[11px] font-semibold text-magenta-600">
                  <ShieldCheck className="h-3 w-3" />
                  {t}
                </span>
              ))}
              <span className="inline-flex items-center gap-1 rounded-pill border border-warm-200 px-2 py-0.5 text-[11px] font-semibold text-warm-700">
                <CheckCircle2 className="h-3 w-3" /> QA {qaCount}/{QA_ITEMS.length}
              </span>
            </div>
          </div>
        </div>
      </button>
      <AssetRowActions
        asset={asset}
        approve={approve}
        sendReview={sendReview}
        archive={archive}
        publishWeb={publishWeb}
        unpublishWeb={unpublishWeb}
        isPublic={isPublic}
      />
    </div>
  );
}

function AssetRowActions({
  asset,
  approve,
  sendReview,
  archive,
  publishWeb,
  unpublishWeb,
  isPublic,
}: {
  asset: KnowledgeAsset;
  approve: () => void;
  sendReview: () => void;
  archive: () => void;
  publishWeb: () => void;
  unpublishWeb: () => void;
  isPublic: boolean;
}) {
  const { can, canEditAsset } = useConsoleRole();
  const mayReview = can("knowledge.review");
  const mayPublish = can("knowledge.publish");
  const mayArchive = can("knowledge.archive");
  const maySubmit = canEditAsset({ ownerId: asset.ownerId }) && can("knowledge.submitForReview");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {asset.status === "draft" && maySubmit && (
        <button onClick={sendReview} className="inline-flex items-center gap-1 rounded-pill bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200">
          <Send className="h-3.5 w-3.5" /> Review
        </button>
      )}
      {asset.status === "review" && mayReview && !mayPublish && (
        <span className="inline-flex items-center gap-1 rounded-pill bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> Reviewed — admin to publish
        </span>
      )}
      {asset.status !== "published" && asset.status !== "archived" && mayPublish && (
        <button onClick={approve} className="inline-flex items-center gap-1 rounded-pill bg-success px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
        </button>
      )}
      {asset.status === "published" && mayPublish && !isPublic && (
        <button onClick={publishWeb} className="inline-flex items-center gap-1 rounded-pill bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
          <Globe className="h-3.5 w-3.5" /> Publish ขึ้นเว็บ
        </button>
      )}
      {isPublic && mayPublish && (
        <button onClick={unpublishWeb} className="inline-flex items-center gap-1 rounded-pill border border-warm-300 bg-white px-3 py-1.5 text-xs font-semibold text-warm-700 hover:bg-warm-100">
          <EyeOff className="h-3.5 w-3.5" /> Unpublish
        </button>
      )}
      {asset.status !== "archived" && mayArchive && (
        <button onClick={archive} className="inline-flex items-center gap-1 rounded-pill border border-warm-200 px-3 py-1.5 text-xs font-semibold text-warm-700 hover:bg-warm-100">
          <Archive className="h-3.5 w-3.5" /> Archive
        </button>
      )}
    </div>
  );
}



function AssetDrawer({ asset, onClose }: { asset: KnowledgeAsset; onClose: () => void }) {
  const { updateAsset, categoryLabels, audiences } = useProductKnowledge();
  const suggest = useServerFn(suggestKnowledgeMeta);

  const [objectives, setObjectives] = useState((asset.learningObjectives ?? []).join("\n"));
  const [competencies, setCompetencies] = useState((asset.competencyTags ?? []).join(", "));
  const [services, setServices] = useState((asset.relatedServices ?? []).join(", "));
  const [courses, setCourses] = useState((asset.relatedCourses ?? []).join(", "));
  const [curriculum, setCurriculum] = useState(asset.linkedCurriculum ?? "");
  const [domain, setDomain] = useState(asset.categories[0] ?? "");
  const [audienceIds, setAudienceIds] = useState<string[]>(asset.audiences);
  const [tags, setTags] = useState(asset.tags.join(", "));
  const [qa, setQa] = useState<QaChecklist>(asset.qaChecklist ?? {});
  const [aiLoading, setAiLoading] = useState(false);

  const toggleAud = (id: string) =>
    setAudienceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleQa = (key: keyof QaChecklist) => setQa((q) => ({ ...q, [key]: !q[key] }));

  const aiSuggest = async () => {
    setAiLoading(true);
    try {
      const out = await suggest({
        data: {
          titleTh: asset.titleTh,
          titleEn: asset.titleEn,
          summary: asset.summary,
          keyMessage: asset.keyMessage,
          contentMd: asset.contentMd.slice(0, 8000),
          availableCategories: Object.keys(categoryLabels),
          availableAudiences: audiences.map((a) => a.id),
        },
      });
      if (out.categories.length) setDomain(out.categories[0]);
      if (out.audiences.length) setAudienceIds(out.audiences);
      if (out.tags.length) setTags(out.tags.join(", "));
      if (out.competencyTags.length) setCompetencies(out.competencyTags.join(", "));
      if (out.learningObjectives.length) setObjectives(out.learningObjectives.join("\n"));
      toast.success("AI แนะนำเสร็จแล้ว ตรวจสอบและบันทึก");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI suggest failed");
    } finally {
      setAiLoading(false);
    }
  };

  const save = () => {
    const newCategories = domain
      ? [domain, ...asset.categories.filter((c) => c !== domain)]
      : asset.categories;
    updateAsset(
      asset.id,
      {
        categories: newCategories,
        audiences: audienceIds,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        learningObjectives: objectives.split("\n").map((s) => s.trim()).filter(Boolean),
        competencyTags: competencies.split(",").map((s) => s.trim()).filter(Boolean),
        relatedServices: services.split(",").map((s) => s.trim()).filter(Boolean),
        relatedCourses: courses.split(",").map((s) => s.trim()).filter(Boolean),
        linkedCurriculum: curriculum.trim() || undefined,
        qaChecklist: qa,
      },
      "Updated KM metadata",
    );
    toast.success("บันทึกแล้ว");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <button aria-label="Close" onClick={onClose} className="flex-1 bg-navy-900/50 backdrop-blur-sm" />
      <div className="flex w-full max-w-2xl flex-col bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-warm-200 px-6 py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-warm-500">Manage knowledge</p>
            <h2 className="truncate text-lg font-semibold text-navy-500">{asset.titleTh || asset.titleEn}</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-warm-500 hover:bg-warm-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <button
            onClick={aiSuggest}
            disabled={aiLoading}
            className="inline-flex items-center gap-2 rounded-pill bg-lavender-100 px-4 py-2 text-sm font-semibold text-lavender-900 hover:bg-lavender-200 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {aiLoading ? "AI กำลังคิด…" : "AI แนะนำหมวดหมู่ / tags / competency"}
          </button>

          <Field label="Domain (หมวดหลัก)">
            <select value={domain} onChange={(e) => setDomain(e.target.value)} className="input">
              <option value="">— เลือก —</option>
              {Object.entries(categoryLabels).map(([k, v]) => (
                <option key={k} value={k}>{v.th} / {v.en}</option>
              ))}
            </select>
          </Field>

          <Field label="Target audience">
            <div className="flex flex-wrap gap-1.5">
              {audiences.map((a) => (
                <button
                  key={a.id}
                  onClick={() => toggleAud(a.id)}
                  className={`rounded-pill border px-3 py-1 text-xs font-semibold transition-colors ${
                    audienceIds.includes(a.id)
                      ? "border-magenta-500 bg-magenta-500 text-white"
                      : "border-warm-200 bg-white text-warm-700 hover:border-magenta-500"
                  }`}
                >
                  {a.th}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Learning objectives (บรรทัดละ 1 ข้อ)">
            <textarea
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              rows={4}
              placeholder="ผู้เรียนสามารถ…"
              className="input"
            />
          </Field>

          <Field label="Competency tags (คั่นด้วย ,)">
            <input value={competencies} onChange={(e) => setCompetencies(e.target.value)} className="input" placeholder="counselling, harm-reduction" />
          </Field>

          <Field label="Tags (คั่นด้วย ,)">
            <input value={tags} onChange={(e) => setTags(e.target.value)} className="input" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Related services">
              <input value={services} onChange={(e) => setServices(e.target.value)} className="input" placeholder="PrEP clinic, HIVST" />
            </Field>
            <Field label="Related courses">
              <input value={courses} onChange={(e) => setCourses(e.target.value)} className="input" placeholder="Outreach 101" />
            </Field>
          </div>

          <Field label="Linked curriculum / training module">
            <input value={curriculum} onChange={(e) => setCurriculum(e.target.value)} className="input" placeholder="เช่น Outreach Worker Curriculum 2026" />
          </Field>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-warm-500">Content quality checklist</p>
            <div className="space-y-1.5 rounded-md border border-warm-200 bg-warm-50 p-3">
              {QA_ITEMS.map((item) => (
                <label key={item.key} className="flex items-center gap-2 text-sm text-navy-500">
                  <input
                    type="checkbox"
                    checked={!!qa[item.key]}
                    onChange={() => toggleQa(item.key)}
                    className="h-4 w-4 rounded border-warm-300 text-magenta-500 focus:ring-magenta-500"
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-warm-500">Version history</p>
            <ul className="space-y-1 rounded-md border border-warm-200 bg-warm-50 p-3 text-xs text-warm-700">
              {asset.versionHistory.slice().reverse().map((v, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="font-semibold text-navy-500">v{v.v}</span>
                  <span className="flex-1 truncate">{v.note}</span>
                  <span className="text-warm-500">{new Date(v.at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-warm-200 px-6 py-4">
          <button onClick={onClose} className="rounded-pill border border-warm-200 px-4 py-2 text-sm font-semibold text-warm-700 hover:bg-warm-100">
            ยกเลิก
          </button>
          <button onClick={save} className="inline-flex items-center gap-2 rounded-pill bg-magenta-500 px-5 py-2 text-sm font-semibold text-white hover:bg-magenta-600">
            <Save className="h-4 w-4" /> บันทึก
          </button>
        </div>
      </div>
      <style>{`.input{width:100%;border:1px solid hsl(var(--warm-200,30 10% 90%));border-radius:8px;padding:8px 12px;font-size:14px;background:#fff;color:#1a2332} .input:focus{outline:none;border-color:#d6336c}`}</style>
    </div>
  );
}

function CollectionsView({ onEdit }: { onEdit: (id: string) => void }) {
  const { collections, assets } = useProductKnowledge();
  if (collections.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-warm-200 bg-white p-12 text-center">
        <Layers className="mx-auto h-8 w-8 text-warm-400" />
        <p className="mt-3 text-sm font-semibold text-navy-500">ยังไม่มี Collection</p>
        <p className="mt-1 text-xs text-warm-500">รวม Knowledge Product หลายชิ้นเป็นชุดเดียวสำหรับการอบรมหรือแคมเปญ</p>
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {collections.map((c) => (
        <button
          key={c.id}
          onClick={() => onEdit(c.id)}
          className="rounded-lg border border-warm-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-magenta-500 hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-2">
            <Layers className="h-5 w-5 text-magenta-500" />
            <span className="inline-flex items-center rounded-pill bg-lavender-100 px-2 py-0.5 text-[11px] font-semibold text-lavender-900">
              {c.domain || "—"}
            </span>
          </div>
          <h3 className="mt-2 text-base font-semibold text-navy-500">{c.name}</h3>
          <p className="mt-1 line-clamp-2 text-xs text-warm-500">{c.description}</p>
          <div className="mt-3 flex items-center gap-2 text-xs text-warm-700">
            <BookOpen className="h-3.5 w-3.5" />
            {c.assetIds.filter((id) => assets.some((a) => a.id === id)).length} items
          </div>
        </button>
      ))}
    </div>
  );
}

function CollectionDrawer({ collectionId, onClose }: { collectionId: string | null; onClose: () => void }) {
  const { collections, assets, createCollection, updateCollection, removeCollection } = useProductKnowledge();
  const existing = collectionId ? collections.find((c) => c.id === collectionId) : null;

  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [domain, setDomain] = useState(existing?.domain ?? DOMAINS[0]);
  const [assetIds, setAssetIds] = useState<string[]>(existing?.assetIds ?? []);

  const toggle = (id: string) =>
    setAssetIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = () => {
    if (!name.trim()) return toast.error("กรุณาใส่ชื่อ collection");
    if (existing) {
      updateCollection(existing.id, { name, description, domain, assetIds });
      toast.success("บันทึก collection แล้ว");
    } else {
      createCollection({ name, description, domain, assetIds });
      toast.success("สร้าง collection แล้ว");
    }
    onClose();
  };

  const del = () => {
    if (!existing) return;
    if (!confirm("ลบ collection นี้?")) return;
    removeCollection(existing.id);
    toast.success("ลบแล้ว");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <button aria-label="Close" onClick={onClose} className="flex-1 bg-navy-900/50 backdrop-blur-sm" />
      <div className="flex w-full max-w-xl flex-col bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-warm-200 px-6 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-warm-500">Collection</p>
            <h2 className="text-lg font-semibold text-navy-500">{existing ? "แก้ไข" : "สร้างใหม่"}</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-warm-500 hover:bg-warm-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <Field label="ชื่อ Collection">
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="เช่น ชุดความรู้ PrEP สำหรับ Outreach" />
          </Field>
          <Field label="คำอธิบาย">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="input" />
          </Field>
          <Field label="Domain">
            <select value={domain} onChange={(e) => setDomain(e.target.value)} className="input">
              {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-warm-500">เลือก Knowledge Product ({assetIds.length})</p>
            {assets.length === 0 ? (
              <p className="rounded-md border border-dashed border-warm-200 p-4 text-center text-xs text-warm-500">ยังไม่มี asset ในระบบ</p>
            ) : (
              <div className="max-h-80 space-y-1 overflow-y-auto rounded-md border border-warm-200 p-2">
                {assets.map((a) => (
                  <label key={a.id} className="flex items-start gap-2 rounded-md p-2 text-sm hover:bg-warm-50">
                    <input
                      type="checkbox"
                      checked={assetIds.includes(a.id)}
                      onChange={() => toggle(a.id)}
                      className="mt-0.5 h-4 w-4 rounded border-warm-300 text-magenta-500 focus:ring-magenta-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3 w-3 shrink-0 text-warm-500" />
                        <span className="truncate font-medium text-navy-500">{a.titleTh || a.titleEn}</span>
                      </div>
                      <p className="line-clamp-1 text-xs text-warm-500">{a.summary}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-warm-200 px-6 py-4">
          {existing ? (
            <button onClick={del} className="inline-flex items-center gap-1 rounded-pill px-3 py-2 text-xs font-semibold text-danger hover:bg-danger/10">
              <Trash2 className="h-3.5 w-3.5" /> ลบ
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-pill border border-warm-200 px-4 py-2 text-sm font-semibold text-warm-700 hover:bg-warm-100">
              ยกเลิก
            </button>
            <button onClick={save} className="inline-flex items-center gap-2 rounded-pill bg-magenta-500 px-5 py-2 text-sm font-semibold text-white hover:bg-magenta-600">
              <Save className="h-4 w-4" /> บันทึก
            </button>
          </div>
        </div>
      </div>
      <style>{`.input{width:100%;border:1px solid #e7e3dd;border-radius:8px;padding:8px 12px;font-size:14px;background:#fff;color:#1a2332} .input:focus{outline:none;border-color:#d6336c}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-warm-500">{label}</span>
      {children}
    </label>
  );
}
