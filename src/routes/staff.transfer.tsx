import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Inbox,
  ClipboardList,
  Package as PackageIcon,
  Share2,
  PlayCircle,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  User,
  ShieldAlert,
  Calendar,
  GitBranch,
} from "lucide-react";
import seed from "@/data/seed-data.json";

export const Route = createFileRoute("/staff/transfer")({
  component: TransferPage,
});

type Stage = {
  key: string;
  label: string;
  description: string;
  status: "done" | "doing" | "waiting";
  completedDate?: string;
};

type Journey = {
  id: string;
  personId: string;
  learned: string;
  source: string;
  stages: Stage[];
  sustainability: {
    ownerId: string;
    backupOwner: string;
    version: string;
    lastReviewed: string | null;
    nextReview: string | null;
    reviewCycleMonths: number;
  };
};

const STAGE_ORDER = ["acquire", "capture", "package", "transfer", "apply", "sustain"] as const;

const STAGE_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  acquire: { label: "Acquire", icon: Inbox },
  capture: { label: "Capture", icon: ClipboardList },
  package: { label: "Package", icon: PackageIcon },
  transfer: { label: "Transfer", icon: Share2 },
  apply: { label: "Apply", icon: PlayCircle },
  sustain: { label: "Sustain", icon: RefreshCw },
};

const STATUS_COLORS = {
  done: { bg: "#1F8A5B", soft: "rgba(31, 138, 91, 0.15)", text: "#1F8A5B", label: "Done" },
  doing: { bg: "#7A6FC4", soft: "rgba(122, 111, 196, 0.18)", text: "#4C4293", label: "In progress" },
  waiting: { bg: "#D6D2CC", soft: "rgba(214, 210, 204, 0.4)", text: "#6E665E", label: "Waiting" },
} as const;

const TODAY = new Date("2026-06-07");

function isAtRisk(j: Journey): { atRisk: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const capture = j.stages.find((s) => s.key === "capture");
  const transfer = j.stages.find((s) => s.key === "transfer");
  const apply = j.stages.find((s) => s.key === "apply");

  if (!j.sustainability.backupOwner?.trim()) reasons.push("No backup owner");
  if (
    j.sustainability.nextReview &&
    new Date(j.sustainability.nextReview).getTime() < TODAY.getTime()
  ) {
    reasons.push("Review overdue");
  }
  if (capture?.status === "done" && transfer?.status !== "done") {
    reasons.push("Captured but not transferred");
  }
  if (apply?.status === "waiting" && transfer?.status === "done") {
    reasons.push("Transferred but not applied");
  }
  return { atRisk: reasons.length > 0, reasons };
}

