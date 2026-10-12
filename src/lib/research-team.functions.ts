// CVSK research team and study settings (/staff/research/team).
// Every table query runs on the caller's user-scoped client, so RLS applies (migrations
// 20261011120000 and 20261012150000). The service-role client is used for one thing only:
// looking up account email and name through auth.admin, after requireResearch has passed.
// Privacy: nothing here reads consents, participant_identity or withdrawal_events.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireResearch, RESEARCH_ROLES, type ResearchRole } from "@/lib/research-access";

export type StudySettings = {
  ethicsRef: string | null;
  ethicsApprovedAt: string | null;
  mouSignedAt: string | null;
  collectionUnlocked: boolean;
  departments: string[];
  sites: string[];
  speakerGuidanceVersion: string | null;
  retentionYears: number;
  studyEnd: string | null;
  updatedAt: string | null;
};

export type ResearchMember = {
  id: string;
  userId: string;
  role: ResearchRole;
  department: string | null;
  active: boolean;
  note: string | null;
  createdAt: string | null;
  /** From auth.users. Null when the account lookup is unavailable. */
  email: string | null;
  name: string | null;
};

/** Only id, email and name ever leave the server. */
export type TeamAccount = { id: string; email: string; name: string };

export const LIST_MAX_ITEMS = 20;
export const LIST_ITEM_MAX = 80;
export const RETENTION_MIN = 1;
export const RETENTION_MAX = 20;

/**
 * Separation of duties: the researcher must never also hold a role that can see individual
 * consent decisions (consent_officer, data_steward), and the other way round.
 */
export function conflictingRoles(role: ResearchRole): ResearchRole[] {
  if (role === "researcher") return ["consent_officer", "data_steward"];
  if (role === "consent_officer" || role === "data_steward") return ["researcher"];
  return [];
}

/** Roles that can read individual consent decisions and identities. */
export function isConsentKeeperRole(role: ResearchRole): boolean {
  return role === "consent_officer" || role === "data_steward";
}

// The tables are not in the generated Supabase types yet, so they are reached through a
// small local type.
type Row = Record<string, unknown>;
type DbError = { message: string; code?: string };
type Res<T> = PromiseLike<{ data: T | null; error: DbError | null }>;
type Query = Res<Row[]> & {
  eq(col: string, value: string | number | boolean): Query;
  order(col: string, opts: { ascending: boolean }): Query;
  select(cols: string): Query;
  maybeSingle(): Res<Row>;
  single(): Res<Row>;
};
type Table = {
  select(cols: string): Query;
  update(row: Row): Query;
  upsert(row: Row, opts: { onConflict: string }): Query;
  insert(row: Row): PromiseLike<{ error: DbError | null }>;
};
type Db = { from(table: "study_settings" | "research_members" | "audit_events"): Table };

const SETTINGS_COLS =
  "id, ethics_ref, ethics_approved_at, mou_signed_at, collection_unlocked, departments, sites, speaker_guidance_version, retention_years, study_end, updated_at";
const MEMBER_COLS = "id, user_id, role, department, active, note, created_at";

const str = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);
const strList = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

function toSettings(r: Row): StudySettings {
  const years = Number(r.retention_years);
  return {
    ethicsRef: str(r.ethics_ref),
    ethicsApprovedAt: str(r.ethics_approved_at),
    mouSignedAt: str(r.mou_signed_at),
    collectionUnlocked: r.collection_unlocked === true,
    departments: strList(r.departments),
    sites: strList(r.sites),
    speakerGuidanceVersion: str(r.speaker_guidance_version),
    retentionYears: Number.isFinite(years) ? years : 5,
    studyEnd: str(r.study_end),
    updatedAt: str(r.updated_at),
  };
}

function toMember(r: Row, account: TeamAccount | undefined): ResearchMember {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    role: r.role as ResearchRole,
    department: str(r.department),
    active: r.active === true,
    note: str(r.note),
    createdAt: str(r.created_at),
    email: account?.email ?? null,
    name: account?.name ?? null,
  };
}

