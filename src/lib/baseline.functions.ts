// CVSK Round 0 baseline inventory: what knowledge already exists before CVSK.
// Access: admins and the research team (researcher, data steward). RLS on public.baseline_items
// enforces the same rule, so every query runs on the caller's user-scoped client.
import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ADMIN_ROLES } from "@/lib/auth-guards";

export const BASELINE_SOURCES = [
  "line_chat",
  "ai_summary",
  "knowledge_product",
  "document",
  "other",
] as const;

export const KNOWLEDGE_LEVELS = [
  "content_file",
  "written_summary",
  "recording",
  "admin_only",
  "photos_or_links",
  "deleted",
  "none",
  "unknown",
] as const;

export type KnowledgeLevel = (typeof KNOWLEDGE_LEVELS)[number];

export type BaselineItem = {
  id: string;
  source: (typeof BASELINE_SOURCES)[number];
  externalId: string;
  sourceGroup: string | null;
  title: string;
  topicArea: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  dateNote: string | null;
  swingRole: string | null;
  organiser: string | null;
  audience: string | null;
  format: string | null;
  status: string | null;
  artifacts: string | null;
  knowledgeLevel: KnowledgeLevel;
  confidence: string | null;
  verified: boolean;
  evidence: string | null;
  notes: string | null;
  // AI summaries and other content-bearing sources
  itemType: string | null;
  contentMd: string | null;
  contentChars: number | null;
  hasActionItems: boolean | null;
  language: string | null;
  sensitivity: Sensitivity | null;
  sensitivityNote: string | null;
  sourceUrl: string | null;
  linkedItem: string | null;
  sampleSet: string | null;
  updatedAt: string;
};

export type BaselineAccess = { canWrite: boolean; canDelete: boolean };

export const SENSITIVITY = [
  "none",
  "staff_names",
  "community_identifiable",
  "health_info_about_individuals",
] as const;
export type Sensitivity = (typeof SENSITIVITY)[number];

// The table is not in the generated types until Lovable applies the migration.
type Row = Record<string, unknown>;
type DbError = { message: string; code?: string };
type Result<T> = PromiseLike<{ data: T | null; error: DbError | null; count?: number | null }>;
type Filter<T> = {
  eq(col: string, value: string): Filter<T>;
  neq(col: string, value: string): Filter<T>;
  order(col: string, opts: { ascending: boolean; nullsFirst?: boolean }): Filter<T>;
  range(from: number, to: number): Result<T>;
} & Result<T>;
type BaselineTable = {
  from(table: "baseline_items"): {
    select(cols: string, opts?: { count: "exact"; head: boolean }): Filter<Row[]>;
    upsert(rows: Row[], opts: { onConflict: string }): { select(cols: string): Result<Row[]> };
    delete(): {
      eq(
        col: string,
        value: string,
      ): { neq(col: string, value: string): { select(cols: string): Result<Row[]> } };
    };
  };
  from(table: "audit_events"): {
    insert(row: Row): PromiseLike<{ error: DbError | null }>;
  };
  rpc(
    fn: "has_research_role",
    args: { _user_id: string; _role: string },
  ): PromiseLike<{ data: boolean | null }>;
  from(table: "user_roles"): {
    select(cols: string): { eq(col: string, value: string): Result<{ role: string }[]> };
  };
};

/** Admin, superadmin, researcher or data steward. Adds `access` to the context. */
const requireBaselineAccess = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const db = context.supabase as unknown as BaselineTable;
    const { data: roleRows } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roleRows ?? []).some((r) =>
      (ADMIN_ROLES as readonly string[]).includes(r.role),
    );
    const has = async (role: string) =>
      Boolean((await db.rpc("has_research_role", { _user_id: context.userId, _role: role })).data);
    const steward = isAdmin ? false : await has("data_steward");
    const researcher = isAdmin || steward ? false : await has("researcher");
    if (!isAdmin && !steward && !researcher) throw new Error("BASELINE_FORBIDDEN");
    const access: BaselineAccess = { canWrite: true, canDelete: isAdmin || steward };
    return next({ context: { access } });
  });

