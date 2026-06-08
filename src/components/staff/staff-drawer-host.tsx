import { useEffect, useRef, useState } from "react";
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
  Award,
  GraduationCap,
  Clock,
  Users as UsersIcon,
  Eye,
  Pencil,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useStaff } from "@/lib/staff-context";
import seed from "@/data/seed-data.json";
import { StaffCertificateModal } from "./staff-certificate-modal";
import { FunderExportModal } from "./funder-export-modal";

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

type LearningRecord = {
  id: string;
  personId: string;
  productId: string;
  progressPct: number;
};

type Certificate = {
  id: string;
  productId: string;
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
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    // Lock scroll and focus the close affordance
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => closeBtnRef.current?.focus(), 30);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [drawer, close]);

  if (!drawer) return null;

  // Certificate and Export render as centered modals, not side drawers
  if (drawer.kind === "certificate") {
    return <StaffCertificateModal certificateId={drawer.id} onClose={close} />;
  }
  if (drawer.kind === "export") {
    return <FunderExportModal onClose={close} />;
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-navy-900/40 backdrop-blur-sm"
      onClick={close}
      role="presentation"
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={drawer.kind === "asset" ? "Knowledge asset details" : "Product details"}
        tabIndex={-1}
        className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-warm-200 px-6 py-4">
          <p className="text-xs font-bold uppercase tracking-wider text-warm-500">
            {drawer.kind === "asset" && "Knowledge asset"}
            {drawer.kind === "product" && "Product"}
          </p>
          <button
            ref={closeBtnRef}
            onClick={close}
            aria-label="Close panel"
            className="rounded-pill p-1.5 text-warm-500 hover:bg-warm-100 hover:text-navy-500"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {drawer.kind === "asset" && <AssetDrawer id={drawer.id} onClose={close} />}
        {drawer.kind === "product" && <ProductDrawer id={drawer.id} />}
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
  const sc = seed.staffConsole as any;
  const navigate = useNavigate();
  const asset = (sc.knowledgeAssets as Asset[]).find((a) => a.id === id);

  if (!asset) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <Placeholder label="Asset not found" note="" />
      </div>
    );
  }

  const owner = sc.people.find((p: any) => p.id === asset.ownerId);
  const funder = sc.funders.find((f: any) => f.id === asset.funderId);
  const project = asset.projectId
    ? sc.projects.find((p: any) => p.id === asset.projectId)
    : undefined;
  const typeLabel = (sc.typeLabels as Record<string, string>)[asset.type] ?? asset.type;
  const domainLabel = (sc.domainLabels as Record<string, string>)[asset.domain] ?? asset.domain;
  const statusLabel = (sc.statusLabels as Record<string, string>)[asset.status] ?? asset.status;
  const sourceLabel = (sc.sourceLabels as Record<string, string>)[asset.source] ?? asset.source;

  const overdue =
    asset.nextReview !== null && new Date(asset.nextReview).getTime() < TODAY.getTime();

  const linkedProducts = sc.products.filter((p: any) =>
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
                {linkedProducts.map((p: any) => (
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

// ====================================================================
// Product Drawer
// ====================================================================

function ProductDrawer({ id }: { id: string }) {
  const sc = seed.staffConsole as any;
  const navigate = useNavigate();
  const { openAsset, openCertificate, close } = useStaff();
  const product = sc.products.find((p: any) => p.id === id);
  const [published, setPublished] = useState(product?.status === "published");

  if (!product) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <Placeholder label="Product not found" note="" />
      </div>
    );
  }

  const funder = sc.funders.find((f: any) => f.id === product.funderId);
  const records = (sc.learningRecords as LearningRecord[]).filter((r) => r.productId === product.id);
  const cert = (sc.certificates as Certificate[]).find((c) => c.productId === product.id);
  const sourceAssets = (product.sourceAssetIds ?? [])
    .map((aid: any) => sc.knowledgeAssets.find((a: any) => a.id === aid))
    .filter((a: any): a is NonNullable<typeof a> => Boolean(a));
  const modules = product.course?.modules ?? [];
  const totalMins = modules.reduce((sum: any, m: any) => sum + (m.durationMins ?? 0), 0);

  const openSourceAsset = (assetId: string) => {
    openAsset(assetId);
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="space-y-6">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-pill bg-lavender-100 px-2.5 py-0.5 text-xs font-semibold text-lavender-900 capitalize">
                {product.productType}
              </span>
              {product.hasCertificate && (
                <span className="inline-flex items-center gap-1 rounded-pill bg-gold/15 px-2.5 py-0.5 text-xs font-semibold text-gold">
                  <Award className="h-3 w-3" /> Certificate
                </span>
              )}
              <span
                className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold ${published ? "bg-success/15 text-success" : "bg-warm-200 text-warm-700"}`}
              >
                {published ? "Published" : "Draft"}
              </span>
            </div>
            <h2 className="text-2xl font-semibold leading-tight text-navy-500">{product.title}</h2>
            <p className="mt-2 text-sm text-warm-500">{product.summary}</p>
          </div>

          <dl className="grid grid-cols-2 gap-4 rounded-md border border-warm-200 bg-warm-50 p-4 text-sm">
            <Meta
              icon={<Tag className="h-3.5 w-3.5" />}
              label="Funder"
              value={funder?.shortName ?? "—"}
              color={funder?.color}
            />
            <Meta
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Published"
              value={product.publishedDate ? fmt(product.publishedDate) : "—"}
            />
            <Meta
              icon={<UsersIcon className="h-3.5 w-3.5" />}
              label="Audiences"
              value={product.audiences.join(", ") || "—"}
            />
            <Meta
              icon={<FileText className="h-3.5 w-3.5" />}
              label="Type"
              value={product.productType}
            />
          </dl>

          {product.course && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-warm-500">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Modules ({modules.length})
                </p>
                <p className="text-[11px] text-warm-500">
                  Pass {product.course.passThreshold}% · {totalMins} mins total
                </p>
              </div>
              <ol className="overflow-hidden rounded-md border border-warm-200">
                {modules.map((m: any, i: any) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 border-b border-warm-200 px-3 py-2.5 last:border-b-0"
                  >
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-lavender-100 text-[11px] font-semibold text-lavender-900">
                      {i + 1}
                    </span>
                    <p className="flex-1 truncate text-sm font-medium text-navy-500">
                      {m.title}
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs text-warm-500">
                      <Clock className="h-3 w-3" />
                      {m.durationMins}m
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {records.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-warm-500">
                Learner progress
              </p>
              <ul className="space-y-2">
                {records.slice(0, 4).map((r) => {
                  const person = sc.people.find((p: any) => p.id === r.personId);
                  return (
                    <li
                      key={r.id}
                      className="flex items-center gap-3 rounded-md border border-warm-200 px-3 py-2"
                    >
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-lavender-100 text-xs font-semibold text-lavender-900">
                        {person?.avatarInitial ?? "?"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-semibold text-navy-500">
                            {person?.name ?? "—"}
                          </p>
                          <span className="text-[11px] font-semibold text-warm-500">
                            {r.progressPct}%
                          </span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-pill bg-warm-100">
                          <div
                            className="h-full bg-magenta-500"
                            style={{ width: `${r.progressPct}%` }}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {sourceAssets.length > 0 && (
            <section>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-warm-500">
                <Package className="h-3.5 w-3.5" />
                Source knowledge assets
              </p>
              <ul className="divide-y divide-warm-200 overflow-hidden rounded-md border border-warm-200">
                {sourceAssets.map((a: any) => (
                  <li key={a.id}>
                    <button
                      onClick={() => {
                        close();
                        navigate({ to: "/staff/knowledge" });
                        setTimeout(() => openSourceAsset(a.id), 50);
                      }}
                      className="group flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-warm-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-navy-500 group-hover:text-magenta-500">
                          {a.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-warm-500">
                          v{a.version.replace(/^v/, "")}
                        </p>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-warm-400 group-hover:text-magenta-500" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {product.hasCertificate && cert && (
            <section>
              <button
                onClick={() => openCertificate(cert.id)}
                className="inline-flex items-center gap-2 rounded-pill border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/20"
              >
                <Eye className="h-4 w-4" />
                Preview certificate
              </button>
            </section>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-warm-200 bg-warm-50 px-6 py-4">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-navy-500">
          <span className="text-warm-500">Published</span>
          <span
            onClick={() => setPublished((v) => !v)}
            className={`relative inline-block h-5 w-9 rounded-pill transition-colors ${published ? "bg-success" : "bg-warm-300"}`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-pill bg-white shadow transition-all ${published ? "left-4" : "left-0.5"}`}
            />
          </span>
        </label>
        <button className="inline-flex items-center gap-2 rounded-pill bg-magenta-500 px-4 py-2 text-sm font-semibold text-white hover:bg-magenta-700">
          Edit product
        </button>
      </div>
    </>
  );
}