function friendly(error: DbError): Error {
  // PGRST205 (PostgREST 12+) / 42P01: the migration has not been applied yet.
  if (error.code === "PGRST205" || error.code === "42P01") return new Error("TEAM_TABLE_MISSING");
  if (error.code === "42501") return new Error("TEAM_FORBIDDEN");
  // research_members.user_id references auth.users
  if (error.code === "23503") return new Error("TEAM_ACCOUNT_NOT_FOUND");
  // research_members_guard(): researcher and consent-keeper roles on one account
  if (error.code === "23514") return new Error("TEAM_ROLE_CONFLICT");
  console.error("[research-team] db error", error.code ?? "", error.message);
  return new Error("TEAM_DB_ERROR");
}

async function audit(
  db: Db,
  row: { action: string; object_type: string; object_id: string; purpose: string; details: Row },
) {
  // actor_id defaults to auth.uid(); details never carry names or emails.
  const { error } = await db.from("audit_events").insert(row);
  if (error) console.warn("[research-team] audit insert failed", error.code ?? "", error.message);
}

// ---------------------------------------------------------------------------
// Study settings
// ---------------------------------------------------------------------------

export const getStudySettings = createServerFn({ method: "GET" })
  .middleware([
    requireResearch("admin", "researcher", "data_steward", "consent_officer", "dept_coordinator"),
  ])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as Db;
    const { data, error } = await db
      .from("study_settings")
      .select(SETTINGS_COLS)
      .eq("id", 1)
      .maybeSingle();
    if (error) throw friendly(error);
    const a = context.access;
    return {
      settings: data ? toSettings(data) : null,
      canEdit: a.isAdmin || a.roles.includes("data_steward"),
    };
  });

// Real calendar dates only (2026-02-30 would fail in Postgres), in a sensible range
// (year 0000 is not a valid Postgres date).
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    const year = Number(s.slice(0, 4));
    return (
      !Number.isNaN(d.getTime()) &&
      d.toISOString().slice(0, 10) === s &&
      year >= 2000 &&
      year <= 2100
    );
  }, "invalid date");
/** "" or null clears the date. */
const optDate = z
  .union([z.literal(""), isoDate])
  .nullable()
  .transform((v) => v || null);
/** Trimmed; "" or null clears the value. */
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => v || null);
const nameList = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(LIST_ITEM_MAX)
      .transform((s) => s.replace(/\s+/g, " ")),
  )
  .max(LIST_MAX_ITEMS)
  .superRefine((list, ctx) => {
    const seen = new Set<string>();
    for (const s of list) {
      const key = s.toLocaleLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({ code: "custom", message: "duplicate" });
        return;
      }
      seen.add(key);
    }
  });

const SettingsPatch = z
  .object({
    /** updated_at the editor saw. A newer value means someone else saved in between. */
    expectedUpdatedAt: z.string().max(64).nullable().optional(),
    ethicsRef: optText(120).optional(),
    ethicsApprovedAt: optDate.optional(),
    mouSignedAt: optDate.optional(),
    departments: nameList.optional(),
    sites: nameList.optional(),
    speakerGuidanceVersion: optText(60).optional(),
    retentionYears: z.number().int().min(RETENTION_MIN).max(RETENTION_MAX).optional(),
    studyEnd: optDate.optional(),
    collectionUnlocked: z.boolean().optional(),
  })
  .strict();
export type StudySettingsPatch = z.input<typeof SettingsPatch>;

const FIELD_COLUMN = {
  ethicsRef: "ethics_ref",
  ethicsApprovedAt: "ethics_approved_at",
  mouSignedAt: "mou_signed_at",
  departments: "departments",
  sites: "sites",
  speakerGuidanceVersion: "speaker_guidance_version",
  retentionYears: "retention_years",
  studyEnd: "study_end",
  collectionUnlocked: "collection_unlocked",
} as const satisfies Partial<Record<keyof StudySettings, string>>;
type PatchField = keyof typeof FIELD_COLUMN;

