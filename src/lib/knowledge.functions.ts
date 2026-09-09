import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type KnowledgeSponsor = { name: string; role?: string; logoUrl?: string };

export type KnowledgeAttachment = {
  path: string;            // storage key inside knowledge-attachments bucket
  name: string;            // original filename to display
  size: number;            // bytes
  contentType: string;     // e.g. application/pdf, image/png
  uploadedAt: string;      // ISO timestamp
  url?: string;            // populated server-side as a signed URL when reading
};

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
  attachments: KnowledgeAttachment[];
  status: "draft" | "in_review" | "published";
  visibility: "internal" | "public";
  isFeatured: boolean;
  featuredOrder: number;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
};

const SELECT_COLS =
  "id, slug, title_th, title_en, summary, key_message, content_md, language, categories, tags, audiences, product_service, source, source_type, cover_url, sponsors, status, visibility, is_featured, featured_order, published_at, updated_at, created_at, metadata";

function normalizeAttachments(raw: unknown): KnowledgeAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const a = (r ?? {}) as Record<string, unknown>;
      const url = (a.url as string) || (a.externalUrl as string) || "";
      return {
        path: String(a.path ?? ""),
        name: String(a.name ?? a.title ?? "Attachment"),
        size: Number(a.size ?? 0),
        contentType: String(a.contentType ?? (a.kind === "pdf" ? "application/pdf" : "application/octet-stream")),
        uploadedAt: String(a.uploadedAt ?? ""),
        ...(url && !url.startsWith("blob:") ? { url } : {}),
      } as KnowledgeAttachment;
    })
    // drop entries that can neither be signed (no storage path) nor linked
    .filter((a) => a.path || a.url);
}

function mapRow(r: Record<string, unknown>): KnowledgeRow {
  const meta = ((r.metadata as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  const attachments = normalizeAttachments(meta.attachments);

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
    attachments,
    status: (r.status as KnowledgeRow["status"]) ?? "draft",
    visibility: (r.visibility as KnowledgeRow["visibility"]) ?? "internal",
    isFeatured: Boolean(r.is_featured),
    featuredOrder: Number(r.featured_order ?? 0),
    publishedAt: (r.published_at as string | null) ?? null,
    updatedAt: String(r.updated_at ?? ""),
    createdAt: String(r.created_at ?? ""),
  };
}

// Enrich attachments with signed URLs (7-day expiry). Best-effort.
async function signAttachments(
  client: { storage: { from: (b: string) => { createSignedUrl: (p: string, exp: number) => Promise<{ data: { signedUrl: string } | null; error: unknown }> } } },
  rows: KnowledgeRow[],
): Promise<KnowledgeRow[]> {
  for (const row of rows) {
    for (const a of row.attachments ?? []) {
      if (!a?.path) continue;
      try {
        const { data } = await client.storage.from("knowledge-attachments").createSignedUrl(a.path, 60 * 60 * 24 * 7);
        if (data?.signedUrl) a.url = data.signedUrl;
      } catch { /* ignore */ }
    }
  }
  return rows;
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
    await signAttachments(supabaseAdmin, [mapped]);
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
    const rows = (data ?? []).map(mapRow);
    await signAttachments(context.supabase as never, rows);
    return { items: rows };
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
      .upsert(payload as never, { onConflict: "slug" })
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(error.message);
    return { item: mapRow(row as Record<string, unknown>) };
  });


// ===== Attachments =====

const AttachmentSchema = z.object({
  path: z.string().min(1).max(500),
  name: z.string().min(1).max(255),
  size: z.number().int().min(0).max(50 * 1024 * 1024),
  contentType: z.string().max(127).default("application/octet-stream"),
  uploadedAt: z.string().optional(),
});

