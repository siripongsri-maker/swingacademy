import { useEffect, useMemo, useState } from "react";
import { X, FileSpreadsheet, FileDown, Package } from "lucide-react";
import seed from "@/data/seed-data.json";

type Props = { onClose: () => void };

type View = "assets" | "products";

export function FunderExportModal({ onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sc = seed.staffConsole;
  const [funderId, setFunderId] = useState<string>(sc.funders[0]?.id ?? "");
  const [view, setView] = useState<View>("assets");

  const funder = sc.funders.find((f) => f.id === funderId);

  const assets = useMemo(
    () => sc.knowledgeAssets.filter((a) => a.funderId === funderId),
    [sc.knowledgeAssets, funderId],
  );
  const products = useMemo(
    () => sc.products.filter((p) => p.funderId === funderId),
    [sc.products, funderId],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-warm-200 px-6 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-warm-500">
              Funder export
            </p>
            <h2 className="text-lg font-semibold text-navy-500">Bundle by funder</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-pill p-1.5 text-warm-500 hover:bg-warm-100 hover:text-navy-500"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 border-b border-warm-200 px-6 py-4">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-warm-500">
              Funder
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sc.funders.map((f) => {
                const active = f.id === funderId;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFunderId(f.id)}
                    style={
                      active
                        ? { backgroundColor: f.color, color: "#fff", borderColor: f.color }
                        : { borderColor: `${f.color}55`, color: f.color }
                    }
                    className="rounded-pill border bg-white px-3 py-1 text-xs font-semibold transition-colors"
                  >
                    {f.shortName}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="inline-flex rounded-pill border border-warm-200 bg-warm-50 p-1">
            {(["assets", "products"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-pill px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                  view === v ? "bg-white text-navy-500 shadow-sm" : "text-warm-500"
                }`}
              >
                {v} ({v === "assets" ? assets.length : products.length})
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {view === "assets" ? (
            <Table headers={["Title", "Type", "Status", "Version", "Updated"]}>
              {assets.length === 0 ? (
                <EmptyRow colSpan={5} />
              ) : (
                assets.map((a) => (
                  <tr key={a.id} className="hover:bg-warm-50">
                    <td className="px-3 py-2 text-sm font-medium text-navy-500">{a.title}</td>
                    <td className="px-3 py-2 text-xs text-warm-700">
                      {(sc.typeLabels as Record<string, string>)[a.type] ?? a.type}
                    </td>
                    <td className="px-3 py-2 text-xs text-warm-700">
                      {(sc.statusLabels as Record<string, string>)[a.status] ?? a.status}
                    </td>
                    <td className="px-3 py-2 text-xs text-warm-500">{a.version}</td>
                    <td className="px-3 py-2 text-xs text-warm-500">{fmt(a.updatedAt)}</td>
                  </tr>
                ))
              )}
            </Table>
          ) : (
            <Table headers={["Title", "Type", "Status", "Cert", "Published"]}>
              {products.length === 0 ? (
                <EmptyRow colSpan={5} />
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-warm-50">
                    <td className="px-3 py-2 text-sm font-medium text-navy-500">{p.title}</td>
                    <td className="px-3 py-2 text-xs text-warm-700 capitalize">{p.productType}</td>
                    <td className="px-3 py-2 text-xs text-warm-700">
                      {(sc.statusLabels as Record<string, string>)[p.status] ?? p.status}
                    </td>
                    <td className="px-3 py-2 text-xs text-warm-700">
                      {p.hasCertificate ? "Yes" : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-warm-500">
                      {p.publishedDate ? fmt(p.publishedDate) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </Table>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-warm-200 bg-warm-50 px-6 py-4">
          <p className="inline-flex items-center gap-1.5 text-xs text-warm-500">
            <Package className="h-3.5 w-3.5" />
            {funder?.name ?? "—"}
          </p>
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-2 rounded-pill border border-warm-200 bg-white px-4 py-2 text-sm font-semibold text-navy-500 hover:border-magenta-500">
              <FileDown className="h-4 w-4" /> Export CSV
            </button>
            <button className="inline-flex items-center gap-2 rounded-pill bg-magenta-500 px-4 py-2 text-sm font-semibold text-white hover:bg-magenta-700">
              <FileSpreadsheet className="h-4 w-4" /> Export Excel
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Table({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-warm-200">
      <table className="w-full">
        <thead className="bg-warm-50 text-left text-[11px] font-bold uppercase tracking-wider text-warm-500">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-warm-200">{children}</tbody>
      </table>
    </div>
  );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-xs text-warm-500">
        Nothing to export for this funder.
      </td>
    </tr>
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
