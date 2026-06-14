// Server functions that round-trip the full staff "KnowledgeAsset" shape
// (the one used by /staff/knowledge, /staff/product-knowledge, /staff/capture)
// against the public.knowledge_products table.
//
// Store status ("draft"|"review"|"published"|"archived") and store visibility
// ("private"|"staff"|"public") are richer than the DB columns
// ("draft"|"in_review"|"published" and "internal"|"public"), so the extras are
// preserved losslessly in the `metadata` jsonb column.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SELECT_COLS =
  "id, slug, title_th, title_en, summary, key_message, content_md, language, categories, tags, audiences, product_service, source, source_type, cover_url, sponsors, status, visibility, is_featured, featured_order, published_at, updated_at, created_at, owner_id, approved_by, approved_at, metadata";

export type StoreAsset = {
  id: string;
  slug: string;
  titleTh: string;
  titleEn: string;
  summary: string;
  type: string;
  categories: string[];
  productService: string;
  audiences: string[];
  keyMessage: string;
  contentMd: string;
  source: string;
  sourceType: string;
  sourceUrl?: string;
  tags: string[];
  language: string;
  status: "draft" | "review" | "published" | "archived";
  visibility: "private" | "staff" | "public";
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  versionHistory: Array<{ v: string; at: string; by: string; note: string }>;
  attachments: Array<Record<string, any>>;
  learningObjectives?: string[];
  competencyTags?: string[];
  relatedServices?: string[];
  relatedCourses?: string[];
  linkedCurriculum?: string;
  qaChecklist?: Record<string, boolean>;
  approvedAt?: string;
  approvedBy?: string;
  coverUrl?: string | null;
  sponsors?: Array<Record<string, any>>;
  isFeatured?: boolean;
  featuredOrder?: number;
};

type DbStatus = "draft" | "in_review" | "published";
type DbVisibility = "internal" | "public";

function toDbStatus(s: StoreAsset["status"] | undefined): { db: DbStatus; archived: boolean } {
  if (s === "review") return { db: "in_review", archived: false };
  if (s === "published") return { db: "published", archived: false };
  if (s === "archived") return { db: "draft", archived: true };
  return { db: "draft", archived: false };
}

function toDbVisibility(v: StoreAsset["visibility"] | undefined): { db: DbVisibility; store: StoreAsset["visibility"] } {
  if (v === "public") return { db: "public", store: "public" };
  if (v === "private") return { db: "internal", store: "private" };
  return { db: "internal", store: "staff" };
}

function fromDb(row: Record<string, any>): StoreAsset {
  const meta = ((row.metadata as Record<string, any>) ?? {}) as Record<string, any>;
  const dbStatus = String(row.status ?? "draft") as DbStatus;
  const dbVis = String(row.visibility ?? "internal") as DbVisibility;
  const archived = Boolean(meta.archived);
  const storeStatus: StoreAsset["status"] = archived
    ? "archived"
    : dbStatus === "in_review"
    ? "review"
    : dbStatus === "published"
    ? "published"
    : "draft";
  const storeVis: StoreAsset["visibility"] =
    dbVis === "public" ? "public" : ((meta.storeVisibility as StoreAsset["visibility"]) ?? "staff");
  return {
    id: String(row.id),
    slug: String(row.slug),
    titleTh: String(row.title_th ?? ""),
    titleEn: String(row.title_en ?? ""),
    summary: String(row.summary ?? ""),
    type: String(meta.type ?? "field_note"),
    categories: (row.categories as string[]) ?? [],
    productService: String(row.product_service ?? ""),
    audiences: (row.audiences as string[]) ?? [],
    keyMessage: String(row.key_message ?? ""),
    contentMd: String(row.content_md ?? ""),
    source: String(row.source ?? ""),
    sourceType: String(row.source_type ?? "internal"),
    sourceUrl: (meta.sourceUrl as string | undefined) ?? undefined,
    tags: (row.tags as string[]) ?? [],
    language: String(row.language ?? "th"),
    status: storeStatus,
    visibility: storeVis,
    ownerId: String(row.owner_id ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    versionHistory: (meta.versionHistory as StoreAsset["versionHistory"]) ?? [],
    attachments: (meta.attachments as StoreAsset["attachments"]) ?? [],
    learningObjectives: (meta.learningObjectives as string[]) ?? undefined,
    competencyTags: (meta.competencyTags as string[]) ?? undefined,
    relatedServices: (meta.relatedServices as string[]) ?? undefined,
    relatedCourses: (meta.relatedCourses as string[]) ?? undefined,
    linkedCurriculum: (meta.linkedCurriculum as string | undefined) ?? undefined,
    qaChecklist: (meta.qaChecklist as Record<string, boolean>) ?? undefined,
    approvedAt: (row.approved_at as string | null) ?? undefined,
    approvedBy: (row.approved_by as string | null) ?? undefined,
    coverUrl: (row.cover_url as string | null) ?? null,
    sponsors: (row.sponsors as Array<Record<string, any>>) ?? [],
    isFeatured: Boolean(row.is_featured),
    featuredOrder: Number(row.featured_order ?? 0),
  };
}

// ---------- List (staff) ----------

export const listStaffKnowledgeAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("knowledge_products")
      .select(SELECT_COLS)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: (data ?? []).map((r) => fromDb(r as Record<string, any>)) };
  });

// ---------- Save (insert or update) ----------