/**
 * Partial update: only the fields sent are changed. Unlocking needs both approval dates, and
 * an approval date cannot be cleared while collection is open (the DB CHECK enforces this too).
 */
export const updateStudySettings = createServerFn({ method: "POST" })
  .middleware([requireResearch("admin", "data_steward")])
  .inputValidator((i: StudySettingsPatch) => SettingsPatch.parse(i))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const { data: row, error } = await db
      .from("study_settings")
      .select(SETTINGS_COLS)
      .eq("id", 1)
      .maybeSingle();
    if (error) throw friendly(error);
    if (!row) throw new Error("STUDY_SETTINGS_MISSING");
    const current = toSettings(row);
    if (data.expectedUpdatedAt !== undefined && data.expectedUpdatedAt !== current.updatedAt) {
      throw new Error("STUDY_SETTINGS_STALE");
    }

    const patch: Row = {};
    const changed: Record<string, { from: unknown; to: unknown }> = {};
    for (const field of Object.keys(FIELD_COLUMN) as PatchField[]) {
      const next = data[field];
      if (next === undefined) continue;
      const prev = current[field];
      if (JSON.stringify(prev) === JSON.stringify(next)) continue;
      patch[FIELD_COLUMN[field]] = next;
      // All study settings are non-personal, so values can go into the audit trail.
      changed[FIELD_COLUMN[field]] = { from: prev, to: next };
    }
    if (Object.keys(patch).length === 0) return { settings: current, changed: [] as string[] };

    const final = {
      unlocked: data.collectionUnlocked ?? current.collectionUnlocked,
      ethics:
        data.ethicsApprovedAt !== undefined ? data.ethicsApprovedAt : current.ethicsApprovedAt,
      mou: data.mouSignedAt !== undefined ? data.mouSignedAt : current.mouSignedAt,
    };
    if (final.unlocked && (!final.ethics || !final.mou)) {
      throw new Error("STUDY_UNLOCK_NEEDS_APPROVALS");
    }

    patch.updated_at = new Date().toISOString();
    patch.updated_by = context.userId;
    let update = db.from("study_settings").update(patch).eq("id", 1);
    if (current.updatedAt) update = update.eq("updated_at", current.updatedAt);
    const { data: saved, error: saveError } = await update.select(SETTINGS_COLS);
    if (saveError) {
      if (saveError.code === "23514") throw new Error("STUDY_UNLOCK_NEEDS_APPROVALS");
      throw friendly(saveError);
    }
    // No row back: updated_at moved between our read and write (someone else saved).
    if (!saved?.length) throw new Error("STUDY_SETTINGS_STALE");

    await audit(db, {
      action: "study.settings_update",
      object_type: "study_settings",
      object_id: "1",
      purpose: "research_governance",
      details: { fields: Object.keys(changed), changed },
    });

    return { settings: toSettings(saved[0]), changed: Object.keys(changed) };
  });

// ---------------------------------------------------------------------------
// Research team
// ---------------------------------------------------------------------------

type AuthUser = { id: string; email?: string; user_metadata?: Record<string, unknown> | null };

function toAccount(u: AuthUser): TeamAccount {
  const meta = u.user_metadata ?? {};
  const email = u.email ?? "";
  const name =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    (email ? email.split("@")[0] : "");
  return { id: u.id, email, name };
}

/**
 * Account email and name through auth.admin. Call only after requireResearch has passed.
 * With `ids`, looks up just those accounts; without, pages through every account.
 */
async function loadAccounts(ids?: string[]): Promise<{ accounts: TeamAccount[]; ok: boolean }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (ids) {
      const found = await Promise.all(
        ids.map(async (id) => {
          const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
          return error || !data?.user ? null : toAccount(data.user);
        }),
      );
      return { accounts: found.filter((a): a is TeamAccount => a !== null), ok: true };
    }
    const accounts: TeamAccount[] = [];
    const perPage = 200;
    for (let page = 1; page <= 25; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const users = data?.users ?? [];
      accounts.push(...users.map(toAccount));
      if (users.length < perPage) break;
    }
    accounts.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, "th"));
    return { accounts, ok: true };
  } catch (err) {
    // No account details in the log
    console.error("[research-team] account lookup failed", err instanceof Error ? err.name : "");
    return { accounts: [], ok: false };
  }
}

