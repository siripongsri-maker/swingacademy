-- =========================================================
-- Security hardening + research data foundation
--
-- HOW TO APPLY: this project's database is managed by Lovable Cloud.
-- Do not run this file by hand. Ask Lovable to "run pending migrations"
-- so it is applied to the live database in order. Lovable will then
-- regenerate src/integrations/supabase/types.ts (never edit that file
-- by hand); new tables/functions below appear in the types only after that.
--
-- Safe to run twice: every block is idempotent and nothing drops data
-- (only policies are replaced, privileges are tightened, and the two
-- attachment buckets are kept private).
-- =========================================================


-- ---------------------------------------------------------
-- 1. is_staff_member(): any back office role
--    app_role values: learner, staff, admin, trainer, superadmin
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_staff_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN (
        'staff'::public.app_role,
        'trainer'::public.app_role,
        'admin'::public.app_role,
        'superadmin'::public.app_role
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_staff_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff_member(uuid) TO authenticated, service_role;


-- ---------------------------------------------------------
-- 2. Storage: training-attachments
--    Remove the blanket "any signed-in user can read every file" policy.
--    Learners keep reading their own voice/<uid>/ and notes/<uid>/ files
--    through "ta_user_read_own" (needed: getVoiceSignedUrl signs with the
--    user-scoped client). Staff read-all is re-created on is_staff_member
--    so superadmin is covered too.
-- ---------------------------------------------------------
-- Both buckets are only served through signed URLs (no getPublicUrl or
-- /object/public/ link exists for them), so keep them private: a public
-- bucket would bypass every SELECT policy in sections 2 and 3.
UPDATE storage.buckets SET public = false
WHERE id IN ('training-attachments', 'knowledge-attachments') AND public;

DROP POLICY IF EXISTS "Authenticated can read training files" ON storage.objects;

DROP POLICY IF EXISTS "ta_staff_read_all" ON storage.objects;
CREATE POLICY "ta_staff_read_all" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'training-attachments' AND public.is_staff_member(auth.uid()));


-- ---------------------------------------------------------
-- 3. Storage: knowledge-attachments (staff only)
--    Public knowledge pages get download links signed server-side with
--    the service role (getPublicKnowledgeBySlug), so they do not need
--    RLS read access. Staff screens sign/upload with the user client.
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "knowledge_attachments_auth_read" ON storage.objects;
DROP POLICY IF EXISTS "knowledge_attachments_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "knowledge_attachments_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "knowledge_attachments_auth_delete" ON storage.objects;

DROP POLICY IF EXISTS "knowledge_attachments_staff_read" ON storage.objects;
CREATE POLICY "knowledge_attachments_staff_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'knowledge-attachments' AND public.is_staff_member(auth.uid()));

DROP POLICY IF EXISTS "knowledge_attachments_staff_insert" ON storage.objects;
CREATE POLICY "knowledge_attachments_staff_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'knowledge-attachments' AND public.is_staff_member(auth.uid()));

DROP POLICY IF EXISTS "knowledge_attachments_staff_update" ON storage.objects;
CREATE POLICY "knowledge_attachments_staff_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'knowledge-attachments' AND public.is_staff_member(auth.uid()))
  WITH CHECK (bucket_id = 'knowledge-attachments' AND public.is_staff_member(auth.uid()));

DROP POLICY IF EXISTS "knowledge_attachments_staff_delete" ON storage.objects;
CREATE POLICY "knowledge_attachments_staff_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'knowledge-attachments' AND public.is_staff_member(auth.uid()));


-- ---------------------------------------------------------
-- 4. enrollments: self-enrolment only as 'learner'
--    Class staff (classroom owner, class trainer, global admin/staff via
--    is_class_staff) may still insert any role. That already covers
--    createClassroom auto-enrolling the creator (the owner) as trainer.
--    Not is_staff_member: it would let a global 'trainer' make themselves
--    trainer of a classroom they do not own.
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "enrollments_insert" ON public.enrollments;
CREATE POLICY "enrollments_insert" ON public.enrollments FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND role_in_class = 'learner'::public.class_role)
    OR public.is_class_staff(auth.uid(), classroom_id)
  );


-- ---------------------------------------------------------
-- 5. knowledge_talent_mappings: staff read only
--    No public page reads this table; /staff/talent is the only consumer.
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "Public can read talent mappings" ON public.knowledge_talent_mappings;

DROP POLICY IF EXISTS "Staff read talent mappings" ON public.knowledge_talent_mappings;
CREATE POLICY "Staff read talent mappings" ON public.knowledge_talent_mappings FOR SELECT TO authenticated
  USING (public.is_staff_member(auth.uid()));

REVOKE SELECT ON public.knowledge_talent_mappings FROM anon;


