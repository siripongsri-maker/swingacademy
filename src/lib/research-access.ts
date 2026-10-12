// Who can do what in the CVSK research tools. Server-side checks live here; RLS enforces the
// same rules in the database (see migrations 20261011120000, 20261012150000 and 20261012180000).
import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ADMIN_ROLES } from "@/lib/auth-guards";

export const RESEARCH_ROLES = [
  "researcher",
  "consent_officer",
  "dept_coordinator",
  "expert",
  "dignity_panel",
  "data_steward",
  "deid_assistant",
] as const;
export type ResearchRole = (typeof RESEARCH_ROLES)[number];

export type ResearchAccess = {
  isAdmin: boolean;
  roles: ResearchRole[];
  /** Departments a dept_coordinator may work on (empty for other roles). */
  departments: string[];
  /** May read consent decisions and identities: consent officers and data stewards only. */
  isConsentKeeper: boolean;
  /** May work with capture sessions (no consent decisions involved). */
  isSessionWorker: boolean;
  /**
   * May hear raw audio: the data steward and the de-identification assistant only
   * (Appendix จ). Never the researcher, and admin alone is not enough.
   */
  canPlayRawAudio: boolean;
};

type Db = {
  from(t: "user_roles"): {
    select(c: string): {
      eq(col: string, v: string): PromiseLike<{ data: { role: string }[] | null }>;
    };
  };
  from(t: "research_members"): {
    select(c: string): {
      eq(
        col: string,
        v: string,
      ): {
        eq(
          col: string,
          v: boolean,
        ): PromiseLike<{
          data: { role: string; department: string | null }[] | null;
        }>;
      };
    };
  };
};

export async function loadResearchAccess(
  supabase: unknown,
  userId: string,
): Promise<ResearchAccess> {
  const db = supabase as Db;
  const [{ data: appRoles }, { data: members }] = await Promise.all([
    db.from("user_roles").select("role").eq("user_id", userId),
    // research_members_read_own lets every user read their own rows
    db.from("research_members").select("role, department").eq("user_id", userId).eq("active", true),
  ]);
  const isAdmin = (appRoles ?? []).some((r) => (ADMIN_ROLES as readonly string[]).includes(r.role));
  const roles = [...new Set((members ?? []).map((m) => m.role))].filter((r): r is ResearchRole =>
    (RESEARCH_ROLES as readonly string[]).includes(r),
  );
  const departments = (members ?? [])
    .filter((m) => m.role === "dept_coordinator" && m.department)
    .map((m) => m.department as string);
  const isConsentKeeper = roles.includes("consent_officer") || roles.includes("data_steward");
  const isSessionWorker =
    isAdmin ||
    roles.includes("researcher") ||
    roles.includes("data_steward") ||
    roles.includes("dept_coordinator");
  const canPlayRawAudio = roles.includes("data_steward") || roles.includes("deid_assistant");
  return { isAdmin, roles, departments, isConsentKeeper, isSessionWorker, canPlayRawAudio };
}

export type AccessRule = "admin" | "consent_keeper" | "session_worker" | ResearchRole;

function allows(access: ResearchAccess, rule: AccessRule) {
  if (rule === "admin") return access.isAdmin;
  if (rule === "consent_keeper") return access.isConsentKeeper;
  if (rule === "session_worker") return access.isSessionWorker;
  return access.roles.includes(rule);
}

/**
 * Signed-in user matching ANY of the rules. Adds `access` to the context.
 * Note: "admin" never implies consent access. Admins cannot read consent decisions.
 */
export function requireResearch(...rules: AccessRule[]) {
  return createMiddleware({ type: "function" })
    .middleware([requireSupabaseAuth])
    .server(async ({ next, context }) => {
      const access = await loadResearchAccess(context.supabase, context.userId);
      if (!rules.some((r) => allows(access, r))) throw new Error("RESEARCH_FORBIDDEN");
      return next({ context: { access } });
    });
}

/** For menus and page gates on the client. */
export const getMyResearchAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => loadResearchAccess(context.supabase, context.userId));
