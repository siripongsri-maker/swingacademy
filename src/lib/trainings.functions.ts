import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TrainingInput = z.object({
  id: z.string().uuid().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  topics: z.string().nullable().optional(),
  visit_type: z.string().nullable().optional(),
  sites: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  meeting_notes: z.string().nullable().optional(),
  participants: z.string().nullable().optional(),
  outcomes: z.string().nullable().optional(),
  published: z.boolean().optional(),
  public_title_en: z.string().nullable().optional(),
  public_title_th: z.string().nullable().optional(),
  public_summary_en: z.string().nullable().optional(),
  public_summary_th: z.string().nullable().optional(),
  cover_attachment_id: z.string().uuid().nullable().optional(),
});

export const listTrainings = createServerFn({ method: "GET" })
  .inputValidator((input: { publishedOnly?: boolean; limit?: number } | undefined) => input ?? {})
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("trainings")
      .select("*")
      .order("start_date", { ascending: false, nullsFirst: false })
      .limit(data.limit ?? 1000);
    if (data.publishedOnly) q = q.eq("published", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const getTraining = createServerFn({ method: "GET" })
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: t, error: e1 }, { data: atts, error: e2 }] = await Promise.all([
      supabaseAdmin.from("trainings").select("*").eq("id", data.id).maybeSingle(),
      supabaseAdmin.from("training_attachments").select("*").eq("training_id", data.id).order("created_at"),
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    return { training: t, attachments: atts ?? [] };
  });

export const upsertTraining = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TrainingInput.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { id, ...patch } = data;
      const { data: row, error } = await supabaseAdmin
        .from("trainings").update(patch).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return { training: row };
    }
    const { data: row, error } = await supabaseAdmin
      .from("trainings").insert({ ...data, source: "manual" }).select().single();
    if (error) throw new Error(error.message);
    return { training: row };
  });

export const deleteTraining = createServerFn({ method: "POST" })
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("trainings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((i: { trainingId: string; filename: string }) =>
    z.object({ trainingId: z.string().uuid(), filename: z.string().min(1).max(200) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const path = `${data.trainingId}/${Date.now()}-${safe}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("training-attachments")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

export const recordAttachment = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    training_id: z.string().uuid(),
    storage_path: z.string(),
    label: z.string().nullable().optional(),
    mime_type: z.string().nullable().optional(),
    size_bytes: z.number().nullable().optional(),
    kind: z.string().default("file"),
    is_public: z.boolean().default(false),
  }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("training_attachments").insert(data).select().single();
    if (error) throw new Error(error.message);
    return { attachment: row };
  });

export const setAttachmentPublic = createServerFn({ method: "POST" })
  .inputValidator((i: { id: string; is_public: boolean }) =>
    z.object({ id: z.string().uuid(), is_public: z.boolean() }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("training_attachments").update({ is_public: data.is_public }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAttachment = createServerFn({ method: "POST" })
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("training_attachments").select("storage_path").eq("id", data.id).maybeSingle();
    if (row?.storage_path) {
      await supabaseAdmin.storage.from("training-attachments").remove([row.storage_path]);
    }
    const { error } = await supabaseAdmin.from("training_attachments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const signAttachmentUrl = createServerFn({ method: "POST" })
  .inputValidator((i: { path: string }) =>
    z.object({ path: z.string().min(1) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("training-attachments").createSignedUrl(data.path, 60 * 60);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
