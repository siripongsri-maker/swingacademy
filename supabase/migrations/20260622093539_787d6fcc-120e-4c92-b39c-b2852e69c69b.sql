
-- =========================================================
-- Phase 1: Classroom LMS schema
-- Safe / idempotent — does not touch existing tables
-- =========================================================

-- Helper: role-in-classroom enum
DO $$ BEGIN
  CREATE TYPE public.class_role AS ENUM ('learner','trainer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.note_visibility AS ENUM ('private','class');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- classrooms ----------
CREATE TABLE IF NOT EXISTS public.classrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  cover_url text,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classrooms TO authenticated;
GRANT ALL ON public.classrooms TO service_role;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;

-- ---------- enrollments ----------
CREATE TABLE IF NOT EXISTS public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_in_class public.class_role NOT NULL DEFAULT 'learner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (classroom_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrollments TO authenticated;
GRANT ALL ON public.enrollments TO service_role;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Helper functions (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_enrolled(_user uuid, _classroom uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.enrollments WHERE user_id = _user AND classroom_id = _classroom)
$$;

CREATE OR REPLACE FUNCTION public.is_class_staff(_user uuid, _classroom uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classrooms c WHERE c.id = _classroom AND c.owner_id = _user
  ) OR EXISTS (
    SELECT 1 FROM public.enrollments e WHERE e.classroom_id = _classroom AND e.user_id = _user AND e.role_in_class = 'trainer'
  ) OR public.has_role(_user,'admin') OR public.has_role(_user,'staff');
$$;

-- ---------- courses ----------
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  description text,
  cover_url text,
  order_index int NOT NULL DEFAULT 0,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (classroom_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- ---------- lessons ----------
CREATE TABLE IF NOT EXISTS public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  body_md text,
  order_index int NOT NULL DEFAULT 0,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

-- ---------- assignments ----------
CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  title text NOT NULL,
  instructions text,
  due_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- ---------- lesson_notes ----------
CREATE TABLE IF NOT EXISTS public.lesson_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  visibility public.note_visibility NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_notes TO authenticated;
GRANT ALL ON public.lesson_notes TO service_role;
ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;

-- ---------- voice_records ----------
CREATE TABLE IF NOT EXISTS public.voice_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  file_path text NOT NULL,
  duration_sec int,
  mime text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_records TO authenticated;
GRANT ALL ON public.voice_records TO service_role;
ALTER TABLE public.voice_records ENABLE ROW LEVEL SECURITY;

-- ---------- course_files ----------
CREATE TABLE IF NOT EXISTS public.course_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  size bigint,
  mime text,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_files TO authenticated;
GRANT ALL ON public.course_files TO service_role;
ALTER TABLE public.course_files ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- POLICIES
-- =========================================================

-- classrooms
DROP POLICY IF EXISTS "classrooms_select" ON public.classrooms;
CREATE POLICY "classrooms_select" ON public.classrooms FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_enrolled(auth.uid(), id) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
DROP POLICY IF EXISTS "classrooms_insert" ON public.classrooms;
CREATE POLICY "classrooms_insert" ON public.classrooms FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND (public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'trainer') OR public.has_role(auth.uid(),'admin')));
DROP POLICY IF EXISTS "classrooms_update" ON public.classrooms;
CREATE POLICY "classrooms_update" ON public.classrooms FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "classrooms_delete" ON public.classrooms;
CREATE POLICY "classrooms_delete" ON public.classrooms FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- enrollments
DROP POLICY IF EXISTS "enrollments_select" ON public.enrollments;
CREATE POLICY "enrollments_select" ON public.enrollments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_class_staff(auth.uid(), classroom_id));
DROP POLICY IF EXISTS "enrollments_insert" ON public.enrollments;
CREATE POLICY "enrollments_insert" ON public.enrollments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_class_staff(auth.uid(), classroom_id));
DROP POLICY IF EXISTS "enrollments_delete" ON public.enrollments;
CREATE POLICY "enrollments_delete" ON public.enrollments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_class_staff(auth.uid(), classroom_id));

-- courses
DROP POLICY IF EXISTS "courses_select" ON public.courses;
CREATE POLICY "courses_select" ON public.courses FOR SELECT TO authenticated
  USING (public.is_enrolled(auth.uid(), classroom_id) OR public.is_class_staff(auth.uid(), classroom_id));
DROP POLICY IF EXISTS "courses_cud" ON public.courses;
CREATE POLICY "courses_cud" ON public.courses FOR ALL TO authenticated
  USING (public.is_class_staff(auth.uid(), classroom_id))
  WITH CHECK (public.is_class_staff(auth.uid(), classroom_id));

