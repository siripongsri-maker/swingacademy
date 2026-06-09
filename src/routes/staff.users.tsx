import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Shield, GraduationCap, UserCog, Crown, Loader2, Check, X, AlertCircle } from "lucide-react";
import {
  listAccounts,
  grantRole,
  revokeRole,
  type AccountRow,
  type ManageableRole,
} from "@/lib/admin-users.functions";
import { useConsoleRole } from "@/lib/console-role-context";

export const Route = createFileRoute("/staff/users")({
  beforeLoad: () => {
    // Soft gate; the page itself will also re-check via the console-role context.
  },
  component: UsersPage,
});

const ROLE_ORDER: ManageableRole[] = ["superadmin", "admin", "trainer", "staff", "learner"];

const ROLE_META: Record<ManageableRole, { label: string; labelTh: string; tone: string; icon: typeof Shield; help: string }> = {
  superadmin: { label: "Super Admin", labelTh: "ผู้ดูแลสูงสุด", tone: "bg-magenta-500 text-white", icon: Crown, help: "Full access. Can grant/revoke Super Admin." },
  admin: { label: "Admin", labelTh: "ผู้ดูแล", tone: "bg-navy-500 text-white", icon: Shield, help: "Manage console, users (except Super Admin), and content." },
  trainer: { label: "Trainer", labelTh: "ผู้สอน", tone: "bg-lavender-500 text-white", icon: UserCog, help: "Review, publish content, talent mapping." },
  staff: { label: "Staff", labelTh: "เจ้าหน้าที่", tone: "bg-warm-700 text-white", icon: UserCog, help: "Create and edit own knowledge assets." },
  learner: { label: "Learner", labelTh: "ผู้เรียน", tone: "bg-warm-200 text-warm-700", icon: GraduationCap, help: "Default access. Browse public learning." },
};

function UsersPage() {
  const { can, role: myRole, currentUserId } = useConsoleRole();
  const allowed = can("users.manage");

  if (!allowed) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex items-start gap-3 rounded-lg border border-warm-200 bg-white p-6 shadow-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 text-magenta-500" />
          <div>
            <h1 className="text-lg font-semibold text-navy-500">Admin access required</h1>
            <p className="mt-1 text-sm text-warm-500">
              You need the Admin or Super Admin role to manage user roles. Your current role is{" "}
              <span className="font-semibold text-navy-500">{myRole}</span>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <UsersPageInner currentUserId={currentUserId} />;
}