export const setKnowledgeAttachments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      attachments: z.array(AttachmentSchema).max(50),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    // Merge into existing metadata to preserve other keys
    const { data: existing, error: readErr } = await context.supabase
      .from("knowledge_products")
      .select("metadata")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    const meta = ((existing?.metadata as Record<string, unknown>) ?? {}) as Record<string, unknown>;
    const prevAttachments = (Array.isArray(meta.attachments) ? meta.attachments : []) as KnowledgeAttachment[];
    const nowIso = new Date().toISOString();
    const nextAttachments = data.attachments.map((a) => ({
      path: a.path,
      name: a.name,
      size: a.size,
      contentType: a.contentType,
      uploadedAt: a.uploadedAt ?? nowIso,
    }));
    meta.attachments = nextAttachments;
    const { data: row, error } = await context.supabase
      .from("knowledge_products")
      .update({ metadata: meta as never })
      .eq("id", data.id)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(error.message);

    // Diff and log attachment activity (best-effort)
    try {
      const prevPaths = new Set(prevAttachments.map((a) => a.path));
      const nextPaths = new Set(nextAttachments.map((a) => a.path));
      const added = nextAttachments.filter((a) => !prevPaths.has(a.path));
      const removed = prevAttachments.filter((a) => !nextPaths.has(a.path));
      const logRows = [
        ...added.map((a) => ({
          knowledge_id: data.id,
          actor_id: context.userId,
          action: "attachment_uploaded",
          attachment_path: a.path,
          attachment_name: a.name,
          attachment_size: a.size,
          attachment_content_type: a.contentType,
        })),
        ...removed.map((a) => ({
          knowledge_id: data.id,
          actor_id: context.userId,
          action: "attachment_deleted",
          attachment_path: a.path,
          attachment_name: a.name,
          attachment_size: a.size,
          attachment_content_type: a.contentType,
        })),
      ];
      if (logRows.length > 0) {
        await context.supabase.from("knowledge_activity_logs").insert(logRows as never);
      }
    } catch { /* ignore logging errors */ }

    const mapped = mapRow(row as Record<string, unknown>);
    await signAttachments(context.supabase as never, [mapped]);
    return { item: mapped };
  });

export type KnowledgeActivityLog = {
  id: string;
  knowledgeId: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  attachmentPath: string | null;
  attachmentName: string | null;
  attachmentSize: number | null;
  attachmentContentType: string | null;
  createdAt: string;
};

export const listKnowledgeActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ knowledgeId: z.string().uuid(), limit: z.number().int().min(1).max(200).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("knowledge_activity_logs")
      .select("id, knowledge_id, actor_id, action, attachment_path, attachment_name, attachment_size, attachment_content_type, created_at")
      .eq("knowledge_id", data.knowledgeId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (error) throw new Error(error.message);

    const items: KnowledgeActivityLog[] = (rows ?? []).map((r) => {
      const rec = r as Record<string, unknown>;
      return {
        id: String(rec.id),
        knowledgeId: String(rec.knowledge_id),
        actorId: (rec.actor_id as string | null) ?? null,
        actorEmail: null,
        action: String(rec.action ?? ""),
        attachmentPath: (rec.attachment_path as string | null) ?? null,
        attachmentName: (rec.attachment_name as string | null) ?? null,
        attachmentSize: (rec.attachment_size as number | null) ?? null,
        attachmentContentType: (rec.attachment_content_type as string | null) ?? null,
        createdAt: String(rec.created_at ?? ""),
      };
    });

    // Best-effort actor email enrichment via admin Auth API
    try {
      const actorIds = Array.from(new Set(items.map((i) => i.actorId).filter((v): v is string => Boolean(v))));
      if (actorIds.length > 0) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const emailMap = new Map<string, string>();
        for (const uid of actorIds) {
          try {
            const { data: u } = await (supabaseAdmin as never as {
              auth: { admin: { getUserById: (id: string) => Promise<{ data: { user: { email: string | null } | null } | null }> } };
            }).auth.admin.getUserById(uid);
            const email = u?.user?.email ?? null;
            if (email) emailMap.set(uid, email);
          } catch { /* ignore */ }
        }
        for (const it of items) {
          if (it.actorId && emailMap.has(it.actorId)) it.actorEmail = emailMap.get(it.actorId) ?? null;
        }
      }
    } catch { /* ignore */ }

    return { items };
  });

export const createKnowledgeAttachmentSignedUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), filename: z.string().min(1).max(255) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const safe = data.filename.replace(/[^\w.\-]+/g, "_").slice(-200);
    const path = `${data.id}/${Date.now()}-${safe}`;
    const { data: signed, error } = await (context.supabase as never as {
      storage: { from: (b: string) => { createSignedUploadUrl: (p: string) => Promise<{ data: { signedUrl: string; token: string; path: string } | null; error: unknown }> } };
    }).storage.from("knowledge-attachments").createSignedUploadUrl(path);
    if (error || !signed) throw new Error((error as Error)?.message ?? "Failed to create upload URL");
    return { path: signed.path, token: signed.token };
  });
