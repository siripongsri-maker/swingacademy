// Server functions for knowledge translations (per-format published variants).
// Public anon read returns ONLY published translations of public+published assets.
// Staff/admin manage writes.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TranslationStatus = "draft" | "ready" | "published";

export type TranslationRow = {
  id: string;
  assetId: string;
  audience: string;
  format: string;
  tone: string;
  language: string;
  instruction: string;
  outputMd: string;
  title: string | null;
  status: TranslationStatus;
  contributorId: string | null;
  ownerId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const COLS =
  "id, asset_id, audience, format, tone, language, instruction, output_md, title, status, contributor_id, owner_id, published_at, created_at, updated_at";

function fromDb(r: Record<string, any>): TranslationRow {
  return {
    id: String(r.id),
    assetId: String(r.asset_id),
    audience: String(r.audience ?? ""),
    format: String(r.format ?? ""),
    tone: String(r.tone ?? ""),
    language: String(r.language ?? "th"),
    instruction: String(r.instruction ?? ""),
    outputMd: String(r.output_md ?? ""),
    title: (r.title as string | null) ?? null,
    status: (r.status as TranslationStatus) ?? "draft",
    contributorId: (r.contributor_id as string | null) ?? null,
    ownerId: (r.owner_id as string | null) ?? null,
    publishedAt: (r.published_at as string | null) ?? null,
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

// ===== Staff reads (RLS allows staff/admin to see all) =====
export const listTranslations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("knowledge_translations")
      .select(COLS)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: (data ?? []).map((r) => fromDb(r as Record<string, any>)) };
  });

// ===== Public read by asset slug =====
export const listPublishedTranslationsBySlug = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ slug: z.string().min(1).max(255) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: asset, error: aErr } = await supabaseAdmin
      .from("knowledge_products")
      .select("id, visibility, status")
      .eq("slug", data.slug)
      .maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (!asset || (asset as any).visibility !== "public" || (asset as any).status !== "published") {
      return { items: [] };
    }
    const { data: rows, error } = await supabaseAdmin
      .from("knowledge_translations")
      .select(COLS)
      .eq("asset_id", (asset as any).id)
      .eq("status", "published")
      .order("published_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: (rows ?? []).map((r) => fromDb(r as Record<string, any>)) };
  });

const SaveSchema = z.object({
  id: z.string().uuid().optional(),
  assetId: z.string().uuid(),
  audience: z.string().min(1).max(64),
  format: z.string().min(1).max(64),
  tone: z.string().min(1).max(64),
  language: z.string().min(1).max(16),
  instruction: z.string().max(4000).default(""),
  outputMd: z.string().max(200000).default(""),
  title: z.string().max(255).nullable().optional(),
  status: z.enum(["draft", "ready", "published"]).default("draft"),
  contributorId: z.string().max(128).nullable().optional(),
});

async function assertStaff(context: { supabase: any; userId: string }) {
  const { data: isStaff } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "staff",
  });
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isStaff && !isAdmin) throw new Error("Forbidden");
}

export const saveTranslation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SaveSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const nowIso = new Date().toISOString();
    const payload: Record<string, any> = {
      asset_id: data.assetId,
      audience: data.audience,
      format: data.format,
      tone: data.tone,
      language: data.language,
      instruction: data.instruction,
      output_md: data.outputMd,
      title: data.title ?? null,
      status: data.status,
      contributor_id: data.contributorId ?? null,
      owner_id: context.userId,
      ...(data.status === "published" ? { published_at: nowIso } : {}),
    };
    const q = data.id
      ? context.supabase
          .from("knowledge_translations")
          .update(payload)
          .eq("id", data.id)
          .select(COLS)
          .single()
      : context.supabase
          .from("knowledge_translations")
          .insert(payload)
          .select(COLS)
          .single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return { item: fromDb(row as Record<string, any>) };
  });

export const removeTranslation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { error } = await context.supabase
      .from("knowledge_translations")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
