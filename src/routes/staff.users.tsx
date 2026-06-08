import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Shield, GraduationCap, UserCog, ChevronDown, Check, MapPin, Mail, Phone } from "lucide-react";
import seed from "@/data/seed-data.json";

export const Route = createFileRoute("/staff/users")({
  component: UsersPage,
});

type AppRole = "admin" | "staff" | "learner";
type Person = {
  id: string;
  name: string;
  nameTh?: string;
  role?: string;
  roleTh?: string;
  site?: string;
  email?: string;
  phone?: string;
  avatarInitial?: string;
};

const SEEDED_ADMINS = new Set<string>(["p-surang-janyam", "p-thanat-mongkholpan"]);
const ROLE_META: Record<AppRole, { label: string; labelTh: string; tone: string; icon: typeof Shield }> = {
  admin: { label: "Admin", labelTh: "ผู้ดูแล", tone: "bg-magenta-500 text-white", icon: Shield },
  staff: { label: "Staff", labelTh: "เจ้าหน้าที่", tone: "bg-navy-500 text-white", icon: UserCog },
  learner: { label: "Learner", labelTh: "ผู้เรียน", tone: "bg-warm-200 text-warm-700", icon: GraduationCap },
};

function initialRoles(people: Person[]): Record<string, AppRole> {
  const map: Record<string, AppRole> = {};
  for (const p of people) {
    if (SEEDED_ADMINS.has(p.id)) map[p.id] = "admin";
    else map[p.id] = "staff"; // SWING staff seed: default staff
  }
  return map;
}

