import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  GraduationCap,
  Wrench,
  FileText,
  Image as ImageIcon,
  Megaphone,
  Award,
} from "lucide-react";
import { useStaff } from "@/lib/staff-context";
import seed from "@/data/seed-data.json";

export const Route = createFileRoute("/staff/products")({
  component: ProductsPage,
});

type Product = (typeof seed.staffConsole.products)[number];

const productIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  course: GraduationCap,
  toolkit: Wrench,
  brief: FileText,
  media: Megaphone,
  infographic: ImageIcon,
};

const statusTone: Record<string, string> = {
  published: "bg-success/15 text-success",
  draft: "bg-warm-200 text-warm-700",
  in_review: "bg-gold/15 text-gold",
  archived: "bg-warm-100 text-warm-500",
};

type TabKey = "all" | "course" | "published" | "cert";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "course", label: "Courses" },
  { key: "published", label: "Published" },
  { key: "cert", label: "Has certificate" },
];

function ProductsPage() {
  const sc = seed.staffConsole;
  const { openProduct } = useStaff();
  const [tab, setTab] = useState<TabKey>("all");

  const filtered = useMemo(() => {
    return (sc.products as Product[]).filter((p) => {
      if (tab === "course") return p.productType === "course";
      if (tab === "published") return p.status === "published";
      if (tab === "cert") return Boolean(p.hasCertificate);
      return true;
    });
  }, [sc.products, tab]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-warm-500">Products</p>
        <h1 className="mt-1 text-3xl font-semibold text-navy-500">Knowledge products</h1>
        <p className="mt-1 text-sm text-warm-500">
          Courses, toolkits, briefs and media packaged from KM assets.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-pill border border-warm-200 bg-white p-1 shadow-sm w-fit">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-pill px-4 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "bg-magenta-500 text-white"
                  : "text-warm-700 hover:text-navy-500"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-warm-200 bg-white p-12 text-center">
          <p className="text-sm font-semibold text-navy-500">No products in this view</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} onOpen={() => openProduct(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, onOpen }: { product: Product; onOpen: () => void }) {
  const sc = seed.staffConsole;
  const funder = sc.funders.find((f) => f.id === product.funderId);
  const Icon = productIcon[product.productType] ?? FileText;
  const statusLabel =
    (sc.statusLabels as Record<string, string>)[product.status] ?? product.status;

  return (
    <button
      onClick={onOpen}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-warm-200 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-magenta-500 hover:shadow-md"
    >
      <div className="h-1 w-full" style={{ backgroundColor: funder?.color ?? "#7A6FC4" }} />
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
            className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-[11px] font-semibold ${statusTone[product.status]}`}
          >
            {statusLabel}
          </span>
        </div>

        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-navy-500 group-hover:text-magenta-500">
          {product.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-xs text-warm-500">{product.summary}</p>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center rounded-pill bg-lavender-100 px-2.5 py-0.5 text-[11px] font-semibold text-lavender-900 capitalize">
            {product.productType}
          </span>
          {product.hasCertificate && (
            <span className="inline-flex items-center gap-1 rounded-pill bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-gold">
              <Award className="h-3 w-3" /> Certificate
            </span>
          )}
          {funder && (
            <span
              className="inline-flex items-center rounded-pill px-2.5 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: `${funder.color}1A`, color: funder.color }}
            >
              {funder.shortName}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