-- lessons
DROP POLICY IF EXISTS "lessons_select" ON public.lessons;
CREATE POLICY "lessons_select" ON public.lessons FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND
    (public.is_enrolled(auth.uid(), c.classroom_id) OR public.is_class_staff(auth.uid(), c.classroom_id))));
DROP POLICY IF EXISTS "lessons_cud" ON public.lessons;
CREATE POLICY "lessons_cud" ON public.lessons FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND public.is_class_staff(auth.uid(), c.classroom_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND public.is_class_staff(auth.uid(), c.classroom_id)));

-- assignments
DROP POLICY IF EXISTS "assignments_select" ON public.assignments;
CREATE POLICY "assignments_select" ON public.assignments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lessons l JOIN public.courses c ON c.id = l.course_id
    WHERE l.id = lesson_id AND (public.is_enrolled(auth.uid(), c.classroom_id) OR public.is_class_staff(auth.uid(), c.classroom_id))));
DROP POLICY IF EXISTS "assignments_cud" ON public.assignments;
CREATE POLICY "assignments_cud" ON public.assignments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lessons l JOIN public.courses c ON c.id = l.course_id
    WHERE l.id = lesson_id AND public.is_class_staff(auth.uid(), c.classroom_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.lessons l JOIN public.courses c ON c.id = l.course_id
    WHERE l.id = lesson_id AND public.is_class_staff(auth.uid(), c.classroom_id)));

-- lesson_notes
DROP POLICY IF EXISTS "lesson_notes_select" ON public.lesson_notes;
CREATE POLICY "lesson_notes_select" ON public.lesson_notes FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')
    OR (visibility = 'class' AND EXISTS (
      SELECT 1 FROM public.courses c WHERE c.id = course_id AND
      (public.is_enrolled(auth.uid(), c.classroom_id) OR public.is_class_staff(auth.uid(), c.classroom_id))
    ))
  );
DROP POLICY IF EXISTS "lesson_notes_insert" ON public.lesson_notes;
CREATE POLICY "lesson_notes_insert" ON public.lesson_notes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "lesson_notes_update" ON public.lesson_notes;
CREATE POLICY "lesson_notes_update" ON public.lesson_notes FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "lesson_notes_delete" ON public.lesson_notes;
CREATE POLICY "lesson_notes_delete" ON public.lesson_notes FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- voice_records
DROP POLICY IF EXISTS "voice_select" ON public.voice_records;
CREATE POLICY "voice_select" ON public.voice_records FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')
    OR (course_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.courses c WHERE c.id = course_id AND public.is_class_staff(auth.uid(), c.classroom_id)
    ))
  );
DROP POLICY IF EXISTS "voice_insert" ON public.voice_records;
CREATE POLICY "voice_insert" ON public.voice_records FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "voice_update" ON public.voice_records;
CREATE POLICY "voice_update" ON public.voice_records FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "voice_delete" ON public.voice_records;
CREATE POLICY "voice_delete" ON public.voice_records FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- course_files
DROP POLICY IF EXISTS "course_files_select" ON public.course_files;
CREATE POLICY "course_files_select" ON public.course_files FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND
    (public.is_enrolled(auth.uid(), c.classroom_id) OR public.is_class_staff(auth.uid(), c.classroom_id))));
DROP POLICY IF EXISTS "course_files_cud" ON public.course_files;
CREATE POLICY "course_files_cud" ON public.course_files FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND public.is_class_staff(auth.uid(), c.classroom_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND public.is_class_staff(auth.uid(), c.classroom_id)));

-- =========================================================
-- updated_at triggers
-- =========================================================
DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['classrooms','courses','lessons','assignments','lesson_notes'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t);
  END LOOP;
END $$;

-- =========================================================
-- Storage policies on training-attachments
-- Path conventions: voice/<user_id>/...  notes/<user_id>/...  course/<course_id>/...
-- =========================================================
DROP POLICY IF EXISTS "ta_user_read_own" ON storage.objects;
CREATE POLICY "ta_user_read_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'training-attachments' AND (
    (storage.foldername(name))[1] IN ('voice','notes') AND (storage.foldername(name))[2] = auth.uid()::text
  ));

DROP POLICY IF EXISTS "ta_user_insert_own" ON storage.objects;
CREATE POLICY "ta_user_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'training-attachments' AND (
    (storage.foldername(name))[1] IN ('voice','notes','course') AND (
      (storage.foldername(name))[2] = auth.uid()::text
      OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer')
    )
  ));

DROP POLICY IF EXISTS "ta_user_delete_own" ON storage.objects;
CREATE POLICY "ta_user_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'training-attachments' AND (
    owner = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')
  ));

DROP POLICY IF EXISTS "ta_staff_read_all" ON storage.objects;
CREATE POLICY "ta_staff_read_all" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'training-attachments' AND (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'trainer')
  ));
