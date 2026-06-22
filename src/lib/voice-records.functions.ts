// Voice recordings — metadata only; file payload goes to training-attachments bucket.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    if (!data.file_path.startsWith(`voice/${userId}/`)) {
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
    const { data: row } = await supabase
      .from("voice_records")
      .select("file_path,user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row || row.user_id !== userId) throw new Error("Not allowed");
    await supabase.storage.from("training-attachments").remove([row.file_path]);
    const { error } = await supabase.from("voice_records").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getVoiceSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { file_path: string }) =>
    z.object({ file_path: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: signed, error } = await supabase.storage
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
