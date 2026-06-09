import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ManageableRole = "superadmin" | "admin" | "trainer" | "staff" | "learner";

const ROLE_VALUES = ["superadmin", "admin", "trainer", "staff", "learner"] as const;
const roleSchema = z.enum(ROLE_VALUES);

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error("Unable to verify permissions");
  const roles = (data ?? []).map((r) => r.role as string);
  if (!roles.includes("admin") && !roles.includes("superadmin")) {
    throw new Error("Forbidden: admin access required");
  }
  return { roles, isSuperadmin: roles.includes("superadmin") };
}

export type AccountRow = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastSignInAt: string | null;
  roles: ManageableRole[];
};

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Page through auth users
    const all: Array<{ id: string; email?: string; created_at: string; last_sign_in_at: string | null; user_metadata: Record<string, unknown> }> = [];
    let page = 1;
    const perPage = 200;
    // Safety cap to avoid runaway loops
    while (page <= 25) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw new Error(error.message);
      const users = data?.users ?? [];
      all.push(
        ...users.map((u) => ({
          id: u.id,
          email: u.email ?? "",
          created_at: u.created_at ?? "",
          last_sign_in_at: u.last_sign_in_at ?? null,
          user_metadata: (u.user_metadata as Record<string, unknown>) ?? {},
        })),
      );
      if (users.length < perPage) break;
      page += 1;
    }

    const { data: rolesRows, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rolesErr) throw new Error(rolesErr.message);

    const rolesByUser = new Map<string, ManageableRole[]>();
    for (const r of rolesRows ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as ManageableRole);
      rolesByUser.set(r.user_id, arr);
    }

    const accounts: AccountRow[] = all.map((u) => {
      const meta = u.user_metadata ?? {};
      const fullName =
        (typeof meta.full_name === "string" && meta.full_name) ||
        (typeof meta.name === "string" && meta.name) ||
        (u.email ? u.email.split("@")[0] : "Account");
      return {
        id: u.id,
        email: u.email ?? "",
        name: fullName,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at,
        roles: rolesByUser.get(u.id) ?? [],
      };
    });

    accounts.sort((a, b) => a.email.localeCompare(b.email));
    return { accounts };
  });

export const grantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ userId: z.string().uuid(), role: roleSchema }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { isSuperadmin } = await assertAdmin(context.userId);
    if (data.role === "superadmin" && !isSuperadmin) {
      throw new Error("Only a Super Admin can grant the Super Admin role");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: data.userId, role: data.role },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ userId: z.string().uuid(), role: roleSchema }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { isSuperadmin } = await assertAdmin(context.userId);
    if (data.role === "superadmin" && !isSuperadmin) {
      throw new Error("Only a Super Admin can revoke the Super Admin role");
    }
    // Prevent removing your own superadmin if you're the last one
    if (data.userId === context.userId && data.role === "superadmin") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: others } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "superadmin");
      const otherSupers = (others ?? []).filter((r) => r.user_id !== context.userId);
      if (otherSupers.length === 0) {
        throw new Error("Cannot remove the last Super Admin");
      }
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", data.role);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