const SaveSchema = z.object({
  id: z.string().uuid().optional(),
  patch: z.object({
    slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/).optional(),
    titleTh: z.string().max(255).optional(),
    titleEn: z.string().max(255).optional(),
    summary: z.string().max(4000).optional(),
    keyMessage: z.string().max(4000).optional(),
    contentMd: z.string().max(500_000).optional(),
    type: z.string().max(64).optional(),
    categories: z.array(z.string().max(64)).optional(),
    productService: z.string().max(255).optional(),
    audiences: z.array(z.string().max(64)).optional(),
    source: z.string().max(4000).optional(),
    sourceType: z.string().max(64).optional(),
    sourceUrl: z.string().max(2000).optional(),
    tags: z.array(z.string().max(64)).optional(),
    language: z.string().max(8).optional(),
    status: z.enum(["draft", "review", "published", "archived"]).optional(),
    visibility: z.enum(["private", "staff", "public"]).optional(),
    coverUrl: z.string().url().max(2000).nullable().optional(),
    sponsors: z.array(z.record(z.any())).optional(),
    isFeatured: z.boolean().optional(),
    featuredOrder: z.number().int().min(0).max(999).optional(),
    learningObjectives: z.array(z.string().max(500)).optional(),
    competencyTags: z.array(z.string().max(64)).optional(),
    relatedServices: z.array(z.string().max(255)).optional(),
    relatedCourses: z.array(z.string().max(255)).optional(),
    linkedCurriculum: z.string().max(500).optional(),
    qaChecklist: z.record(z.boolean()).optional(),
    attachments: z.array(z.record(z.any())).optional(),
    versionHistory: z.array(z.record(z.any())).optional(),
    approvedAt: z.string().optional(),
    approvedBy: z.string().max(255).optional(),
  }),
});

export const saveKnowledgeAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SaveSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { id, patch } = data;

    // Read existing row to merge metadata when updating
    let existing: Record<string, any> | null = null;
    if (id) {
      const { data: row, error } = await context.supabase
        .from("knowledge_products")
        .select(SELECT_COLS)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      existing = row as Record<string, any> | null;
    }

    const existingMeta = ((existing?.metadata as Record<string, any>) ?? {}) as Record<string, any>;

    // Build patch payload (only fields present in patch get written)
    const cols: Record<string, any> = {};
    if (patch.slug !== undefined) cols.slug = patch.slug;
    if (patch.titleTh !== undefined) cols.title_th = patch.titleTh || patch.titleEn || patch.slug || "untitled";
    if (patch.titleEn !== undefined) cols.title_en = patch.titleEn || null;
    if (patch.summary !== undefined) cols.summary = patch.summary || null;
    if (patch.keyMessage !== undefined) cols.key_message = patch.keyMessage || null;
    if (patch.contentMd !== undefined) cols.content_md = patch.contentMd ?? "";
    if (patch.language !== undefined) cols.language = patch.language;
    if (patch.categories !== undefined) cols.categories = patch.categories;
    if (patch.tags !== undefined) cols.tags = patch.tags;
    if (patch.audiences !== undefined) cols.audiences = patch.audiences;
    if (patch.productService !== undefined) cols.product_service = patch.productService || null;
    if (patch.source !== undefined) cols.source = patch.source || null;
    if (patch.sourceType !== undefined) cols.source_type = patch.sourceType || null;
    if (patch.coverUrl !== undefined) cols.cover_url = patch.coverUrl;
    if (patch.sponsors !== undefined) cols.sponsors = patch.sponsors;
    if (patch.isFeatured !== undefined) cols.is_featured = patch.isFeatured;
    if (patch.featuredOrder !== undefined) cols.featured_order = patch.featuredOrder;

    if (patch.status !== undefined) {
      const m = toDbStatus(patch.status);
      cols.status = m.db;
      existingMeta.archived = m.archived;
      if (m.db === "published") {
        cols.published_at = new Date().toISOString();
        cols.approved_at = new Date().toISOString();
        cols.approved_by = context.userId;
      }
    }
    if (patch.visibility !== undefined) {
      const m = toDbVisibility(patch.visibility);
      cols.visibility = m.db;
      existingMeta.storeVisibility = m.store;
    }

    // Merge metadata fields
    const metaPatchKeys: Array<keyof typeof patch> = [
      "type",
      "sourceUrl",
      "learningObjectives",
      "competencyTags",
      "relatedServices",
      "relatedCourses",
      "linkedCurriculum",
      "qaChecklist",
      "attachments",
      "versionHistory",
    ];
    for (const k of metaPatchKeys) {
      if (patch[k] !== undefined) existingMeta[k] = patch[k];
    }
    if (patch.approvedAt !== undefined) cols.approved_at = patch.approvedAt;
    if (patch.approvedBy !== undefined) cols.approved_by = patch.approvedBy;
    cols.metadata = existingMeta;

    if (id) {
      const { data: row, error } = await context.supabase
        .from("knowledge_products")
        .update(cols as never)
        .eq("id", id)
        .select(SELECT_COLS)
        .single();
      if (error) throw new Error(error.message);
      return { item: fromDb(row as Record<string, any>) };
    } else {
      // Insert — slug & titleTh are required
      if (!cols.slug) throw new Error("slug is required to create knowledge");
      cols.owner_id = context.userId;
      const { data: row, error } = await context.supabase
        .from("knowledge_products")
        .insert(cols as never)
        .select(SELECT_COLS)
        .single();
      if (error) throw new Error(error.message);
      return { item: fromDb(row as Record<string, any>) };
    }
  });

// ---------- Delete ----------

export const deleteKnowledgeAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("knowledge_products")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