const COLS =
  "id, source, external_id, source_group, title, topic_area, date_start, date_end, date_note, swing_role, organiser, audience, format, status, artifacts, knowledge_level, confidence, verified, evidence, notes, item_type, content_md, content_chars, has_action_items, language, sensitivity, sensitivity_note, source_url, linked_item, sample_set, updated_at";

function fromDb(r: Row): BaselineItem {
  const s = (k: string) => (r[k] as string | null) ?? null;
  return {
    id: r.id as string,
    source: r.source as BaselineItem["source"],
    externalId: r.external_id as string,
    sourceGroup: s("source_group"),
    title: r.title as string,
    topicArea: s("topic_area"),
    dateStart: s("date_start"),
    dateEnd: s("date_end"),
    dateNote: s("date_note"),
    swingRole: s("swing_role"),
    organiser: s("organiser"),
    audience: s("audience"),
    format: s("format"),
    status: s("status"),
    artifacts: s("artifacts"),
    knowledgeLevel: (r.knowledge_level as KnowledgeLevel) ?? "unknown",
    confidence: s("confidence"),
    verified: Boolean(r.verified),
    evidence: s("evidence"),
    notes: s("notes"),
    itemType: s("item_type"),
    contentMd: s("content_md"),
    contentChars: (r.content_chars as number | null) ?? null,
    hasActionItems: (r.has_action_items as boolean | null) ?? null,
    language: s("language"),
    sensitivity: (r.sensitivity as Sensitivity | null) ?? null,
    sensitivityNote: s("sensitivity_note"),
    sourceUrl: s("source_url"),
    linkedItem: s("linked_item"),
    sampleSet: s("sample_set"),
    updatedAt: r.updated_at as string,
  };
}

function friendly(error: DbError): Error {
  // PGRST205 (PostgREST 12+) / 42P01: the migration has not been applied yet.
  if (error.code === "PGRST205" || error.code === "42P01") {
    return new Error("BASELINE_TABLE_MISSING");
  }
  if (error.code === "42501") return new Error("BASELINE_FORBIDDEN");
  console.error("[baseline]", error);
  return new Error("BASELINE_DB_ERROR");
}

const PAGE = 1000; // PostgREST default max-rows

export const listBaselineItems = createServerFn({ method: "GET" })
  .middleware([requireBaselineAccess])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as BaselineTable;
    const items: BaselineItem[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from("baseline_items")
        .select(COLS)
        .order("date_start", { ascending: true, nullsFirst: true })
        .order("external_id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw friendly(error);
      items.push(...(data ?? []).map(fromDb));
      if (!data || data.length < PAGE) break;
    }
    return { items, access: context.access };
  });

// Real calendar dates only (2026-02-30 would fail in Postgres and sink the whole batch).
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "invalid date")
  .nullable();
const short = (max: number) => z.string().trim().max(max).nullable();

