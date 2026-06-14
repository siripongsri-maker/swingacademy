// Server functions for knowledge ↔ person mappings.
// Reads are public so the Talent Map can render anywhere.
// Writes require staff/admin (RLS enforces this too).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES = ["contributor", "reviewer", "trainer", "practitioner", "expert"] as const;
type Role = (typeof ROLES)[number];

export type StoreTalentMapping = {
  id: string;
  personId: string;
  assetId: string;
  role: Role;
  evidence: Array<{ id: string; type: string; note: string; date: string }>;
  createdAt: string;
  updatedAt: string;
};

function fromDb(row: Record<string, any>): StoreTalentMapping {
  return {
    id: String(row.id),
    personId: String(row.person_id),
    assetId: String(row.asset_id),
    role: row.role as Role,
    evidence: Array.isArray(row.evidence) ? (row.evidence as StoreTalentMapping["evidence"]) : [],
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

// Public read — anyone can list mappings (no PII; only person_id refs).
export const listTalentMappings = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("knowledge_talent_mappings")
    .select("id, person_id, asset_id, role, evidence, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { items: (data ?? []).map((r) => fromDb(r as Record<string, any>)) };
});

const UpsertSchema = z.object({
  personId: z.string().min(1).max(128),
  assetId: z.string().uuid(),
  role: z.enum(ROLES),
});

export const upsertTalentMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    // Authorize: must be staff or admin
    const { data: isStaff } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "staff",
    });
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isStaff && !isAdmin) throw new Error("Forbidden");

    const { data: row, error } = await context.supabase
      .from("knowledge_talent_mappings")
      .upsert(
        { person_id: data.personId, asset_id: data.assetId, role: data.role } as never,
        { onConflict: "person_id,asset_id" },
      )
      .select("id, person_id, asset_id, role, evidence, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return { item: fromDb(row as Record<string, any>) };
  });

export const removeTalentMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("knowledge_talent_mappings")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const EvidenceSchema = z.object({
  mappingId: z.string().uuid(),
  evidence: z.object({
    type: z.string().min(1).max(64),
    note: z.string().max(2000),
    date: z.string().max(64),
  }),
});

export const addTalentEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => EvidenceSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: existing, error: readErr } = await context.supabase
      .from("knowledge_talent_mappings")
      .select("evidence")
      .eq("id", data.mappingId)
      .single();
    if (readErr) throw new Error(readErr.message);
    const list = Array.isArray((existing as any)?.evidence) ? ((existing as any).evidence as any[]) : [];
    const next = [
      {
        id: `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        ...data.evidence,
      },
      ...list,
    ];
    const { error } = await context.supabase
      .from("knowledge_talent_mappings")
      .update({ evidence: next } as never)
      .eq("id", data.mappingId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeTalentEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ mappingId: z.string().uuid(), evidenceId: z.string().min(1).max(128) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: existing, error: readErr } = await context.supabase
      .from("knowledge_talent_mappings")
      .select("evidence")
      .eq("id", data.mappingId)
      .single();
    if (readErr) throw new Error(readErr.message);
    const list = Array.isArray((existing as any)?.evidence) ? ((existing as any).evidence as any[]) : [];
    const next = list.filter((ev) => ev.id !== data.evidenceId);
    const { error } = await context.supabase
      .from("knowledge_talent_mappings")
      .update({ evidence: next } as never)
      .eq("id", data.mappingId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
