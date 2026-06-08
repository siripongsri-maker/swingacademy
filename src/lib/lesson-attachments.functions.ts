import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "training-attachments";

async function assertStaff(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "staff" });
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data && !isAdmin) throw new Error("Staff access required");
}

export const listLessonAttachments = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({ courseId: z.string().min(1).max(100) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("lesson_attachments")
      .select("*")
      .eq("course_id", data.courseId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Sign URLs for storage files
    const enriched = await Promise.all(
      (rows ?? []).map(async (row) => {
        if (row.storage_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from(BUCKET)
            .createSignedUrl(row.storage_path, 60 * 60 * 6);
          return { ...row, signedUrl: signed?.signedUrl ?? null };
        }
        return { ...row, signedUrl: null };
      }),
    );
    return { attachments: enriched };
  });

export const createAttachmentUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      courseId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._-]+$/),
      kind: z.enum(["slides", "video"]),
      filename: z.string().min(1).max(255),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const path = `lessons/${data.courseId}/${data.kind}/${Date.now()}-${safe}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

export const saveLessonAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      courseId: z.string().min(1).max(100),
      lessonId: z.string().max(100).nullable().optional(),
      kind: z.enum(["slides", "video", "video_url"]),
      storagePath: z.string().max(500).nullable().optional(),
      externalUrl: z.string().url().max(500).nullable().optional(),
      title: z.string().max(255).nullable().optional(),
      description: z.string().max(2000).nullable().optional(),
      language: z.enum(["th", "en"]).default("th"),
      published: z.boolean().default(false),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("lesson_attachments")
      .insert({
        course_id: data.courseId,
        lesson_id: data.lessonId ?? null,
        kind: data.kind,
        storage_path: data.storagePath ?? null,
        external_url: data.externalUrl ?? null,
        title: data.title ?? null,
        description: data.description ?? null,
        language: data.language,
        published: data.published,
        uploaded_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { attachment: row };
  });

export const deleteLessonAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("lesson_attachments")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (existing?.storage_path) {
      await supabaseAdmin.storage.from(BUCKET).remove([existing.storage_path]);
    }
    const { error } = await supabaseAdmin
      .from("lesson_attachments")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
