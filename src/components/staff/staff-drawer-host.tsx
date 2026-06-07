import { X, FileText, Tag, User, Calendar, Layers, Languages } from "lucide-react";
import { useStaff } from "@/lib/staff-context";
import seed from "@/data/seed-data.json";

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

const statusTone: Record<string, string> = {
  published: "bg-success/15 text-success",
  draft: "bg-warm-200 text-warm-700",
  in_review: "bg-gold/15 text-gold",
  archived: "bg-warm-100 text-warm-500",
};

export function StaffDrawerHost() {
  const { drawer, close } = useStaff();
  if (!drawer) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-navy-900/40 backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      <aside
        className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-warm-200 px-6 py-4">
          <p className="text-xs font-bold uppercase tracking-wider text-warm-500">
            {drawer.kind === "asset" && "Knowledge asset"}
            {drawer.kind === "product" && "Product"}
            {drawer.kind === "certificate" && "Certificate"}
            {drawer.kind === "export" && "Export"}
          </p>
          <button
            onClick={close}
            aria-label="Close"
            className="rounded-pill p-1.5 text-warm-500 hover:bg-warm-100 hover:text-navy-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {drawer.kind === "asset" && <AssetBody id={drawer.id} />}
          {drawer.kind === "product" && (
            <Placeholder label={`Product ${drawer.id}`} note="Product detail coming next." />
          )}
          {drawer.kind === "certificate" && (
            <Placeholder label={`Certificate ${drawer.id}`} note="Certificate detail coming next." />
          )}
          {drawer.kind === "export" && (
            <Placeholder label="Export center" note="Bundle assets, products and certificates for funders." />
          )}
        </div>
      </aside>
    </div>
  );
}

function Placeholder({ label, note }: { label: string; note: string }) {
  return (
    <div className="rounded-md border border-dashed border-warm-200 p-6 text-center">
      <p className="text-sm font-semibold text-navy-500">{label}</p>
      <p className="mt-1 text-xs text-warm-500">{note}</p>
    </div>
  );
}

function AssetBody({ id }: { id: string }) {
  const sc = seed.staffConsole;
  const asset = (sc.knowledgeAssets as Asset[]).find((a) => a.id === id);
  if (!asset) return <Placeholder label="Asset not found" note="" />;

  const owner = sc.people.find((p) => p.id === asset.ownerId);
  const funder = sc.funders.find((f) => f.id === asset.funderId);
  const typeLabel = (sc.typeLabels as Record<string, string>)[asset.type] ?? asset.type;
  const domainLabel = (sc.domainLabels as Record<string, string>)[asset.domain] ?? asset.domain;
  const statusLabel = (sc.statusLabels as Record<string, string>)[asset.status] ?? asset.status;
  const sourceLabel = (sc.sourceLabels as Record<string, string>)[asset.source] ?? asset.source;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold ${statusTone[asset.status]}`}>
            {statusLabel}
          </span>
          <span className="inline-flex items-center rounded-pill bg-lavender-100 px-2.5 py-0.5 text-xs font-semibold text-lavender-900">
            {typeLabel}
          </span>
          <span className="inline-flex items-center rounded-pill bg-warm-100 px-2.5 py-0.5 text-xs font-semibold text-warm-700">
            v{asset.version.replace(/^v/, "")}
          </span>
        </div>
        <h2 className="text-2xl font-semibold leading-tight text-navy-500">{asset.title}</h2>
        <p className="mt-2 text-sm text-warm-500">{asset.summary}</p>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-md border border-warm-200 bg-warm-50 p-4 text-sm">
        <Meta icon={<Layers className="h-3.5 w-3.5" />} label="Domain" value={domainLabel} />
        <Meta icon={<FileText className="h-3.5 w-3.5" />} label="Source" value={sourceLabel} />
        <Meta icon={<User className="h-3.5 w-3.5" />} label="Owner" value={owner ? `${owner.name} · ${owner.role}` : "—"} />
        <Meta icon={<Tag className="h-3.5 w-3.5" />} label="Funder" value={funder?.shortName ?? "—"} />
        <Meta icon={<Languages className="h-3.5 w-3.5" />} label="Language" value={asset.language} />
        <Meta
          icon={<Calendar className="h-3.5 w-3.5" />}
          label="Next review"
          value={asset.nextReview ?? "—"}
        />
      </dl>

      {asset.tags.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-warm-500">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {asset.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-pill border border-warm-200 bg-white px-2.5 py-0.5 text-xs font-medium text-warm-700"
              >
                #{t}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button className="inline-flex items-center gap-2 rounded-pill bg-magenta-500 px-4 py-2 text-sm font-semibold text-white hover:bg-magenta-700">
          Open file
        </button>
        <button className="inline-flex items-center gap-2 rounded-pill border border-warm-200 bg-white px-4 py-2 text-sm font-semibold text-navy-500 hover:border-magenta-500">
          Edit metadata
        </button>
      </div>
    </div>
  );
}

function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-warm-500">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-navy-500">{value}</dd>
    </div>
  );
}