function UsersPageInner({ currentUserId }: { currentUserId: string }) {
  const fetchAccounts = useServerFn(listAccounts);
  const grant = useServerFn(grantRole);
  const revoke = useServerFn(revokeRole);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "accounts"],
    queryFn: () => fetchAccounts(),
  });

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | ManageableRole>("all");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const accounts = data?.accounts ?? [];
  const isSuperadmin = useMemo(
    () => accounts.find((a) => a.id === currentUserId)?.roles.includes("superadmin") ?? false,
    [accounts, currentUserId],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return accounts.filter((a) => {
      if (filter !== "all" && !a.roles.includes(filter)) return false;
      if (!needle) return true;
      return (
        a.email.toLowerCase().includes(needle) ||
        a.name.toLowerCase().includes(needle)
      );
    });
  }, [accounts, q, filter]);

  const stats = useMemo(() => {
    const c: Record<ManageableRole, number> = {
      superadmin: 0, admin: 0, trainer: 0, staff: 0, learner: 0,
    };
    accounts.forEach((a) => a.roles.forEach((r) => (c[r] += 1)));
    return c;
  }, [accounts]);

  const mutate = useMutation({
    mutationFn: async (input: { userId: string; role: ManageableRole; action: "grant" | "revoke" }) => {
      if (input.action === "grant") return grant({ data: { userId: input.userId, role: input.role } });
      return revoke({ data: { userId: input.userId, role: input.role } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "accounts"] }),
    onError: (e: Error) => setErrorMsg(e.message),
    onSettled: () => setPendingKey(null),
  });

  const toggle = (account: AccountRow, role: ManageableRole) => {
    setErrorMsg(null);
    const hasIt = account.roles.includes(role);
    setPendingKey(`${account.id}:${role}`);
    mutate.mutate({ userId: account.id, role, action: hasIt ? "revoke" : "grant" });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-warm-500">Access control</p>
        <h1 className="mt-1 text-3xl font-semibold text-navy-500">Users &amp; roles</h1>
        <p className="mt-1 text-sm text-warm-500">
          Assign roles to any account. Only <span className="font-semibold text-navy-500">Super Admins</span>{" "}
          can grant or revoke the Super Admin role.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ROLE_ORDER.map((r) => (
          <StatCard key={r} role={r} count={stats[r]} />
        ))}
      </div>

      {/* Toolbar */}
      <div className="space-y-3 rounded-lg border border-warm-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full rounded-pill border border-warm-200 bg-warm-50 py-2.5 pl-10 pr-4 text-sm text-navy-500 placeholder:text-warm-400 focus:border-magenta-500 focus:bg-white focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-warm-500">Filter</span>
          {(["all", ...ROLE_ORDER] as const).map((k) => (
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
            Showing <span className="font-semibold text-navy-500">{filtered.length}</span> of {accounts.length}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 rounded-lg border border-magenta-500/30 bg-magenta-500/5 px-4 py-3 text-sm text-magenta-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} aria-label="Dismiss" className="text-magenta-700/70 hover:text-magenta-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-warm-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-warm-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading accounts…
          </div>
        ) : error ? (
          <div className="px-4 py-12 text-center text-sm text-magenta-700">
            Failed to load accounts: {(error as Error).message}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-warm-50 text-left text-[11px] font-bold uppercase tracking-wider text-warm-500">
              <tr>
                <th className="px-4 py-3">Account</th>
                {ROLE_ORDER.map((r) => (
                  <th key={r} className="px-3 py-3 text-center">{ROLE_META[r].label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-warm-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-lavender-100 text-sm font-semibold text-lavender-900">
                        {(a.name[0] ?? a.email[0] ?? "?").toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-navy-500">
                          {a.name}
                          {a.id === currentUserId && (
                            <span className="ml-2 rounded bg-warm-100 px-1.5 py-0.5 text-[10px] font-semibold text-warm-700">
                              You
                            </span>
                          )}
                        </p>
                        <p className="truncate text-[11px] text-warm-500">{a.email}</p>
                      </div>
                    </div>
                  </td>
                  {ROLE_ORDER.map((r) => {
                    const has = a.roles.includes(r);
                    const key = `${a.id}:${r}`;
                    const pending = pendingKey === key;
                    const disabled =
                      pending ||
                      (r === "superadmin" && !isSuperadmin) ||
                      (r === "superadmin" && a.id === currentUserId && has);
                    return (
                      <td key={r} className="px-3 py-3 text-center align-middle">
                        <button
                          onClick={() => toggle(a, r)}
                          disabled={disabled}
                          title={
                            r === "superadmin" && !isSuperadmin
                              ? "Only a Super Admin can change Super Admin"
                              : ROLE_META[r].help
                          }
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-all ${
                            has
                              ? `${ROLE_META[r].tone} border-transparent shadow-sm`
                              : "border-warm-200 bg-white text-warm-400 hover:border-magenta-500 hover:text-magenta-500"
                          } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                          aria-pressed={has}
                        >
                          {pending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : has ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <span className="text-xs">+</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={ROLE_ORDER.length + 1} className="px-4 py-12 text-center text-xs text-warm-500">
                    No accounts match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[11px] text-warm-500">
        Toggle a role to grant or revoke it. Changes apply immediately and are persisted to the database.
      </p>
    </div>
  );
}

function StatCard({ role, count }: { role: ManageableRole; count: number }) {
  const meta = ROLE_META[role];
  const Icon = meta.icon;
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
      </div>
    </div>
  );
}
