// Voice recordings — metadata only; file payload goes to training-attachments bucket.
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { ADMIN_ROLES, STAFF_ROLES } from "@/lib/auth-guards";

const VOICE_PATH_RE =
  /^voice\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([^/]+)$/;

// voice/<owner uid>/<file> → owner uid, or null for any other shape (incl. "." / ".." names).
// voice_insert RLS only checks user_id, so a row inserted directly can carry any file_path;
// callers trust a record only when its user_id matches the folder the file sits in.
function voicePathOwner(path: string): string | null {
  const m = VOICE_PATH_RE.exec(path);
  if (!m || m[2] === "." || m[2] === "..") return null;
  return m[1];
}

async function callerHasRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  allowed: readonly string[],
): Promise<boolean> {
  // RLS lets a signed-in user read their own role rows (same query as auth-guards).
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Forbidden: could not verify role");
  return (data ?? []).some((r) => allowed.includes(r.role));
}

export type VoiceRecord = {
  id: string;
  lesson_id: string | null;
  course_id: string | null;
  user_id: string;
  title: string | null;
  file_path: string;
  duration_sec: number | null;
  mime: string | null;
  created_at: string;
};

export const listMyVoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("voice_records")
      .select("*, lessons(title), courses(title)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<VoiceRecord & { lessons: { title: string } | null; courses: { title: string } | null }>;
  });

export const listLessonVoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lesson_id: string }) =>
    z.object({ lesson_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("voice_records")
      .select("*")
      .eq("lesson_id", data.lesson_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as VoiceRecord[];
  });

export const createVoiceRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      lesson_id?: string | null;
      course_id?: string | null;
      title?: string;
      file_path: string;
      duration_sec?: number;
      mime?: string;
    }) =>
      z
        .object({
          lesson_id: z.string().uuid().nullable().optional(),
          course_id: z.string().uuid().nullable().optional(),
          title: z.string().max(200).optional(),
          file_path: z.string().min(1).max(500),
          duration_sec: z.number().int().min(0).max(86400).optional(),
          mime: z.string().max(80).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Enforce path prefix matches caller
    if (voicePathOwner(data.file_path) !== userId) {
      throw new Error("Invalid file path");
    }
    const { data: row, error } = await supabase
      .from("voice_records")
      .insert({
        user_id: userId,
        lesson_id: data.lesson_id ?? null,
        course_id: data.course_id ?? null,
        title: data.title ?? null,
        file_path: data.file_path,
        duration_sec: data.duration_sec ?? null,
        mime: data.mime ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as VoiceRecord;
  });

export const deleteVoiceRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("voice_records")
      .select("file_path,user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Not allowed");
    const isOwner = row.user_id === userId;
    // Admins may delete any record so a participant's withdrawal can be honoured.
    if (!isOwner && !(await callerHasRole(supabase, userId, ADMIN_ROLES))) {
      throw new Error("Not allowed");
    }
    // Owners delete through RLS; admins use the service role (storage RLS has no superadmin).
    const db = isOwner ? supabase : supabaseAdmin;
    // Only remove the file if it sits in the record owner's folder, so an admin deleting a
    // row that points at someone else's file (or a training file) cannot remove that file.
    if (voicePathOwner(row.file_path) === row.user_id) {
      const { error: rmErr } = await db.storage
        .from("training-attachments")
        .remove([row.file_path]);
      if (rmErr) throw new Error(rmErr.message);
    }
    const { error } = await db.from("voice_records").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getVoiceSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { file_path: string }) =>
    z.object({ file_path: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Only sign voice/<uid>/ files backed by that user's own voice record, never arbitrary
    // bucket paths. Rows other users point at the same file are ignored.
    const ownerId = voicePathOwner(data.file_path);
    if (!ownerId) throw new Error("Not allowed");
    const { data: rec, error: e1 } = await supabaseAdmin
      .from("voice_records")
      .select("id")
      .eq("file_path", data.file_path)
      .eq("user_id", ownerId)
      .limit(1)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!rec) throw new Error("Not allowed");
    const isOwner = ownerId === userId;
    if (!isOwner && !(await callerHasRole(supabase, userId, STAFF_ROLES))) {
      throw new Error("Not allowed");
    }
    // Owners sign through storage RLS; staff use the service role after the role check.
    const signer = isOwner ? supabase : supabaseAdmin;
    const { data: signed, error } = await signer.storage
      .from("training-attachments")
      .createSignedUrl(data.file_path, 60 * 60);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

export const listAllVoiceStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const r = (roles ?? []).map((x) => x.role as string);
    if (!r.some((x) => ["staff", "admin", "superadmin", "trainer"].includes(x))) {
      throw new Error("Forbidden");
    }
    const { data, error } = await supabase
      .from("voice_records")
      .select("*, lessons(title), courses(title)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<VoiceRecord & { lessons: { title: string } | null; courses: { title: string } | null }>;
  });
