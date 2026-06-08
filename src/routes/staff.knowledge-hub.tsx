import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Mic,
  Upload,
  LinkIcon,
  ListChecks,
  Sparkles,
  Share2,
  Pencil,
  Users as UsersIcon,
  Globe,
  Lock,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  useProductKnowledge,
  type KnowledgeAsset,
  type KnowledgeStatus,
  type KnowledgeType,
  type Visibility,
} from "@/lib/product-knowledge-store";
import seed from "@/data/seed-data.json";

export const Route = createFileRoute("/staff/knowledge-hub")({
  component: KnowledgeHubPage,
});

type Person = { id: string; name: string; nameTh?: string };

const STATUS_STYLES: Record<KnowledgeStatus, string> = {
  draft: "bg-warm-200 text-warm-700",
  review: "bg-amber-100 text-amber-700",
  published: "bg-success/15 text-success",
  archived: "bg-warm-100 text-warm-500",
};
const STATUS_LABEL_TH: Record<KnowledgeStatus, string> = {
  draft: "ร่าง",
  review: "รอตรวจ",
  published: "เผยแพร่แล้ว",
  archived: "เก็บเข้าคลัง",
};
const VIS_ICON: Record<Visibility, React.ComponentType<{ className?: string }>> = {
  private: Lock,
  staff: UsersIcon,
  public: Globe,
};
const VIS_LABEL_TH: Record<Visibility, string> = {
  private: "ส่วนตัว",
  staff: "เฉพาะทีม",
  public: "เปิดสาธารณะ",
};

type DateRange = "all" | "7d" | "30d" | "90d";

function withinRange(updatedAt: string, range: DateRange) {
  if (range === "all") return true;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const cutoff = Date.now() - days * 86400_000;
  return new Date(updatedAt).getTime() >= cutoff;
}

function shareUrl(slug: string) {
  if (typeof window === "undefined") return `/k/${slug}`;
  return `${window.location.origin}/k/${slug}`;
}

