import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { requireStaff, STAFF_ROLES } from "@/lib/auth-guards";

const BUCKET = "training-attachments";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// One path segment of safe characters, but not "." or ".." (path traversal).
const SAFE_SEGMENT = /^(?!\.+$)[a-zA-Z0-9._-]+$/;
// external_url is rendered as a link href; z.string().url() alone accepts javascript: URLs.
const HTTP_URL = /^https?:\/\//i;

type UserClient = SupabaseClient<Database>;

async function isStaffUser(supabase: UserClient, userId: string): Promise<boolean> {
  // RLS lets a signed-in user read their own role rows (same query as auth-guards).
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Forbidden: could not verify role");
  return (data ?? []).some((r) => (STAFF_ROLES as readonly string[]).includes(r.role));
}

// Same rule as the LMS RLS policies: enrolled in the course's classroom (public.is_enrolled).
async function isEnrolledInCourse(
  supabase: UserClient,
  userId: string,
  courseId: string,
): Promise<boolean> {
  if (!UUID_RE.test(courseId)) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: course } = await supabaseAdmin
    .from("courses")
    .select("classroom_id")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) return false;
  const { data: enrolled, error } = await supabase.rpc("is_enrolled", {
    _user: userId,
    _classroom: course.classroom_id,
  });
  if (error) throw new Error(error.message);
  return enrolled === true;
}

export const listLessonAttachments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ courseId: z.string().min(1).max(100) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const staff = await isStaffUser(context.supabase, context.userId);
    // Learners only see published files for courses in classrooms they are enrolled in.
    if (!staff && !(await isEnrolledInCourse(context.supabase, context.userId, data.courseId))) {
      return { attachments: [] };
    }
    let q = supabaseAdmin
      .from("lesson_attachments")
      .select("*")
      .eq("course_id", data.courseId)
      .order("created_at", { ascending: false });
    if (!staff) q = q.eq("published", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Sign URLs for storage files
    const enriched = await Promise.all(
      (rows ?? []).map(async (row) => {
        if (row.storage_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from(BUCKET)
            .createSignedUrl(row.storage_path, 60 * 60);
          return { ...row, signedUrl: signed?.signedUrl ?? null };
        }
        return { ...row, signedUrl: null };
      }),
    );
    return { attachments: enriched };
  });

export const createAttachmentUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireStaff])
  .inputValidator((i: unknown) =>
    z.object({
      courseId: z.string().min(1).max(100).regex(SAFE_SEGMENT),
      kind: z.enum(["slides", "video"]),
      filename: z.string().min(1).max(255),
    }).parse(i),
  )
  .handler(async ({ data }) => {
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
  .middleware([requireStaff])
  .inputValidator((i: unknown) =>
    z.object({
      courseId: z.string().min(1).max(100),
      lessonId: z.string().max(100).nullable().optional(),
      kind: z.enum(["slides", "video", "video_url"]),
      storagePath: z.string().max(500).nullable().optional(),
      externalUrl: z.string().url().max(500).regex(HTTP_URL).nullable().optional(),
      title: z.string().max(255).nullable().optional(),
      description: z.string().max(2000).nullable().optional(),
      language: z.enum(["th", "en"]).default("th"),
      published: z.boolean().default(false),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    // Only link files uploaded through createAttachmentUploadUrl for this course,
    // so a lesson row can never expose another file (e.g. voice/) in the shared bucket.
    // ".." is checked per segment: a filename like "deck..v2.pdf" is legitimate.
    if (
      data.storagePath &&
      (!data.storagePath.startsWith(`lessons/${data.courseId}/`) ||
        data.storagePath.split("/").includes(".."))
    ) {
      throw new Error("Invalid storage path");
    }
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
  .middleware([requireStaff])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
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