export const ImportRow = z.object({
  externalId: z.string().trim().min(1).max(64),
  sourceGroup: short(120),
  title: z.string().trim().min(1).max(500),
  topicArea: short(120),
  dateStart: isoDate,
  dateEnd: isoDate,
  dateNote: short(200),
  swingRole: short(60),
  organiser: short(500),
  audience: short(500),
  format: short(200),
  status: short(60),
  artifacts: short(1000),
  knowledgeLevel: z.enum(KNOWLEDGE_LEVELS),
  confidence: short(20),
  verified: z.boolean(),
  evidence: short(2000),
  notes: short(1000),
  // Optional: AI summaries and other content-bearing sources
  itemType: short(40).optional().default(null),
  contentMd: z.string().max(60000).nullable().optional().default(null),
  contentChars: z.number().int().min(0).nullable().optional().default(null),
  hasActionItems: z.boolean().nullable().optional().default(null),
  language: short(10).optional().default(null),
  sensitivity: z.enum(SENSITIVITY).nullable().optional().default(null),
  sensitivityNote: short(500).optional().default(null),
  sourceUrl: z
    .string()
    .trim()
    .max(500)
    .regex(/^https:\/\//)
    .nullable()
    .optional()
    .default(null),
  linkedItem: short(64).optional().default(null),
  sampleSet: short(40).optional().default(null),
});

// Input shape: the content columns are optional in a CSV.
export type BaselineImportRow = z.input<typeof ImportRow>;

const ImportInput = z.object({
  source: z.enum(BASELINE_SOURCES),
  fileName: z.string().max(255).nullable(),
  // Remove rows of this source that are not in the file. Runs only after the upsert succeeded.
  replace: z.boolean(),
  rows: z
    .array(ImportRow)
    .min(1)
    .max(1000)
    .superRefine((rows, ctx) => {
      const seen = new Set<string>();
      for (const r of rows) {
        if (seen.has(r.externalId)) {
          ctx.addIssue({ code: "custom", message: `duplicate id ${r.externalId}` });
          return;
        }
        seen.add(r.externalId);
      }
    }),
});

async function audit(db: BaselineTable, row: Row) {
  const { error } = await db.from("audit_events").insert(row);
  if (error) console.warn("[baseline] audit insert failed", error);
}

/**
 * Insert or update by (source, external_id), so re-importing a corrected file is safe.
 * With `replace`, rows of the same source that are not in the file are removed afterwards,
 * so a failed import never leaves the source empty.
 */
export const importBaselineItems = createServerFn({ method: "POST" })
  .middleware([requireBaselineAccess])
  .inputValidator((i: unknown) => ImportInput.parse(i))
  .handler(async ({ data, context }) => {
    if (data.replace && !context.access.canDelete) throw new Error("BASELINE_FORBIDDEN");
    const db = context.supabase as unknown as BaselineTable;
    const batch = crypto.randomUUID();
    const rows = data.rows.map((r) => ({
      source: data.source,
      external_id: r.externalId,
      source_group: r.sourceGroup,
      title: r.title,
      topic_area: r.topicArea,
      date_start: r.dateStart,
      date_end: r.dateEnd,
      date_note: r.dateNote,
      swing_role: r.swingRole,
      organiser: r.organiser,
      audience: r.audience,
      format: r.format,
      status: r.status,
      artifacts: r.artifacts,
      knowledge_level: r.knowledgeLevel,
      confidence: r.confidence,
      verified: r.verified,
      evidence: r.evidence,
      notes: r.notes,
      item_type: r.itemType,
      content_md: r.contentMd,
      content_chars: r.contentChars,
      has_action_items: r.hasActionItems,
      language: r.language,
      sensitivity: r.sensitivity,
      sensitivity_note: r.sensitivityNote,
      source_url: r.sourceUrl,
      linked_item: r.linkedItem,
      sample_set: r.sampleSet,
      import_batch: batch,
    }));
    const { data: saved, error } = await db
      .from("baseline_items")
      .upsert(rows, { onConflict: "source,external_id" })
      .select("id");
    if (error) throw friendly(error);

    let removed: Row[] = [];
    let stale = 0;
    if (data.replace) {
      const res = await db
        .from("baseline_items")
        .delete()
        .eq("source", data.source)
        .neq("import_batch", batch)
        .select("external_id, title");
      if (res.error) throw friendly(res.error);
      removed = res.data ?? [];
    } else {
      const res = await db
        .from("baseline_items")
        .select("id", { count: "exact", head: true })
        .eq("source", data.source)
        .neq("import_batch", batch);
      stale = res.count ?? 0;
    }

    await audit(db, {
      action: data.replace ? "baseline.import_replace" : "baseline.import",
      object_type: "baseline_items",
      object_id: batch,
      purpose: "research_round0",
      details: {
        source: data.source,
        file_name: data.fileName,
        rows: rows.length,
        // What a replace removed, so it can be reconstructed if needed (titles only, no personal data)
        removed: removed.map((r) => ({ id: r.external_id, title: r.title })),
      },
    });

    return { batch, saved: saved?.length ?? 0, removed: removed.length, stale };
  });