function TransferPage() {
  const sc = seed.staffConsole;
  const journeys = sc.ktJourneys as Journey[];
  const [selectedId, setSelectedId] = useState<string>(journeys[0]?.id ?? "");

  const selected = useMemo(
    () => journeys.find((j) => j.id === selectedId) ?? journeys[0],
    [journeys, selectedId],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-warm-500">KT Transfer</p>
        <h1 className="mt-1 text-3xl font-semibold text-navy-500">Knowledge-Transfer pipeline</h1>
        <p className="mt-1 text-sm text-warm-500">
          Track each journey from a single staff insight through to sustained team practice.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_1.6fr]">
        {/* Left list */}
        <aside className="space-y-2">
          {journeys.map((j) => {
            const person = sc.people.find((p) => p.id === j.personId);
            const { atRisk } = isAtRisk(j);
            const active = j.id === selected?.id;
            return (
              <button
                key={j.id}
                onClick={() => setSelectedId(j.id)}
                className={`group w-full overflow-hidden rounded-lg border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  active ? "border-magenta-500 ring-2 ring-magenta-500/20" : "border-warm-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-lavender-100 text-sm font-semibold text-lavender-900"
                    aria-hidden
                  >
                    {person?.avatarInitial ?? "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-navy-500">
                        {person?.name ?? "—"}
                      </p>
                      {atRisk && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-danger/10 px-2 py-0.5 text-[10px] font-semibold text-danger">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          At risk
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-warm-500">{j.learned}</p>
                  </div>
                </div>

                <div className="mt-3 flex gap-1">
                  {STAGE_ORDER.map((key) => {
                    const stage = j.stages.find((s) => s.key === key);
                    const c = STATUS_COLORS[stage?.status ?? "waiting"];
                    return (
                      <div
                        key={key}
                        title={`${STAGE_META[key].label} — ${c.label}`}
                        className="h-1.5 flex-1 rounded-pill"
                        style={{ backgroundColor: c.bg }}
                      />
                    );
                  })}
                </div>
              </button>
            );
          })}
        </aside>

        {/* Right detail */}
        <section>
          {selected ? <JourneyDetail journey={selected} /> : null}
        </section>
      </div>
    </div>
  );
}

function JourneyDetail({ journey }: { journey: Journey }) {
  const sc = seed.staffConsole;
  const person = sc.people.find((p) => p.id === journey.personId);
  const owner = sc.people.find((p) => p.id === journey.sustainability.ownerId);
  const { atRisk, reasons } = isAtRisk(journey);
  const overdue =
    journey.sustainability.nextReview !== null &&
    new Date(journey.sustainability.nextReview).getTime() < TODAY.getTime();
  const noBackup = !journey.sustainability.backupOwner?.trim();

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-warm-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <span
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-pill bg-lavender-100 text-base font-semibold text-lavender-900"
            aria-hidden
          >
            {person?.avatarInitial ?? "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-warm-500">
              {person?.name ?? "—"} · {person?.role ?? ""}
            </p>
            <h2 className="mt-0.5 text-xl font-semibold leading-snug text-navy-500">
              {journey.learned}
            </h2>
            <p className="mt-1 text-xs text-warm-500">Source: {journey.source}</p>
          </div>
        </div>

        {atRisk && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <div className="text-xs">
              <p className="font-semibold text-danger">This journey is at risk</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-danger/80">
                {reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </header>

      {/* Pipeline */}
      <section className="rounded-lg border border-warm-200 bg-white p-5 shadow-sm">
        <p className="mb-4 text-xs font-bold uppercase tracking-wider text-warm-500">
          KT pipeline
        </p>
        <ol className="space-y-1">
          {STAGE_ORDER.map((key, i) => {
            const stage = journey.stages.find((s) => s.key === key);
            if (!stage) return null;
            const Icon = STAGE_META[key].icon;
            const c = STATUS_COLORS[stage.status];
            const isLast = i === STAGE_ORDER.length - 1;
            const StatusIcon =
              stage.status === "done"
                ? CheckCircle2
                : stage.status === "doing"
                ? Loader2
                : Circle;
            return (
              <li key={key} className="relative flex gap-4">
                {/* Rail */}
                <div className="relative flex w-10 shrink-0 flex-col items-center">
                  <span
                    className="z-10 inline-flex h-10 w-10 items-center justify-center rounded-pill"
                    style={{ backgroundColor: c.soft, color: c.text }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {!isLast && (
                    <span
                      className="absolute top-10 h-full w-0.5"
                      style={{ backgroundColor: c.soft }}
                    />
                  )}
                </div>

                {/* Body */}
                <div className="flex-1 pb-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-navy-500">
                      {STAGE_META[key].label}
                    </p>
                    <span
                      className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] font-semibold"
                      style={{ backgroundColor: c.soft, color: c.text }}
                    >
                      <StatusIcon
                        className={`h-2.5 w-2.5 ${stage.status === "doing" ? "animate-spin" : ""}`}
                      />
                      {c.label}
                    </span>
                    <span className="text-[11px] text-warm-400">{stage.label}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-warm-500">{stage.description}</p>
                  {stage.completedDate && (
                    <p className="mt-1 text-[11px] text-warm-400">
                      Completed {fmt(stage.completedDate)}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Sustainability */}
      <section className="overflow-hidden rounded-lg border border-warm-200 bg-white shadow-sm">
        <header className="flex items-center gap-2 border-b border-warm-200 px-5 py-3">
          <RefreshCw className="h-4 w-4 text-lavender-900" />
          <h3 className="text-sm font-semibold text-navy-500">Sustainability</h3>
        </header>
        <dl className="grid grid-cols-2 gap-4 p-5 text-sm">
          <Meta
            icon={<User className="h-3.5 w-3.5" />}
            label="Owner"
            value={owner ? `${owner.name} · ${owner.role}` : "—"}
          />
          <Meta
            icon={<ShieldAlert className="h-3.5 w-3.5" />}
            label="Backup owner"
            value={noBackup ? "Missing" : journey.sustainability.backupOwner}
            danger={noBackup}
          />
          <Meta
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Last reviewed"
            value={
              journey.sustainability.lastReviewed
                ? fmt(journey.sustainability.lastReviewed)
                : "—"
            }
          />
          <Meta
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Next review"
            value={
              journey.sustainability.nextReview
                ? `${fmt(journey.sustainability.nextReview)}${overdue ? " (overdue)" : ""}`
                : "—"
            }
            danger={overdue}
          />
          <Meta
            icon={<GitBranch className="h-3.5 w-3.5" />}
            label="Version"
            value={journey.sustainability.version}
          />
          <Meta
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            label="Review cycle"
            value={`Every ${journey.sustainability.reviewCycleMonths} months`}
          />
        </dl>
      </section>
    </div>
  );
}

function Meta({
  icon,
  label,
  value,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-warm-500">
        {icon}
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm font-medium ${danger ? "text-danger" : "text-navy-500"}`}
      >
        {value}
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
