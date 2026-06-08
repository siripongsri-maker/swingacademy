import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Search,
  BookOpen,
  FileText,
  Wrench,
  ClipboardList,
  Megaphone,
  StickyNote,
  Database,
  Scale,
  Image as ImageIcon,
  Video,
  GraduationCap,
  AlertTriangle,
} from "lucide-react";
import { useStaff } from "@/lib/staff-context";
import seed from "@/data/seed-data.json";
import { LessonUploadCard } from "@/components/lesson-upload-card";

export const Route = createFileRoute("/staff/knowledge")({
  component: KnowledgeLibrary,
});

type Asset = {
  id: string;
  title: string;
  type: string;
  domain: string;
  source: string;
  ownerId: string;
  funderId: string;
  language: string;
  status: string;
  version: string;
  lastReviewed: string | null;
  nextReview: string | null;
  summary: string;
  tags: string[];
  updatedAt: string;
};

const typeIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  curriculum: GraduationCap,
  sop: ClipboardList,
  toolkit: Wrench,
  brief: FileText,
  media: Megaphone,
  note: StickyNote,
  dataset: Database,
  policy: Scale,
  infographic: ImageIcon,
  video: Video,
  course: BookOpen,
};

const statusTone: Record<string, string> = {
  published: "bg-success/15 text-success",
  draft: "bg-warm-200 text-warm-700",
  in_review: "bg-gold/15 text-gold",
  archived: "bg-warm-100 text-warm-500",
};

const TODAY = new Date("2026-06-07");

function KnowledgeLibrary() {
  const sc = seed.staffConsole;
  const assets = sc.knowledgeAssets as Asset[];
  const { openAsset } = useStaff();

  const [q, setQ] = useState("");
  const [source, setSource] = useState<string>("all");
  const [funderId, setFunderId] = useState<string>("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return assets.filter((a) => {
      if (source !== "all" && a.source !== source) return false;
      if (funderId !== "all" && a.funderId !== funderId) return false;
      if (!needle) return true;
      return (
        a.title.toLowerCase().includes(needle) ||
        a.tags.some((t) => t.toLowerCase().includes(needle))
      );
    });
  }, [assets, q, source, funderId]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-warm-500">KM Library</p>
        <h1 className="mt-1 text-3xl font-semibold text-navy-500">Knowledge assets</h1>
        <p className="mt-1 text-sm text-warm-500">
          Curricula, SOPs, toolkits and reports — produced by SWING or received from partners.
        </p>
      </div>

      {/* Search + filters */}
      <div className="space-y-3 rounded-lg border border-warm-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title or tag…"
            className="w-full rounded-pill border border-warm-200 bg-warm-50 py-2.5 pl-10 pr-4 text-sm text-navy-500 placeholder:text-warm-400 focus:border-magenta-500 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <FilterGroup label="Source">
            <Chip active={source === "all"} onClick={() => setSource("all")}>All</Chip>
            {Object.entries(sc.sourceLabels as Record<string, string>).map(([k, v]) => (
              <Chip key={k} active={source === k} onClick={() => setSource(k)}>{v}</Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Funder">
            <Chip active={funderId === "all"} onClick={() => setFunderId("all")}>All</Chip>
            {sc.funders.map((f) => (
              <Chip
                key={f.id}
                active={funderId === f.id}
                onClick={() => setFunderId(f.id)}
                color={f.color}
              >
                {f.shortName}
              </Chip>
            ))}
          </FilterGroup>
        </div>
      </div>

      <p className="text-xs text-warm-500">
        Showing <span className="font-semibold text-navy-500">{filtered.length}</span> of {assets.length}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-warm-200 bg-white p-12 text-center">
          <p className="text-sm font-semibold text-navy-500">No matching assets</p>
          <p className="mt-1 text-xs text-warm-500">Try a different search or clear the filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => (
            <KnowledgeCard key={a.id} asset={a} onOpen={() => openAsset(a.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-wider text-warm-500">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
  color,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  const style =
    active && color
      ? { backgroundColor: color, color: "#fff", borderColor: color }
      : active
      ? undefined
      : color
      ? { borderColor: `${color}55`, color }
      : undefined;
  return (
    <button
      onClick={onClick}
      style={style}
      className={`rounded-pill border px-3 py-1 text-xs font-semibold transition-colors ${
        active && !color
          ? "border-magenta-500 bg-magenta-500 text-white"
          : !active && !color
          ? "border-warm-200 bg-white text-warm-700 hover:border-magenta-500"
          : "bg-white hover:opacity-80"
      }`}
    >
      {children}
    </button>
  );
}

function KnowledgeCard({ asset, onOpen }: { asset: Asset; onOpen: () => void }) {
  const sc = seed.staffConsole;
  const owner = sc.people.find((p) => p.id === asset.ownerId);
  const funder = sc.funders.find((f) => f.id === asset.funderId);
  const typeLabel = (sc.typeLabels as Record<string, string>)[asset.type] ?? asset.type;
  const statusLabel = (sc.statusLabels as Record<string, string>)[asset.status] ?? asset.status;
  const Icon = typeIcon[asset.type] ?? FileText;

  const overdue =
    asset.nextReview !== null && new Date(asset.nextReview).getTime() < TODAY.getTime();

  return (
    <button
      onClick={onOpen}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-warm-200 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-magenta-500 hover:shadow-md"
    >
      <div className="h-1 w-full" style={{ backgroundColor: funder?.color ?? "#7A6FC4" }} aria-hidden />
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded-md"
            style={{
              backgroundColor: `${funder?.color ?? "#7A6FC4"}1A`,
              color: funder?.color ?? "#7A6FC4",
            }}
          >
            <Icon className="h-5 w-5" />
          </span>
          <span
            className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-[11px] font-semibold ${statusTone[asset.status]}`}
          >
            {statusLabel}
          </span>
        </div>

        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-navy-500 group-hover:text-magenta-500">
          {asset.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-xs text-warm-500">{asset.summary}</p>

        {overdue && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-pill bg-danger/10 px-2.5 py-1 text-[11px] font-semibold text-danger">
            <AlertTriangle className="h-3 w-3" />
            Overdue for review
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center rounded-pill bg-lavender-100 px-2.5 py-0.5 text-[11px] font-semibold text-lavender-900">
            {typeLabel}
          </span>
          {funder && (
            <span
              className="inline-flex items-center rounded-pill px-2.5 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: `${funder.color}1A`, color: funder.color }}
            >
              {funder.shortName}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-center gap-2 pt-4">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-pill bg-warm-100 text-[11px] font-semibold text-navy-500"
            aria-hidden
          >
            {owner?.avatarInitial ?? "?"}
          </span>
          <span className="truncate text-xs text-warm-500">
            {owner?.name ?? "—"} <span className="text-warm-400">· v{asset.version.replace(/^v/, "")}</span>
          </span>
        </div>
      </div>
    </button>
  );
}
