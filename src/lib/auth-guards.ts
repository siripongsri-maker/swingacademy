import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Roles that may use the staff back office. "learner" is the default for public sign-ups. */
export const STAFF_ROLES = ["staff", "trainer", "admin", "superadmin"] as const;
export const ADMIN_ROLES = ["admin", "superadmin"] as const;

async function loadRoles(
  supabase: { from: (t: "user_roles") => any },
  userId: string,
): Promise<string[]> {
  // RLS lets a signed-in user read their own role rows (same query as getMyRoles).
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Forbidden: could not verify role");
  return ((data ?? []) as { role: string }[]).map((r) => r.role);
}

/** Signed-in user with any staff-side role. Adds `roles` to the context. */
export const requireStaff = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const roles = await loadRoles(context.supabase, context.userId);
    if (!roles.some((r) => (STAFF_ROLES as readonly string[]).includes(r))) {
      throw new Error("Forbidden: staff only");
    }
    return next({ context: { roles } });
  });

/** Signed-in admin or superadmin. Adds `roles` to the context. */
export const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const roles = await loadRoles(context.supabase, context.userId);
    if (!roles.some((r) => (ADMIN_ROLES as readonly string[]).includes(r))) {
      throw new Error("Forbidden: admin only");
    }
    return next({ context: { roles } });
  });
