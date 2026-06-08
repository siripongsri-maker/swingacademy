import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  GitBranch,
  Package,
  Award,
  AlertTriangle,
  Clock,
  Inbox,
  ArrowRight,
} from "lucide-react";
import { useStaff } from "@/lib/staff-context";
import seed from "@/data/seed-data.json";

export const Route = createFileRoute("/staff/dashboard")({
  component: StaffDashboard,
});

type Asset = {
  id: string;
  title: string;
  type: string;
  source: string;
  ownerId: string;
  status: string;
  nextReview: string | null;
  updatedAt: string;
};

type KtJourney = {
  id: string;
  personId: string;
  learned: string;
  stages: { key: string; status: string }[];
  sustainability: { nextReview: string | null; ownerId: string };
};

const TODAY = new Date("2026-06-07");
const THIRTY_DAYS = 1000 * 60 * 60 * 24 * 30;

function StaffDashboard() {
  const sc = seed.staffConsole as any;
  const { openAsset } = useStaff();

  const assets = sc.knowledgeAssets as Asset[];
  const products = sc.products;
  const certificates = sc.certificates;
  const journeys = sc.ktJourneys as KtJourney[];
  const people = sc.people;

  const personById = (id: string) => people.find((p) => p.id === id);

  // Recent updates — last 6 by updatedAt
  const recent = [...assets]
    .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1))
    .slice(0, 6);

  // At-risk KT journeys: any stage stuck on "doing" or "waiting" after capture is done
  const atRisk = journeys.filter((j) => {
    const apply = j.stages.find((s) => s.key === "apply");
    const transfer = j.stages.find((s) => s.key === "transfer");
    return (
      (transfer?.status !== "done" && j.stages.some((s) => s.key === "capture" && s.status === "done")) ||
      apply?.status === "waiting"
    );
  });

  // Needs review soon: published assets past nextReview, or within 30 days
  const needsReview = assets
    .filter((a) => a.nextReview)
    .map((a) => ({ asset: a, due: new Date(a.nextReview as string).getTime() - TODAY.getTime() }))
    .filter(({ due }) => due < THIRTY_DAYS)
    .sort((a, b) => a.due - b.due);

  // Pending transfer: received assets not yet in a transferred journey
  const transferredAssetIds = new Set(
    journeys
      .filter((j) => j.stages.find((s) => s.key === "transfer")?.status === "done")
      .flatMap((j) => [j.id])
  );
  // simpler: received assets with status draft or in_review
  const pendingTransfer = assets.filter(
    (a) => a.source === "received" && a.status !== "published"
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-warm-500">Dashboard</p>
        <h1 className="mt-1 text-3xl font-semibold text-navy-500">Knowledge program overview</h1>
        <p className="mt-1 text-sm text-warm-500">
          A snapshot of what your team has captured, transferred, and shipped.
        </p>
      </div>

      {/* Pillar stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PillarCard
          icon={<BookOpen className="h-5 w-5" />}
          accent="#CC0099"
          label="Knowledge assets"
          value={assets.length}
          sub={`${assets.filter((a) => a.status === "published").length} published`}
        />
        <PillarCard
          icon={<GitBranch className="h-5 w-5" />}
          accent="#7A6FC4"
          label="KT journeys"
          value={journeys.length}
          sub={`${atRisk.length} need attention`}
        />
        <PillarCard
          icon={<Package className="h-5 w-5" />}
          accent="#1F8A5B"
          label="Products"
          value={products.length}
          sub={`${products.filter((p) => p.status === "published").length} live`}
        />
        <PillarCard
          icon={<Award className="h-5 w-5" />}
          accent="#C9A227"
          label="Certificates"
          value={certificates.length}
          sub="issued to staff & partners"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent updates */}
        <Panel
          title="Recent updates"
          subtitle="Latest changes across the KM library"
          className="lg:col-span-2"
        >
          <ul className="divide-y divide-warm-200">
            {recent.map((a) => {
              const owner = personById(a.ownerId);
              const typeLabel = (sc.typeLabels as Record<string, string>)[a.type] ?? a.type;
              return (
                <li key={a.id}>
                  <button
                    onClick={() => openAsset(a.id)}
                    className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-warm-50"
                  >
                    <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-lavender-100 text-lavender-900">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-navy-500">{a.title}</p>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-warm-400 transition-transform group-hover:translate-x-0.5 group-hover:text-magenta-500" />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-warm-500">
                        {typeLabel} · {owner?.name ?? "—"} · updated {fmt(a.updatedAt)}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        {/* At-risk KT journeys */}
        <Panel
          title="At-risk KT journeys"
          subtitle="Transfer or apply stages stalled"
          accent="#C53030"
          icon={<AlertTriangle className="h-4 w-4" />}
        >
          {atRisk.length === 0 ? (
            <EmptyRow text="All journeys on track." />
          ) : (
            <ul className="divide-y divide-warm-200">
              {atRisk.map((j) => {
                const owner = personById(j.personId);
                const stuck = j.stages.find((s) => s.status === "doing" || s.status === "waiting");
                return (
                  <li key={j.id} className="px-4 py-3">
                    <p className="line-clamp-2 text-sm font-semibold text-navy-500">{j.learned}</p>
                    <p className="mt-0.5 text-xs text-warm-500">
                      {owner?.name ?? "—"} · stuck at <span className="font-medium">{stuck?.key ?? "—"}</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Needs review */}
        <Panel
          title="Needs review soon"
          subtitle="Past or within 30 days of next review"
          accent="#F0A118"
          icon={<Clock className="h-4 w-4" />}
        >
          {needsReview.length === 0 ? (
            <EmptyRow text="No reviews due." />
          ) : (
            <ul className="divide-y divide-warm-200">
              {needsReview.map(({ asset, due }) => {
                const overdue = due < 0;
                return (
                  <li key={asset.id}>
                    <button
                      onClick={() => openAsset(asset.id)}
                      className="flex w-full flex-col items-start px-4 py-3 text-left transition-colors hover:bg-warm-50"
                    >
                      <p className="line-clamp-2 text-sm font-semibold text-navy-500">
                        {asset.title}
                      </p>
                      <p className="mt-0.5 text-xs text-warm-500">
                        <span className={overdue ? "font-semibold text-danger" : ""}>
                          {overdue ? "Overdue · " : "Due "}
                          {fmt(asset.nextReview as string)}
                        </span>
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Pending transfer */}
        <Panel
          title="Pending transfer"
          subtitle="Received assets not yet shared with the team"
          accent="#7A6FC4"
          icon={<Inbox className="h-4 w-4" />}
          className="lg:col-span-2"
        >
          {pendingTransfer.length === 0 ? (
            <EmptyRow text="Inbox clear." />
          ) : (
            <ul className="divide-y divide-warm-200">
              {pendingTransfer.map((a) => {
                const owner = personById(a.ownerId);
                const statusLabel = (sc.statusLabels as Record<string, string>)[a.status] ?? a.status;
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => openAsset(a.id)}
                      className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-warm-50"
                    >
                      <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-lavender-100 text-lavender-900">
                        <Inbox className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-navy-500">
                            {a.title}
                          </p>
                          <span className="inline-flex shrink-0 items-center rounded-pill bg-gold/15 px-2 py-0.5 text-[11px] font-semibold text-gold">
                            {statusLabel}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-warm-500">
                          Captured by {owner?.name ?? "—"} · received
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function PillarCard({
  icon,
  accent,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  accent: string;
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-warm-200 bg-white shadow-sm">
      <div className="h-1 w-full" style={{ backgroundColor: accent }} aria-hidden />
      <div className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-warm-500">{label}</span>
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-md"
            style={{ backgroundColor: `${accent}1A`, color: accent }}
          >
            {icon}
          </span>
        </div>
        <p className="mt-3 text-3xl font-semibold text-navy-500">{value}</p>
        <p className="mt-1 text-xs text-warm-500">{sub}</p>
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  className = "",
  accent,
  icon,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
  accent?: string;
  icon?: React.ReactNode;
}) {
  return (
    <section
      className={`overflow-hidden rounded-lg border border-warm-200 bg-white shadow-sm ${className}`}
    >
      <header className="flex items-start gap-3 border-b border-warm-200 px-5 py-4">
        {icon && (
          <span
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: accent ? `${accent}1A` : "#EFECF9", color: accent ?? "#4C4293" }}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-navy-500">{title}</h2>
          <p className="mt-0.5 text-xs text-warm-500">{subtitle}</p>
        </div>
      </header>
      <div className="max-h-96 overflow-y-auto">{children}</div>
    </section>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-4 py-6 text-center text-sm text-warm-500">{text}</p>;
}

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}
