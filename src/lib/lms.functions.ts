// Classroom / Course / Lesson server functions for the LMS layer.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Classroom = {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  course_count?: number;
  member_count?: number;
};

export type Course = {
  id: string;
  classroom_id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  order_index: number;
  owner_id: string;
};

export type Lesson = {
  id: string;
  course_id: string;
  title: string;
  body_md: string | null;
  order_index: number;
  owner_id: string;
};

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || `c-${Date.now().toString(36)}`
  );
}

// ---------- Classrooms ----------

export const listMyClassrooms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("classrooms")
      .select("id,title,description,cover_url,owner_id,created_at,updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Classroom[];
  });

export const getClassroom = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cls, error } = await supabase
      .from("classrooms")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cls) throw new Error("Classroom not found");
    const { data: courses } = await supabase
      .from("courses")
      .select("id,classroom_id,title,slug,description,cover_url,order_index,owner_id")
      .eq("classroom_id", data.id)
      .order("order_index", { ascending: true });
    const { data: lessons } = await supabase
      .from("lessons")
      .select("id,course_id,title,body_md,order_index,owner_id")
      .in("course_id", (courses ?? []).map((c) => c.id))
      .order("order_index", { ascending: true });
    return {
      classroom: cls as Classroom,
      courses: (courses ?? []) as Course[],
      lessons: (lessons ?? []) as Lesson[],
    };
  });

export const createClassroom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title: string; description?: string; cover_url?: string }) =>
    z
      .object({
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        cover_url: z.string().url().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("classrooms")
      .insert({
        title: data.title,
        description: data.description ?? null,
        cover_url: data.cover_url ?? null,
        owner_id: userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    // Auto-enroll creator as trainer
    await supabase.from("enrollments").insert({
      classroom_id: row.id,
      user_id: userId,
      role_in_class: "trainer",
    });
    return row as Classroom;
  });

export const enrollSelf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { classroom_id: string }) =>
    z.object({ classroom_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("enrollments")
      .insert({ classroom_id: data.classroom_id, user_id: userId, role_in_class: "learner" });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Courses ----------

export const createCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { classroom_id: string; title: string; description?: string }) =>
    z
      .object({
        classroom_id: z.string().uuid(),
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let base = slugify(data.title);
    let slug = base;
    for (let i = 2; i < 100; i++) {
      const { data: exist } = await supabase
        .from("courses")
        .select("id")
        .eq("classroom_id", data.classroom_id)
        .eq("slug", slug)
        .maybeSingle();
      if (!exist) break;
      slug = `${base}-${i}`;
    }
    const { data: row, error } = await supabase
      .from("courses")
      .insert({
        classroom_id: data.classroom_id,
        title: data.title,
        slug,
        description: data.description ?? null,
        owner_id: userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Course;
  });

// ---------- Lessons ----------

export const getLesson = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: lesson, error } = await supabase
      .from("lessons")
      .select("*, courses!inner(id,title,classroom_id)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!lesson) throw new Error("Lesson not found");
    return lesson as Lesson & { courses: { id: string; title: string; classroom_id: string } };
  });

export const createLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { course_id: string; title: string; body_md?: string }) =>
    z
      .object({
        course_id: z.string().uuid(),
        title: z.string().min(1).max(200),
        body_md: z.string().max(50000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("lessons")
      .insert({
        course_id: data.course_id,
        title: data.title,
        body_md: data.body_md ?? "",
        owner_id: userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Lesson;
  });
