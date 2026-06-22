// Lesson notes — learner-jotted notes attached to a lesson.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LessonNote = {
  id: string;
  lesson_id: string;
  course_id: string;
  user_id: string;
  body: string;
  visibility: "private" | "class";
  created_at: string;
  updated_at: string;
};

export const listMyNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("lesson_notes")
      .select("*, lessons(title), courses(title)")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<LessonNote & { lessons: { title: string } | null; courses: { title: string } | null }>;
  });

export const listLessonNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lesson_id: string }) =>
    z.object({ lesson_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("lesson_notes")
      .select("*")
      .eq("lesson_id", data.lesson_id)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as LessonNote[];
  });

export const upsertNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      lesson_id: string;
      course_id: string;
      body: string;
      visibility?: "private" | "class";
    }) =>
      z
        .object({
          id: z.string().uuid().optional(),
          lesson_id: z.string().uuid(),
          course_id: z.string().uuid(),
          body: z.string().max(20000),
          visibility: z.enum(["private", "class"]).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { data: row, error } = await supabase
        .from("lesson_notes")
        .update({ body: data.body, visibility: data.visibility ?? "private" })
        .eq("id", data.id)
        .eq("user_id", userId)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return row as LessonNote;
    }
    const { data: row, error } = await supabase
      .from("lesson_notes")
      .insert({
        lesson_id: data.lesson_id,
        course_id: data.course_id,
        user_id: userId,
        body: data.body,
        visibility: data.visibility ?? "private",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as LessonNote;
  });

export const deleteNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("lesson_notes")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAllNotesStaff = createServerFn({ method: "GET" })
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
      .from("lesson_notes")
      .select("*, lessons(title), courses(title)")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<LessonNote & { lessons: { title: string } | null; courses: { title: string } | null }>;
  });