function UsersPage() {
  const people = (seed.staffConsole.people as Person[]) ?? [];
  const [roles, setRoles] = useState<Record<string, AppRole>>(() => initialRoles(people));
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | AppRole>("all");
  const [savedId, setSavedId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const c = { admin: 0, staff: 0, learner: 0 };
    Object.values(roles).forEach((r) => (c[r] += 1));
    return c;
  }, [roles]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return people.filter((p) => {
      const r = roles[p.id];
      if (filter !== "all" && r !== filter) return false;
      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) ||
        (p.nameTh ?? "").toLowerCase().includes(needle) ||
        (p.email ?? "").toLowerCase().includes(needle) ||
        (p.role ?? "").toLowerCase().includes(needle) ||
        (p.site ?? "").toLowerCase().includes(needle)
      );
    });
  }, [people, roles, q, filter]);

  const updateRole = (id: string, role: AppRole) => {
    setRoles((prev) => ({ ...prev, [id]: role }));
    setSavedId(id);
    setTimeout(() => setSavedId((s) => (s === id ? null : s)), 1200);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-warm-500">Access control</p>
        <h1 className="mt-1 text-3xl font-semibold text-navy-500">Users &amp; roles</h1>
        <p className="mt-1 text-sm text-warm-500">
          Grant <span className="font-semibold text-navy-500">admin</span>,{" "}
          <span className="font-semibold text-navy-500">staff</span>, or{" "}
          <span className="font-semibold text-navy-500">learner</span> access. Mock data — wire to the
          <code className="mx-1 rounded bg-warm-100 px-1 py-0.5 text-[11px]">user_roles</code> table when
          ready.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard kind="admin" count={stats.admin} total={people.length} />
        <StatCard kind="staff" count={stats.staff} total={people.length} />
        <StatCard kind="learner" count={stats.learner} total={people.length} />
      </div>

      {/* Toolbar */}
      <div className="space-y-3 rounded-lg border border-warm-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email, role, or site…"
            className="w-full rounded-pill border border-warm-200 bg-warm-50 py-2.5 pl-10 pr-4 text-sm text-navy-500 placeholder:text-warm-400 focus:border-magenta-500 focus:bg-white focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-warm-500">Filter</span>
          {(["all", "admin", "staff", "learner"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`rounded-pill border px-3 py-1 text-xs font-semibold transition-colors ${
                filter === k
                  ? "border-magenta-500 bg-magenta-500 text-white"
                  : "border-warm-200 bg-white text-warm-700 hover:border-magenta-500"
              }`}
            >
              {k === "all" ? "All" : ROLE_META[k].label}
            </button>
          ))}
          <p className="ml-auto text-xs text-warm-500">
            Showing <span className="font-semibold text-navy-500">{filtered.length}</span> of {people.length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-warm-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-warm-50 text-left text-[11px] font-bold uppercase tracking-wider text-warm-500">
            <tr>
              <th className="px-4 py-3">Person</th>
              <th className="px-4 py-3">Position</th>
              <th className="hidden px-4 py-3 md:table-cell">Contact</th>
              <th className="px-4 py-3">App role</th>
              <th className="px-4 py-3 text-right">Saved</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-100">
            {filtered.map((p) => {
              const role = roles[p.id];
              const meta = ROLE_META[role];
              return (
                <tr key={p.id} className="hover:bg-warm-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-lavender-100 text-sm font-semibold text-lavender-900">
                        {p.avatarInitial ?? p.name[0]}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-navy-500">{p.name}</p>
                        {p.nameTh && (
                          <p lang="th" className="truncate text-[11px] text-warm-500">{p.nameTh}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <p className="text-xs text-navy-500">{p.role ?? "—"}</p>
                    {p.site && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-warm-500">
                        <MapPin className="h-3 w-3" /> {p.site}
                      </p>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 align-middle md:table-cell">
                    {p.email && (
                      <p className="inline-flex items-center gap-1 text-[11px] text-warm-700">
                        <Mail className="h-3 w-3" /> <span className="truncate">{p.email}</span>
                      </p>
                    )}
                    {p.phone && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-warm-500">
                        <Phone className="h-3 w-3" /> {p.phone}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <RolePicker value={role} onChange={(r) => updateRole(p.id, r)} meta={meta} />
                  </td>
                  <td className="px-4 py-3 text-right align-middle">
                    {savedId === p.id ? (
                      <span className="inline-flex items-center gap-1 rounded-pill bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                        <Check className="h-3 w-3" /> Saved
                      </span>
                    ) : (
                      <span className="text-[11px] text-warm-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-xs text-warm-500">
                  No users match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-warm-500">
        Note: changes are stored in memory for this preview. Persisting to the database is a one-liner once
        you connect this list to the <code className="rounded bg-warm-100 px-1">user_roles</code> table.
      </p>
    </div>
  );
}

function StatCard({ kind, count, total }: { kind: AppRole; count: number; total: number }) {
  const meta = ROLE_META[kind];
  const Icon = meta.icon;
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-warm-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-md ${meta.tone}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-warm-500">{meta.label}</p>
          <p className="text-2xl font-semibold text-navy-500">{count}</p>
        </div>
        <span className="ml-auto rounded-pill bg-warm-100 px-2 py-0.5 text-[11px] font-semibold text-warm-700">
          {pct}%
        </span>
      </div>
    </div>
  );
}

function RolePicker({
  value, onChange, meta,
}: {
  value: AppRole;
  onChange: (r: AppRole) => void;
  meta: { label: string; tone: string; icon: typeof Shield };
}) {
  const [open, setOpen] = useState(false);
  const Icon = meta.icon;
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-semibold shadow-sm ${meta.tone}`}
      >
        <Icon className="h-3.5 w-3.5" />
        {meta.label}
        <ChevronDown className="h-3 w-3 opacity-80" />
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-36 overflow-hidden rounded-md border border-warm-200 bg-white shadow-lg">
          {(Object.keys(ROLE_META) as AppRole[]).map((r) => {
            const m = ROLE_META[r];
            const RIcon = m.icon;
            return (
              <button
                key={r}
                onMouseDown={(e) => { e.preventDefault(); onChange(r); setOpen(false); }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-navy-500 hover:bg-warm-50 ${
                  r === value ? "bg-warm-50" : ""
                }`}
              >
                <RIcon className="h-3.5 w-3.5 text-warm-500" />
                <span className="flex-1 text-left">{m.label}</span>
                {r === value && <Check className="h-3.5 w-3.5 text-magenta-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
