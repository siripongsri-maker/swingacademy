import { useEffect } from "react";
import {
  X,
  FileText,
  Tag,
  User,
  Calendar,
  Layers,
  Languages,
  AlertTriangle,
  Package,
  ExternalLink,
  Pencil,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
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
  projectId?: string;
  language: string;
  status: string;
  version: string;
  lastReviewed: string | null;
  nextReview: string | null;
  summary: string;
  tags: string[];
  updatedAt: string;
  fileUrl?: string;
};

const statusTone: Record<string, string> = {
  published: "bg-success/15 text-success",
  draft: "bg-warm-200 text-warm-700",
  in_review: "bg-gold/15 text-gold",
  archived: "bg-warm-100 text-warm-500",
};

const TODAY = new Date("2026-06-07");

export function StaffDrawerHost() {
  const { drawer, close } = useStaff();

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer, close]);

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

        {drawer.kind === "asset" ? (
          <AssetDrawer id={drawer.id} onClose={close} />
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <Placeholder
              label={
                drawer.kind === "product"
                  ? `Product ${drawer.id}`
                  : drawer.kind === "certificate"
                  ? `Certificate ${drawer.id}`
                  : "Export center"
              }
              note="Coming next."
            />
          </div>
        )}
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

function AssetDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const sc = seed.staffConsole;
  const navigate = useNavigate();
  const asset = (sc.knowledgeAssets as Asset[]).find((a) => a.id === id);

  if (!asset) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <Placeholder label="Asset not found" note="" />
      </div>
    );
  }

  const owner = sc.people.find((p) => p.id === asset.ownerId);
  const funder = sc.funders.find((f) => f.id === asset.funderId);
  const project = asset.projectId
    ? sc.projects.find((p) => p.id === asset.projectId)
    : undefined;
  const typeLabel = (sc.typeLabels as Record<string, string>)[asset.type] ?? asset.type;
  const domainLabel = (sc.domainLabels as Record<string, string>)[asset.domain] ?? asset.domain;
  const statusLabel = (sc.statusLabels as Record<string, string>)[asset.status] ?? asset.status;
  const sourceLabel = (sc.sourceLabels as Record<string, string>)[asset.source] ?? asset.source;

  const overdue =
    asset.nextReview !== null && new Date(asset.nextReview).getTime() < TODAY.getTime();

  const linkedProducts = sc.products.filter((p) =>
    (p.sourceAssetIds ?? []).includes(asset.id),
  );

  const { openProduct } = useStaff();

  const goToProduct = (productId: string) => {
    onClose();
    navigate({ to: "/staff/products" });
    // also open the product drawer for context
    setTimeout(() => openProduct(productId), 50);
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="space-y-6">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold ${statusTone[asset.status]}`}
              >
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

            {overdue && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                <div className="text-xs">
                  <p className="font-semibold text-danger">Overdue for review</p>
                  <p className="mt-0.5 text-danger/80">
                    Next review was {fmt(asset.nextReview as string)}. Consider revisiting with the owner.
                  </p>
                </div>
              </div>
            )}

            <p className="mt-3 text-sm text-warm-500">{asset.summary}</p>
          </div>

          <dl className="grid grid-cols-2 gap-4 rounded-md border border-warm-200 bg-warm-50 p-4 text-sm">
            <Meta
              icon={<User className="h-3.5 w-3.5" />}
              label="Owner"
              value={owner ? `${owner.name} · ${owner.role}` : "—"}
            />
            <Meta
              icon={<Tag className="h-3.5 w-3.5" />}
              label="Funder"
              value={funder?.shortName ?? "—"}
              color={funder?.color}
            />
            <Meta icon={<Layers className="h-3.5 w-3.5" />} label="Domain" value={domainLabel} />
            <Meta icon={<FileText className="h-3.5 w-3.5" />} label="Source" value={sourceLabel} />
            <Meta
              icon={<Languages className="h-3.5 w-3.5" />}
              label="Language"
              value={asset.language.toUpperCase()}
            />
            <Meta
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Last reviewed"
              value={asset.lastReviewed ? fmt(asset.lastReviewed) : "—"}
            />
            <Meta
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Next review"
              value={asset.nextReview ? fmt(asset.nextReview) : "—"}
            />
          </dl>

          {funder && project && (
            <section className="rounded-md border border-warm-200 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-warm-500">
                Funder project
              </p>
              <p className="mt-1 text-sm font-semibold text-navy-500">{project.name}</p>
              <p className="mt-0.5 text-xs text-warm-500">
                {fmt(project.periodStart)} → {fmt(project.periodEnd)}
              </p>
              <p
                className="mt-2 border-l-2 pl-3 text-xs leading-relaxed text-warm-700"
                style={{ borderColor: funder.color }}
              >
                {funder.purpose}
              </p>
            </section>
          )}

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

          <section>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-warm-500">
              <Package className="h-3.5 w-3.5" />
              Knowledge products built from this asset
            </p>
            {linkedProducts.length === 0 ? (
              <p className="rounded-md border border-dashed border-warm-200 px-3 py-4 text-center text-xs text-warm-500">
                No products yet.
              </p>
            ) : (
              <ul className="divide-y divide-warm-200 overflow-hidden rounded-md border border-warm-200">
                {linkedProducts.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => goToProduct(p.id)}
                      className="group flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-warm-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-navy-500 group-hover:text-magenta-500">
                          {p.title}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-warm-500">
                          {p.productType} · {p.status}
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-warm-400 transition-transform group-hover:translate-x-0.5 group-hover:text-magenta-500" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-warm-200 bg-warm-50 px-6 py-4">
        <a
          href={asset.fileUrl || "#"}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-pill bg-magenta-500 px-4 py-2 text-sm font-semibold text-white hover:bg-magenta-700"
        >
          <ExternalLink className="h-4 w-4" />
          Open file (Drive)
        </a>
        <button className="inline-flex items-center gap-2 rounded-pill border border-warm-200 bg-white px-4 py-2 text-sm font-semibold text-navy-500 hover:border-magenta-500">
          <Pencil className="h-4 w-4" />
          Edit
        </button>
      </div>
    </>
  );
}

function Meta({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-warm-500">
        {icon}
        {label}
      </dt>
      <dd
        className="mt-1 text-sm font-medium"
        style={{ color: color ?? undefined }}
      >
        <span className={color ? "" : "text-navy-500"}>{value}</span>
      </dd>
    </div>
  );
}

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
