import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type KnowledgeSponsor = { name: string; role?: string; logoUrl?: string };

export type KnowledgeRow = {
  id: string;
  slug: string;
  titleTh: string;
  titleEn: string | null;
  summary: string | null;
  keyMessage: string | null;
  contentMd: string;
  language: string;
  categories: string[];
  tags: string[];
  audiences: string[];
  productService: string | null;
  source: string | null;
  sourceType: string | null;
  coverUrl: string | null;
  sponsors: KnowledgeSponsor[];
  status: "draft" | "in_review" | "published";
  visibility: "internal" | "public";
  isFeatured: boolean;
  featuredOrder: number;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
};

const SELECT_COLS =
  "id, slug, title_th, title_en, summary, key_message, content_md, language, categories, tags, audiences, product_service, source, source_type, cover_url, sponsors, status, visibility, is_featured, featured_order, published_at, updated_at, created_at";

function mapRow(r: Record<string, unknown>): KnowledgeRow {
  return {
    id: String(r.id),
    slug: String(r.slug),
    titleTh: String(r.title_th ?? ""),
    titleEn: (r.title_en as string | null) ?? null,
    summary: (r.summary as string | null) ?? null,
    keyMessage: (r.key_message as string | null) ?? null,
    contentMd: String(r.content_md ?? ""),
    language: String(r.language ?? "th"),
    categories: (r.categories as string[]) ?? [],
    tags: (r.tags as string[]) ?? [],
    audiences: (r.audiences as string[]) ?? [],
    productService: (r.product_service as string | null) ?? null,
    source: (r.source as string | null) ?? null,
    sourceType: (r.source_type as string | null) ?? null,
    coverUrl: (r.cover_url as string | null) ?? null,
    sponsors: (r.sponsors as KnowledgeSponsor[]) ?? [],
    status: (r.status as KnowledgeRow["status"]) ?? "draft",
    visibility: (r.visibility as KnowledgeRow["visibility"]) ?? "internal",
    isFeatured: Boolean(r.is_featured),
    featuredOrder: Number(r.featured_order ?? 0),
    publishedAt: (r.published_at as string | null) ?? null,
    updatedAt: String(r.updated_at ?? ""),
    createdAt: String(r.created_at ?? ""),
  };
}

// ===== Public reads (no auth; called from SSR loaders) =====

export const listPublicKnowledge = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("knowledge_products")
    .select(SELECT_COLS)
    .eq("visibility", "public")
    .eq("status", "published")
    .order("is_featured", { ascending: false })
    .order("featured_order", { ascending: true })
    .order("published_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { items: (data ?? []).map(mapRow) };
});

export const listFeaturedKnowledge = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ limit: z.number().min(1).max(12).optional() }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const limit = data.limit ?? 3;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("knowledge_products")
      .select(SELECT_COLS)
      .eq("visibility", "public")
      .eq("status", "published")
      .eq("is_featured", true)
      .order("featured_order", { ascending: true })
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return { items: (rows ?? []).map(mapRow) };
  });

export const getPublicKnowledgeBySlug = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ slug: z.string().min(1).max(255) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("knowledge_products")
      .select(SELECT_COLS)
      .eq("slug", data.slug)
      .eq("visibility", "public")
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { item: null };
    const mapped = mapRow(row);
    // If DB content is empty (seeded without markdown body), fall back to bundled HIVST content
    if (!mapped.contentMd && mapped.slug === "hivst-community-led-model") {
      const { default: contentMd } = await import("@/data/hivst-content.md?raw");
      mapped.contentMd = contentMd as unknown as string;
    }
    return { item: mapped };
  });

// ===== Staff/Admin reads + writes =====

export const listAllKnowledge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("knowledge_products")
      .select(SELECT_COLS)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: (data ?? []).map(mapRow) };
  });

const UpsertSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  titleTh: z.string().min(1).max(255),
  titleEn: z.string().max(255).optional().nullable(),
  summary: z.string().max(2000).optional().nullable(),
  keyMessage: z.string().max(2000).optional().nullable(),
  contentMd: z.string().max(200000).optional().default(""),
  language: z.string().max(8).optional().default("th"),
  categories: z.array(z.string().max(64)).max(20).optional().default([]),
  tags: z.array(z.string().max(64)).max(30).optional().default([]),
  audiences: z.array(z.string().max(64)).max(20).optional().default([]),
  productService: z.string().max(255).optional().nullable(),
  source: z.string().max(255).optional().nullable(),
  sourceType: z.string().max(64).optional().nullable(),
  coverUrl: z.string().url().max(2000).optional().nullable(),
  sponsors: z.array(z.object({
    name: z.string().min(1).max(255),
    role: z.string().max(255).optional(),
    logoUrl: z.string().url().max(2000).optional(),
  })).max(20).optional().default([]),
});

export const upsertKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const payload = {
      slug: data.slug,
      title_th: data.titleTh,
      title_en: data.titleEn ?? null,
      summary: data.summary ?? null,
      key_message: data.keyMessage ?? null,
      content_md: data.contentMd ?? "",
      language: data.language,
      categories: data.categories,
      tags: data.tags,
      audiences: data.audiences,
      product_service: data.productService ?? null,
      source: data.source ?? null,
      source_type: data.sourceType ?? null,
      cover_url: data.coverUrl ?? null,
      sponsors: data.sponsors,
      owner_id: context.userId,
    };
    const query = data.id
      ? context.supabase.from("knowledge_products").update(payload).eq("id", data.id).select(SELECT_COLS).single()
      : context.supabase.from("knowledge_products").insert(payload).select(SELECT_COLS).single();
    const { data: row, error } = await query;
    if (error) throw new Error(error.message);
    return { item: mapRow(row as Record<string, unknown>) };
  });

const PublishSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["draft", "in_review", "published"]).optional(),
  visibility: z.enum(["internal", "public"]).optional(),
  isFeatured: z.boolean().optional(),
  featuredOrder: z.number().int().min(0).max(999).optional(),
});

export const setKnowledgePublishState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PublishSchema.parse(i))
  .handler(async ({ data, context }) => {
    const nowIso = new Date().toISOString();
    const patch = {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.visibility !== undefined ? { visibility: data.visibility } : {}),
      ...(data.isFeatured !== undefined ? { is_featured: data.isFeatured } : {}),
      ...(data.featuredOrder !== undefined ? { featured_order: data.featuredOrder } : {}),
      ...(data.status === "published"
        ? { published_at: nowIso, approved_by: context.userId, approved_at: nowIso }
        : {}),
    };
    const { data: row, error } = await context.supabase
      .from("knowledge_products")
      .update(patch)
      .eq("id", data.id)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(error.message);
    return { item: mapRow(row as Record<string, unknown>) };
  });

export const deleteKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("knowledge_products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Upsert + set publish state by slug — used to sync local console store with DB
const PublishBySlugSchema = z.object({
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  titleTh: z.string().min(1).max(255),
  titleEn: z.string().max(255).nullable().optional(),
  summary: z.string().max(2000).nullable().optional(),
  contentMd: z.string().max(200000).optional().default(""),
  categories: z.array(z.string().max(64)).max(20).optional().default([]),
  tags: z.array(z.string().max(64)).max(30).optional().default([]),
  status: z.enum(["draft", "in_review", "published"]).optional(),
  visibility: z.enum(["internal", "public"]).optional(),
});

export const publishKnowledgeBySlug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PublishBySlugSchema.parse(i))
  .handler(async ({ data, context }) => {
    const nowIso = new Date().toISOString();
    const setPublished = data.status === "published";
    const payload: Record<string, unknown> = {
      slug: data.slug,
      title_th: data.titleTh,
      title_en: data.titleEn ?? null,
      summary: data.summary ?? null,
      content_md: data.contentMd ?? "",
      categories: data.categories,
      tags: data.tags,
      owner_id: context.userId,
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.visibility !== undefined ? { visibility: data.visibility } : {}),
      ...(setPublished
        ? { published_at: nowIso, approved_at: nowIso, approved_by: context.userId }
        : {}),
    };
    const { data: row, error } = await context.supabase
      .from("knowledge_products")
      .upsert(payload, { onConflict: "slug" })
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(error.message);
    return { item: mapRow(row as Record<string, unknown>) };
  });

