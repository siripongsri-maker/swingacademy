import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, RotateCcw, Pencil, Trash2, Plus, GraduationCap, Camera, Loader2, X } from "lucide-react";
import seed from "@/data/seed-data.json";
import { listAvatars, createAvatarUploadUrl, setAvatar, deleteAvatar } from "@/lib/avatars.functions";

export const Route = createFileRoute("/staff/admin")({
  component: AdminPage,
});

type TabKey = "review" | "taxonomy" | "users" | "records";

const TABS: { key: TabKey; label: string }[] = [
  { key: "review", label: "Review queue" },
  { key: "taxonomy", label: "Taxonomy" },
  { key: "users", label: "Users" },
  { key: "records", label: "Learning records" },
];

function AdminPage() {
  const [tab, setTab] = useState<TabKey>("review");

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-warm-500">Admin</p>
        <h1 className="mt-1 text-3xl font-semibold text-navy-500">Program administration</h1>
        <p className="mt-1 text-sm text-warm-500">
          Approve content, manage taxonomies, users and review learning activity.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-warm-200">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative px-4 py-2.5 text-sm font-semibold transition-colors ${
                active ? "text-magenta-500" : "text-warm-500 hover:text-navy-500"
              }`}
            >
              {t.label}
              {active && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 bg-magenta-500" />
              )}
            </button>
          );
        })}
      </div>

      {tab === "review" && <ReviewQueue />}
      {tab === "taxonomy" && <TaxonomyEditor />}
      {tab === "users" && <UsersTable />}
      {tab === "records" && <RecordsTable />}
    </div>
  );
}

function ReviewQueue() {
  const sc = seed.staffConsole;
  const queue = sc.knowledgeAssets.filter(
    (a) => a.status === "draft" || a.status === "in_review",
  );
  const [acted, setActed] = useState<Record<string, "approved" | "returned">>({});

  return (
    <section className="overflow-hidden rounded-lg border border-warm-200 bg-white shadow-sm">
      {queue.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-warm-500">
          Inbox clear — nothing waiting for review.
        </p>
      ) : (
        <ul className="divide-y divide-warm-200">
          {queue.map((a) => {
            const owner = sc.people.find((p) => p.id === a.ownerId);
            const status = acted[a.id];
            return (
              <li key={a.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-navy-500">{a.title}</p>
                    <span className="inline-flex items-center rounded-pill bg-gold/15 px-2 py-0.5 text-[11px] font-semibold text-gold">
                      {(sc.statusLabels as Record<string, string>)[a.status] ?? a.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-warm-500">
                    {(sc.typeLabels as Record<string, string>)[a.type] ?? a.type} · {owner?.name ?? "—"} · v
                    {a.version.replace(/^v/, "")}
                  </p>
                </div>

                {status ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded-pill px-3 py-1.5 text-xs font-semibold ${
                      status === "approved"
                        ? "bg-success/15 text-success"
                        : "bg-warm-100 text-warm-700"
                    }`}
                  >
                    {status === "approved" ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <RotateCcw className="h-3 w-3" />
                    )}
                    {status === "approved" ? "Approved" : "Returned"}
                  </span>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setActed((s) => ({ ...s, [a.id]: "approved" }))
                      }
                      className="inline-flex items-center gap-1 rounded-pill bg-success px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Approve
                    </button>
                    <button
                      onClick={() =>
                        setActed((s) => ({ ...s, [a.id]: "returned" }))
                      }
                      className="inline-flex items-center gap-1 rounded-pill border border-warm-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-500 hover:border-magenta-500"
                    >
                      <RotateCcw className="h-3 w-3" /> Return
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function TaxonomyEditor() {
  const sc = seed.staffConsole;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title="Domains" addLabel="Add domain">
        <ul className="divide-y divide-warm-200">
          {Object.entries(sc.domainLabels as Record<string, string>).map(([k, v]) => (
            <Row key={k} primary={v} secondary={k} />
          ))}
        </ul>
      </Section>
      <Section title="Skills" addLabel="Add skill">
        <ul className="divide-y divide-warm-200">
          {sc.skills.map((s) => (
            <Row
              key={s.id}
              primary={s.name}
              secondary={`${(sc.domainLabels as Record<string, string>)[s.domain] ?? s.domain}`}
            />
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({
  title,
  addLabel,
  children,
}: {
  title: string;
  addLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-warm-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-warm-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-navy-500">{title}</h2>
        <button className="inline-flex items-center gap-1 rounded-pill border border-warm-200 bg-white px-3 py-1 text-xs font-semibold text-navy-500 hover:border-magenta-500">
          <Plus className="h-3 w-3" /> {addLabel}
        </button>
      </header>
      {children}
    </section>
  );
}

function Row({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <li className="flex items-center justify-between px-5 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-navy-500">{primary}</p>
        <p className="truncate text-[11px] text-warm-500">{secondary}</p>
      </div>
      <div className="flex gap-1">
        <button
          className="rounded-pill p-1.5 text-warm-500 hover:bg-warm-100 hover:text-navy-500"
          aria-label="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          className="rounded-pill p-1.5 text-warm-500 hover:bg-danger/10 hover:text-danger"
          aria-label="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

function UsersTable() {
  const sc = seed.staffConsole;
  const [q, setQ] = useState("");
  const [site, setSite] = useState<string>("all");
  const sites = Array.from(
    new Set(sc.people.map((p: any) => p.site).filter(Boolean)),
  ) as string[];
  const filtered = sc.people.filter((p: any) => {
    if (site !== "all" && p.site !== site) return false;
    if (!q.trim()) return true;
    const hay = `${p.name} ${p.nameTh ?? ""} ${p.role} ${p.roleTh ?? ""} ${p.email}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const qc = useQueryClient();
  const listFn = useServerFn(listAvatars);
  const uploadFn = useServerFn(createAvatarUploadUrl);
  const setFn = useServerFn(setAvatar);
  const delFn = useServerFn(deleteAvatar);
  const { data: avatarData } = useQuery({
    queryKey: ["person-avatars"],
    queryFn: () => listFn(),
  });
  const avatars: Record<string, string> = avatarData?.avatars ?? {};
  const [busy, setBusy] = useState<string | null>(null);

  const handleUpload = async (personId: string, file: File) => {
    if (!file.type.startsWith("image/")) { alert("Please pick an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5MB."); return; }
    setBusy(personId);
    try {
      const { signedUrl, path } = await uploadFn({ data: { personId, filename: file.name } });
      const up = await fetch(signedUrl, { method: "PUT", body: file, headers: { "content-type": file.type } });
      if (!up.ok) throw new Error("Upload failed");
      await setFn({ data: { person_id: personId, storage_path: path, mime_type: file.type, size_bytes: file.size } });
      qc.invalidateQueries({ queryKey: ["person-avatars"] });
    } catch (e: any) {
      alert(e?.message ?? "Upload failed");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (personId: string) => {
    if (!confirm("Remove this profile photo?")) return;
    setBusy(personId);
    try {
      await delFn({ data: { personId } });
      qc.invalidateQueries({ queryKey: ["person-avatars"] });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-lg border border-warm-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-warm-200 px-5 py-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, role, email…"
          className="min-w-[200px] flex-1 rounded-pill border border-warm-200 bg-white px-3 py-1.5 text-sm focus:border-magenta-500 focus:outline-none"
        />
        <select
          value={site}
          onChange={(e) => setSite(e.target.value)}
          className="rounded-pill border border-warm-200 bg-white px-3 py-1.5 text-sm focus:border-magenta-500 focus:outline-none"
        >
          <option value="all">All sites</option>
          {sites.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="text-xs text-warm-500">
          {filtered.length} of {sc.people.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-warm-50 text-left text-[11px] font-bold uppercase tracking-wider text-warm-500">
            <tr>
              <th className="px-5 py-3">Person</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Site</th>
              <th className="px-5 py-3">Contact</th>
              <th className="px-5 py-3">Can teach</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-200">
            {filtered.map((p: any) => (
              <tr key={p.id} className="hover:bg-warm-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <AvatarCell
                      personId={p.id}
                      initial={p.avatarInitial}
                      url={avatars[p.id]}
                      busy={busy === p.id}
                      onUpload={(f) => handleUpload(p.id, f)}
                      onDelete={() => handleDelete(p.id)}
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-navy-500">{p.name}</p>
                      {p.nameTh && (
                        <p className="text-[11px] text-warm-500">{p.nameTh}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-warm-700">
                  <p>{p.role}</p>
                  {p.roleTh && (
                    <p className="text-[11px] text-warm-500">{p.roleTh}</p>
                  )}
                </td>
                <td className="px-5 py-3 text-warm-700">{p.site}</td>
                <td className="px-5 py-3 text-warm-500">
                  <p className="truncate">{p.email}</p>
                  {p.phone && (
                    <p className="text-[11px] text-warm-400">{p.phone}</p>
                  )}
                </td>
                <td className="px-5 py-3">
                  {!p.canTeach || p.canTeach.length === 0 ? (
                    <span className="text-xs text-warm-400">—</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                      <GraduationCap className="h-3 w-3" /> {p.canTeach.length}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AvatarCell({
  personId,
  initial,
  url,
  busy,
  onUpload,
  onDelete,
}: {
  personId: string;
  initial: string;
  url?: string;
  busy: boolean;
  onUpload: (f: File) => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="group relative h-9 w-9 shrink-0">
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          if (ref.current) ref.current.value = "";
        }}
      />
      {url ? (
        <img
          src={url}
          alt={`Avatar for ${personId}`}
          className="h-9 w-9 rounded-pill object-cover ring-1 ring-warm-200"
        />
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-pill bg-lavender-100 text-xs font-semibold text-lavender-900">
          {initial}
        </span>
      )}
      {busy && (
        <span className="absolute inset-0 flex items-center justify-center rounded-pill bg-white/70">
          <Loader2 className="h-4 w-4 animate-spin text-magenta-500" />
        </span>
      )}
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        aria-label="Upload profile photo"
        className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-pill bg-magenta-500 text-white opacity-0 shadow ring-1 ring-white transition group-hover:opacity-100 focus:opacity-100"
      >
        <Camera className="h-2.5 w-2.5" />
      </button>
      {url && !busy && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Remove profile photo"
          className="absolute -top-1 -right-1 hidden h-4 w-4 items-center justify-center rounded-pill bg-warm-700 text-white shadow ring-1 ring-white group-hover:flex"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

function RecordsTable() {
  const sc = seed.staffConsole;
  const statusTone: Record<string, string> = {
    completed: "bg-success/15 text-success",
    in_progress: "bg-lavender-100 text-lavender-900",
    enrolled: "bg-warm-100 text-warm-700",
  };
  return (
    <section className="overflow-hidden rounded-lg border border-warm-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-warm-50 text-left text-[11px] font-bold uppercase tracking-wider text-warm-500">
          <tr>
            <th className="px-5 py-3">Learner</th>
            <th className="px-5 py-3">Product</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3 w-48">Progress</th>
            <th className="px-5 py-3">Completed</th>
            <th className="px-5 py-3">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-warm-200">
          {sc.learningRecords.map((r) => {
            const person = sc.people.find((p) => p.id === r.personId);
            const product = sc.products.find((p) => p.id === r.productId);
            return (
              <tr key={r.id} className="hover:bg-warm-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-pill bg-lavender-100 text-xs font-semibold text-lavender-900">
                      {person?.avatarInitial ?? "?"}
                    </span>
                    <span className="font-semibold text-navy-500">{person?.name ?? "—"}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-warm-700">{product?.title ?? r.productId}</td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-[11px] font-semibold ${statusTone[r.status]}`}
                  >
                    {r.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-warm-100">
                      <div
                        className="h-full bg-magenta-500"
                        style={{ width: `${r.progressPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-warm-500">{r.progressPct}%</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-xs text-warm-500">
                  {r.completedDate ? fmt(r.completedDate) : "—"}
                </td>
                <td className="px-5 py-3 text-xs font-semibold text-navy-500">
                  {r.score ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
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