/**
 * Research members with account email and name. Admins also get the account directory for
 * the add-member picker; data stewards cannot grant roles, so they do not get it.
 * RLS on research_members lets admins read every row; everyone else reads only their own rows.
 */
export const listResearchMembers = createServerFn({ method: "GET" })
  .middleware([requireResearch("admin", "data_steward")])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as Db;
    const { data, error } = await db
      .from("research_members")
      .select(MEMBER_COLS)
      .order("created_at", { ascending: true });
    if (error) throw friendly(error);
    const rows = data ?? [];
    const isAdmin = context.access.isAdmin;

    const lookup = isAdmin
      ? await loadAccounts()
      : await loadAccounts([...new Set(rows.map((r) => r.user_id as string))]);
    const byId = new Map(lookup.accounts.map((a) => [a.id, a]));

    return {
      members: rows.map((r) => toMember(r, byId.get(r.user_id as string))),
      accounts: isAdmin ? lookup.accounts : [],
      accountsAvailable: lookup.ok,
      canGrant: isAdmin,
      /** True when RLS shows only the caller's own rows (not an admin). */
      limited: !isAdmin,
      viewerId: context.userId,
    };
  });

const GrantInput = z
  .object({
    userId: z.string().uuid(),
    role: z.enum(RESEARCH_ROLES),
    department: optText(LIST_ITEM_MAX).optional(),
    note: optText(500).optional(),
  })
  .strict();

/** A dept_coordinator needs a department that is still in study_settings.departments. */
async function assertKnownDepartment(db: Db, department: string | null) {
  if (!department) throw new Error("TEAM_DEPARTMENT_REQUIRED");
  const { data: s, error } = await db
    .from("study_settings")
    .select("departments")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw friendly(error);
  if (!strList(s?.departments).includes(department)) {
    throw new Error("TEAM_DEPARTMENT_UNKNOWN");
  }
}

/**
 * Separation of duties again after the write: two admins could grant conflicting roles to the
 * same account at the same moment, and both pre-checks would pass. Fails closed: if a conflict
 * now exists, the row just turned on is turned off again (and the change is audited).
 */
async function revertIfConflict(
  db: Db,
  row: { id: string; userId: string; role: ResearchRole; department: string | null },
) {
  const blocked = conflictingRoles(row.role);
  if (!blocked.length) return;
  const { data: others, error } = await db
    .from("research_members")
    .select("role")
    .eq("user_id", row.userId)
    .eq("active", true);
  if (error) throw friendly(error);
  if (!(others ?? []).some((o) => blocked.includes(o.role as ResearchRole))) return;

  const { error: revertError } = await db
    .from("research_members")
    .update({ active: false })
    .eq("id", row.id)
    .select("id");
  if (revertError) throw friendly(revertError);
  await audit(db, {
    action: "research.role_conflict_reverted",
    object_type: "research_members",
    object_id: row.id,
    purpose: "research_team",
    details: { user_id: row.userId, role: row.role, department: row.department },
  });
  throw new Error("TEAM_ROLE_CONFLICT");
}

/**
 * Admins only (data stewards may not grant). Upserts on (user_id, role) and sets active.
 * An admin cannot give a consent-keeper role to their own account: another admin must do it,
 * so admin access alone never leads to individual consent decisions.
 */
