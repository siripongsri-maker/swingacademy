import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// All analytics writes/reads run through the service-role admin client.
// RLS is enabled on the underlying tables with no public policies so users
// cannot tamper with counts or other people's ratings directly.

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// ---------- Knowledge views ----------

export const trackKnowledgeView = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      slug: z.string().min(1).max(255),
      knowledgeId: z.string().uuid().optional().nullable(),
      viewerHash: z.string().max(128).optional(),
      userAgent: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    await admin.from("knowledge_views").insert({
      slug: data.slug,
      knowledge_id: data.knowledgeId ?? null,
      viewer_hash: data.viewerHash ?? null,
      user_agent: data.userAgent ?? null,
    } as never);
    return { ok: true };
  });

export type KnowledgeStats = {
  views: number;
  uniqueViews: number;
  ratingCount: number;
  ratingAvg: number;
};

export const getKnowledgeStats = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ slug: z.string().min(1).max(255) }).parse(i))
  .handler(async ({ data }): Promise<{ stats: KnowledgeStats }> => {
    const admin = await getAdmin();
    const [{ count: views }, { data: hashRows }, { data: ratings }] = await Promise.all([
      admin.from("knowledge_views").select("id", { count: "exact", head: true }).eq("slug", data.slug),
      admin.from("knowledge_views").select("viewer_hash").eq("slug", data.slug).not("viewer_hash", "is", null),
      admin.from("knowledge_ratings").select("rating").eq("slug", data.slug),
    ]);
    const unique = new Set((hashRows ?? []).map((r) => (r as { viewer_hash: string }).viewer_hash)).size;
    const ratingList = (ratings ?? []).map((r) => (r as { rating: number }).rating);
    const ratingAvg = ratingList.length > 0 ? ratingList.reduce((a, b) => a + b, 0) / ratingList.length : 0;
    return {
      stats: {
        views: views ?? 0,
        uniqueViews: unique,
        ratingCount: ratingList.length,
        ratingAvg: Math.round(ratingAvg * 10) / 10,
      },
    };
  });

export const submitKnowledgeRating = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      slug: z.string().min(1).max(255),
      knowledgeId: z.string().uuid().optional().nullable(),
      raterHash: z.string().min(4).max(128),
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(2000).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const { error } = await admin.from("knowledge_ratings").upsert(
      {
        slug: data.slug,
        knowledge_id: data.knowledgeId ?? null,
        rater_hash: data.raterHash,
        rating: data.rating,
        comment: data.comment ?? null,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "knowledge_id,rater_hash" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Bulk stats for the staff library list page
export const listKnowledgeStats = createServerFn({ method: "GET" }).handler(async () => {
  const admin = await getAdmin();
  const [{ data: views }, { data: ratings }] = await Promise.all([
    admin.from("knowledge_views").select("slug"),
    admin.from("knowledge_ratings").select("slug, rating"),
  ]);
  const stats: Record<string, { views: number; ratingCount: number; ratingAvg: number }> = {};
  for (const r of views ?? []) {
    const s = (r as { slug: string }).slug;
    if (!stats[s]) stats[s] = { views: 0, ratingCount: 0, ratingAvg: 0 };
    stats[s].views += 1;
  }
  const agg: Record<string, number[]> = {};
  for (const r of ratings ?? []) {
    const row = r as { slug: string; rating: number };
    (agg[row.slug] ??= []).push(row.rating);
  }
  for (const [slug, list] of Object.entries(agg)) {
    if (!stats[slug]) stats[slug] = { views: 0, ratingCount: 0, ratingAvg: 0 };
    stats[slug].ratingCount = list.length;
    stats[slug].ratingAvg = Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10;
  }
  return { stats };
});

// ---------- Homepage / site visits ----------

export const trackSiteVisit = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      path: z.string().max(255).optional(),
      visitorHash: z.string().max(128).optional(),
      userAgent: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    await admin.from("site_visits").insert({
      path: data.path ?? "/",
      visitor_hash: data.visitorHash ?? null,
      user_agent: data.userAgent ?? null,
    } as never);
    return { ok: true };
  });

export type SiteVisitStats = { total: number; unique: number; today: number };

export const getHomepageStats = createServerFn({ method: "GET" }).handler(async (): Promise<{ stats: SiteVisitStats }> => {
  const admin = await getAdmin();
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const [{ count: total }, { data: hashRows }, { count: today }] = await Promise.all([
    admin.from("site_visits").select("id", { count: "exact", head: true }).eq("path", "/"),
    admin.from("site_visits").select("visitor_hash").eq("path", "/").not("visitor_hash", "is", null),
    admin.from("site_visits").select("id", { count: "exact", head: true }).eq("path", "/").gte("created_at", since.toISOString()),
  ]);
  const unique = new Set((hashRows ?? []).map((r) => (r as { visitor_hash: string }).visitor_hash)).size;
  return { stats: { total: total ?? 0, unique, today: today ?? 0 } };
});