-- ---------------------------------------------------------
-- 6. lesson_notes: private notes are readable by their owner only
--    Notes shared with the class ('class') keep their previous access.
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "lesson_notes_select" ON public.lesson_notes;
CREATE POLICY "lesson_notes_select" ON public.lesson_notes FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (visibility = 'class'::public.note_visibility AND (
      public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')
      OR EXISTS (
        SELECT 1 FROM public.courses c WHERE c.id = lesson_notes.course_id AND
        (public.is_enrolled(auth.uid(), c.classroom_id) OR public.is_class_staff(auth.uid(), c.classroom_id))
      )
    ))
  );


-- ---------------------------------------------------------
-- 7. user_roles: only superadmins may grant or revoke 'superadmin'
--    Mirrors grantRole/revokeRole in src/lib/admin-users.functions.ts.
--    Admins keep managing every other role.
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "Admins insert roles" ON public.user_roles;
CREATE POLICY "Admins insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'superadmin')
  OR (public.has_role(auth.uid(), 'admin') AND role <> 'superadmin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins delete roles" ON public.user_roles;
CREATE POLICY "Admins delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'superadmin')
  OR (public.has_role(auth.uid(), 'admin') AND role <> 'superadmin'::public.app_role)
);

-- There is no permissive UPDATE policy (updates are denied). This
-- restrictive guard keeps it that way for 'superadmin' rows even if an
-- UPDATE policy is added later.
DROP POLICY IF EXISTS "Only superadmins change superadmin rows" ON public.user_roles;
CREATE POLICY "Only superadmins change superadmin rows"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (role <> 'superadmin'::public.app_role OR public.has_role(auth.uid(), 'superadmin'))
WITH CHECK (role <> 'superadmin'::public.app_role OR public.has_role(auth.uid(), 'superadmin'));


-- ---------------------------------------------------------
-- 8. Research roles (separate from app_role on purpose)
-- ---------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.research_role AS ENUM (
    'researcher','consent_officer','dept_coordinator','expert','dignity_panel','data_steward'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.research_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.research_role NOT NULL,
  department text,
  active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  UNIQUE (user_id, role)
);
REVOKE ALL ON public.research_members FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_members TO authenticated;
GRANT ALL ON public.research_members TO service_role;
ALTER TABLE public.research_members ENABLE ROW LEVEL SECURITY;

-- Security-definer check (avoids RLS recursion); inactive rows do not count
CREATE OR REPLACE FUNCTION public.has_research_role(_user_id uuid, _role public.research_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.research_members
    WHERE user_id = _user_id AND role = _role AND active
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_research_role(uuid, public.research_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_research_role(uuid, public.research_role) TO authenticated, service_role;

DROP POLICY IF EXISTS "research_members_admin_all" ON public.research_members;
CREATE POLICY "research_members_admin_all" ON public.research_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

DROP POLICY IF EXISTS "research_members_read_own" ON public.research_members;
CREATE POLICY "research_members_read_own" ON public.research_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());


-- ---------------------------------------------------------
-- 9. ai_runs: append-only log of every AI call
--    Staff insert their own rows; admins, data stewards and researchers
--    read. No UPDATE/DELETE policies or grants (TRUNCATE revoked too,
--    since TRUNCATE bypasses RLS).
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  purpose text NOT NULL,
  object_type text,
  object_id text,
  provider_host text,
  model text,
  prompt_version text,
  params jsonb,
  input_hash text,
  input_chars int,
  output_text text,
  output_json jsonb,
  latency_ms int,
  status text NOT NULL DEFAULT 'ok',
  error text
);
CREATE INDEX IF NOT EXISTS idx_ai_runs_purpose_created ON public.ai_runs (purpose, created_at);

REVOKE ALL ON public.ai_runs FROM anon, authenticated;
GRANT SELECT, INSERT ON public.ai_runs TO authenticated;
GRANT ALL ON public.ai_runs TO service_role;
ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_runs_staff_insert" ON public.ai_runs;
CREATE POLICY "ai_runs_staff_insert" ON public.ai_runs FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_member(auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "ai_runs_research_read" ON public.ai_runs;
CREATE POLICY "ai_runs_research_read" ON public.ai_runs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')
    OR public.has_research_role(auth.uid(),'data_steward')
    OR public.has_research_role(auth.uid(),'researcher')
  );


-- ---------------------------------------------------------
-- 10. audit_events: append-only audit trail
--     Any signed-in user records their own actions; admins and data
--     stewards read. No UPDATE/DELETE policies or grants.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid DEFAULT auth.uid(),
  action text NOT NULL,
  object_type text,
  object_id text,
  purpose text,
  details jsonb
);
CREATE INDEX IF NOT EXISTS idx_audit_events_object ON public.audit_events (object_type, object_id);

REVOKE ALL ON public.audit_events FROM anon, authenticated;
GRANT SELECT, INSERT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_events_insert_own" ON public.audit_events;
CREATE POLICY "audit_events_insert_own" ON public.audit_events FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

DROP POLICY IF EXISTS "audit_events_steward_read" ON public.audit_events;
CREATE POLICY "audit_events_steward_read" ON public.audit_events FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')
    OR public.has_research_role(auth.uid(),'data_steward')
  );