export const grantResearchRole = createServerFn({ method: "POST" })
  .middleware([requireResearch("admin")])
  .inputValidator((i: z.input<typeof GrantInput>) => GrantInput.parse(i))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    if (data.userId === context.userId && isConsentKeeperRole(data.role)) {
      throw new Error("TEAM_SELF_KEEPER");
    }
    const isCoordinator = data.role === "dept_coordinator";
    const department = isCoordinator ? (data.department ?? null) : null;
    if (isCoordinator) await assertKnownDepartment(db, department);

    const { data: held, error: heldError } = await db
      .from("research_members")
      .select("id, role, active")
      .eq("user_id", data.userId);
    if (heldError) throw friendly(heldError);
    const blocked = conflictingRoles(data.role);
    if ((held ?? []).some((r) => r.active === true && blocked.includes(r.role as ResearchRole))) {
      throw new Error("TEAM_ROLE_CONFLICT");
    }
    const existing = (held ?? []).find((r) => r.role === data.role);

    const row: Row = { user_id: data.userId, role: data.role, active: true, department };
    // Keep an existing note unless a new one is given
    if (data.note) row.note = data.note;
    const { data: saved, error } = await db
      .from("research_members")
      .upsert(row, { onConflict: "user_id,role" })
      .select(MEMBER_COLS)
      .single();
    if (error) throw friendly(error);
    if (!saved) throw new Error("TEAM_DB_ERROR");

    await audit(db, {
      action: "research.role_grant",
      object_type: "research_members",
      object_id: saved.id as string,
      purpose: "research_team",
      details: {
        user_id: data.userId,
        role: data.role,
        department,
        previous: existing ? (existing.active === true ? "active" : "inactive") : "none",
        self_grant: data.userId === context.userId,
        has_note: Boolean(data.note),
      },
    });
    await revertIfConflict(db, {
      id: saved.id as string,
      userId: data.userId,
      role: data.role,
      department,
    });

    return { member: toMember(saved, undefined) };
  });

const SetActiveInput = z.object({ memberId: z.string().uuid(), active: z.boolean() }).strict();

/**
 * Admins only. Reactivating checks separation of duties again, needs a department that is
 * still in the study list for a coordinator, and is refused for a consent-keeper role on the
 * admin's own account. Turning one's own role off is always allowed.
 */
export const setResearchMemberActive = createServerFn({ method: "POST" })
  .middleware([requireResearch("admin")])
  .inputValidator((i: z.input<typeof SetActiveInput>) => SetActiveInput.parse(i))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const { data: row, error } = await db
      .from("research_members")
      .select(MEMBER_COLS)
      .eq("id", data.memberId)
      .maybeSingle();
    if (error) throw friendly(error);
    if (!row) throw new Error("TEAM_MEMBER_NOT_FOUND");
    if ((row.active === true) === data.active) {
      return { member: toMember(row, undefined), changed: false };
    }

    const role = row.role as ResearchRole;
    const userId = row.user_id as string;
    const department = str(row.department);
    if (data.active) {
      if (userId === context.userId && isConsentKeeperRole(role)) {
        throw new Error("TEAM_SELF_KEEPER");
      }
      if (role === "dept_coordinator") await assertKnownDepartment(db, department);
      const blocked = conflictingRoles(role);
      if (blocked.length) {
        const { data: others, error: othersError } = await db
          .from("research_members")
          .select("role")
          .eq("user_id", userId)
          .eq("active", true);
        if (othersError) throw friendly(othersError);
        if ((others ?? []).some((o) => blocked.includes(o.role as ResearchRole))) {
          throw new Error("TEAM_ROLE_CONFLICT");
        }
      }
    }

    const { data: saved, error: saveError } = await db
      .from("research_members")
      .update({ active: data.active })
      .eq("id", data.memberId)
      .select(MEMBER_COLS);
    if (saveError) throw friendly(saveError);
    if (!saved?.length) throw new Error("TEAM_FORBIDDEN");

    await audit(db, {
      action: data.active ? "research.role_reactivate" : "research.role_deactivate",
      object_type: "research_members",
      object_id: data.memberId,
      purpose: "research_team",
      details: {
        user_id: userId,
        role,
        department,
        self_change: userId === context.userId,
      },
    });
    if (data.active) {
      await revertIfConflict(db, { id: data.memberId, userId, role, department });
    }

    return { member: toMember(saved[0], undefined), changed: true };
  });