function KnowledgeHubPage() {
  const pk = useProductKnowledge();
  const people = (seed as any)?.staffConsole?.people as Person[] | undefined;
  const peopleById = useMemo(() => {
    const m = new Map<string, Person>();
    (people ?? []).forEach((p) => m.set(p.id, p));
    return m;
  }, [people]);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<KnowledgeStatus | "all">("all");
  const [type, setType] = useState<KnowledgeType | "all">("all");
  const [domain, setDomain] = useState<string>("all");
  const [owner, setOwner] = useState<string>("all");
  const [range, setRange] = useState<DateRange>("all");

  const owners = useMemo(() => {
    const ids = Array.from(new Set(pk.assets.map((a) => a.ownerId).filter(Boolean)));
    return ids.map((id) => ({
      id,
      label: peopleById.get(id)?.name ?? id,
    }));
  }, [pk.assets, peopleById]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return pk.assets
      .filter((a) => {
        if (status !== "all" && a.status !== status) return false;
        if (type !== "all" && a.type !== type) return false;
        if (domain !== "all" && !a.categories.includes(domain)) return false;
        if (owner !== "all" && a.ownerId !== owner) return false;
        if (!withinRange(a.updatedAt, range)) return false;
        if (!needle) return true;
        return (
          a.titleTh.toLowerCase().includes(needle) ||
          a.titleEn.toLowerCase().includes(needle) ||
          a.slug.toLowerCase().includes(needle) ||
          a.keyMessage.toLowerCase().includes(needle) ||
          a.tags.some((t) => t.toLowerCase().includes(needle))
        );
      })
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }, [pk.assets, q, status, type, domain, owner, range]);

  async function copyShare(a: KnowledgeAsset) {
    const url = shareUrl(a.slug);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied");
    } catch {
      toast.error(url);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      {/* Header + big capture button */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Knowledge Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            ภาพรวมความรู้ทั้งหมดของทีม — ค้นหา กรอง และจัดการได้ในที่เดียว
          </p>
        </div>
        <Link
          to="/staff/product-knowledge"
          search={{ create: 1 }}
          className="inline-flex items-center gap-2 rounded-lg bg-magenta-500 px-5 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-magenta-600"
        >
          <Plus className="h-5 w-5" /> บันทึกความรู้
        </Link>
      </header>

      {/* Quick actions */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <QuickAction to="/staff/capture" icon={Mic} title="Record Audio" desc="อัดเสียงทันที" />
        <QuickAction
          to="/staff/product-knowledge"
          search={{ create: 1 }}
          icon={Upload}
          title="Upload File"
          desc="อัปโหลด PDF / สไลด์ / วิดีโอ"
        />
        <QuickAction
          to="/staff/product-knowledge"
          search={{ create: 1 }}
          icon={LinkIcon}
          title="Add External Source"
          desc="ลิงก์ บทความ พาร์ทเนอร์"
        />
        <QuickAction to="/staff/capture" icon={ListChecks} title="Create from Agenda" desc="บันทึกตามวาระ" />
        <QuickAction
          to="/staff/knowledge-translation"
          icon={Sparkles}
          title="Translate Content"
          desc="แปลงเป็นสื่อ / เนื้อหา"
        />
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="grid gap-2 md:grid-cols-12">
          <div className="relative md:col-span-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหา title, slug, tag, key message…"
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as KnowledgeStatus | "all")}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2"
          >
            <option value="all">All status</option>
            <option value="draft">Draft</option>
            <option value="review">Review</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as KnowledgeType | "all")}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2"
          >
            <option value="all">All types</option>
            {Object.entries(pk.typeLabels).map(([id, l]) => (
              <option key={id} value={id}>
                {l.en}
              </option>
            ))}
          </select>
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2"
          >
            <option value="all">All domains</option>
            {Object.entries(pk.categoryLabels).map(([id, l]) => (
              <option key={id} value={id}>
                {l.en}
              </option>
            ))}
          </select>
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2"
          >
            <option value="all">All owners</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as DateRange)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2 md:col-start-11"
          >
            <option value="all">Any date</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          แสดง <span className="font-semibold text-foreground">{filtered.length}</span> /
          {" "}{pk.assets.length} รายการ
        </p>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">ไม่พบความรู้ที่ตรงกับตัวกรอง</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => {
            const VIcon = VIS_ICON[a.visibility];
            const ownerLabel = peopleById.get(a.ownerId)?.name ?? a.ownerId ?? "—";
            return (
              <li
                key={a.id}
                className="flex flex-col rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[a.status]}`}>
                    {STATUS_LABEL[a.status]}
                  </span>
                  <span className="rounded-full bg-warm-100 px-2 py-0.5 text-[11px] font-medium text-warm-700">
                    {pk.typeLabels[a.type]?.en ?? a.type}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-navy-900/5 px-2 py-0.5 text-[11px] font-medium text-navy-900">
                    <VIcon className="h-3 w-3" />
                    {a.visibility}
                  </span>
                </div>

                <h3 className="mt-2 line-clamp-2 text-base font-semibold text-foreground">
                  {a.titleEn || a.titleTh}
                </h3>
                {a.titleTh && a.titleEn && (
                  <p lang="th" className="line-clamp-1 text-sm text-muted-foreground">
                    {a.titleTh}
                  </p>
                )}

                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Domain</dt>
                    <dd className="mt-0.5 flex flex-wrap gap-1">
                      {a.categories.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        a.categories.map((c) => (
                          <span key={c} className="rounded-full bg-magenta-50 px-2 py-0.5 text-[11px] text-magenta-700">
                            {pk.categoryLabels[c]?.en ?? c}
                          </span>
                        ))
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Owner</dt>
                    <dd className="mt-0.5 truncate font-medium text-foreground">{ownerLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Updated</dt>
                    <dd className="mt-0.5 truncate font-medium text-foreground">
                      {new Date(a.updatedAt).toLocaleDateString()}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Source</dt>
                    <dd className="mt-0.5 truncate text-foreground">
                      {a.sourceUrl ? (
                        <a
                          href={a.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-magenta-700 hover:underline"
                        >
                          {a.source || a.sourceUrl} <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span>{a.source || "Internal"}</span>
                      )}
                    </dd>
                  </div>
                </dl>

                {a.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {a.tags.slice(0, 6).map((t) => (
                      <span key={t} className="rounded bg-warm-50 px-1.5 py-0.5 text-[10px] text-warm-700">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                  <code className="flex-1 truncate rounded bg-warm-100 px-1.5 py-0.5 text-[11px] text-warm-700">
                    /k/{a.slug}
                  </code>
                  <button
                    onClick={() => copyShare(a)}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-warm-50"
                  >
                    <Share2 className="h-3.5 w-3.5" /> Share
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  <Link
                    to="/staff/product-knowledge"
                    className="inline-flex items-center justify-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium text-foreground hover:bg-warm-50"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Manage
                  </Link>
                  <Link
                    to="/staff/knowledge-translation"
                    search={{ from: a.id }}
                    className="inline-flex items-center justify-center gap-1 rounded-md border border-magenta-500/30 bg-magenta-50 px-2 py-1.5 text-xs font-semibold text-magenta-700 hover:bg-magenta-100"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Translate
                  </Link>
                  <Link
                    to="/staff/talent"
                    className="inline-flex items-center justify-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium text-foreground hover:bg-warm-50"
                  >
                    <UsersIcon className="h-3.5 w-3.5" /> Map Talent
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  title,
  desc,
  search,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  search?: Record<string, unknown>;
}) {
  return (
    <Link
      to={to}
      search={search as never}
      className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-magenta-500/40 hover:bg-warm-50"
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-magenta-50 text-magenta-600 group-hover:bg-magenta-100">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
        <span lang="th" className="block truncate text-[11px] text-muted-foreground">
          {desc}
        </span>
      </span>
    </Link>
  );
}
