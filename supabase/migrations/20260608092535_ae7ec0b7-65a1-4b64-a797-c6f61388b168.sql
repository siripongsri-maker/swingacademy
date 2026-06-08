-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('learner', 'staff', 'admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Security-definer role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto-assign 'learner' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'learner')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Lesson attachments (slides + recordings)
CREATE TABLE public.lesson_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id text NOT NULL,
  lesson_id text,
  kind text NOT NULL CHECK (kind IN ('slides', 'video', 'video_url')),
  storage_path text,
  external_url text,
  title text,
  description text,
  language text DEFAULT 'th',
  published boolean NOT NULL DEFAULT false,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lesson_attachments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_attachments TO authenticated;
GRANT ALL ON public.lesson_attachments TO service_role;

ALTER TABLE public.lesson_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads published attachments" ON public.lesson_attachments
  FOR SELECT TO anon, authenticated
  USING (published = true);

CREATE POLICY "Staff manage attachments" ON public.lesson_attachments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_lesson_attachments_updated_at
  BEFORE UPDATE ON public.lesson_attachments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();