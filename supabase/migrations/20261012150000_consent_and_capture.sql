-- =========================================================
-- CVSK consent registry and capture sessions
--
-- Principles (proposal p.6, p.7, p.10):
-- * Consent is taken by an independent consent officer. Individual consent
--   decisions and identities are visible ONLY to consent officers and data
--   stewards. Admins and researchers cannot read them; they see derived
--   per-session flags from session_clearance().
-- * Consent items are configurable per form version (the tiers are not
--   final yet). Each item has a gate: processing | research | optional.
-- * Nothing is recorded or uploaded for research until the ethics approval
--   and MoU are on file and collection is unlocked.
-- * Raw audio lives in the private bucket research-raw with NO storage
--   policies: only the server (service role) can sign uploads/downloads,
--   and every access is written to audit_events.
-- * No burnout, wellbeing or individual mental-health fields (R-CONSENT-9).
--
-- HOW TO APPLY: ask Lovable to run this pending migration. Safe to run twice.
-- Depends on: has_role, has_research_role, research_members, audit_events.
-- =========================================================


-- ---------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'superadmin')
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_user(uuid) TO authenticated, service_role;

-- Consent officers and data stewards: the only people who may see consent decisions
CREATE OR REPLACE FUNCTION public.is_consent_keeper(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_research_role(_user_id, 'consent_officer')
      OR public.has_research_role(_user_id, 'data_steward')
$$;
REVOKE EXECUTE ON FUNCTION public.is_consent_keeper(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_consent_keeper(uuid) TO authenticated, service_role;

-- Anyone who works with capture sessions (no consent decisions involved)
CREATE OR REPLACE FUNCTION public.is_session_worker(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_admin_user(_user_id)
      OR public.has_research_role(_user_id, 'researcher')
      OR public.has_research_role(_user_id, 'data_steward')
      OR public.has_research_role(_user_id, 'dept_coordinator')
$$;
REVOKE EXECUTE ON FUNCTION public.is_session_worker(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_session_worker(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_research_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_admin_user(_user_id)
      OR EXISTS (SELECT 1 FROM public.research_members WHERE user_id = _user_id AND active)
$$;
REVOKE EXECUTE ON FUNCTION public.is_research_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_research_member(uuid) TO authenticated, service_role;


-- ---------------------------------------------------------
-- 1. Study settings (single row): approvals and the collection lock
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ethics_ref text,                    -- human research ethics committee reference
  ethics_approved_at date,
  mou_signed_at date,                 -- SWING / TU / KBTG memorandum
  collection_unlocked boolean NOT NULL DEFAULT false,
  departments text[] NOT NULL DEFAULT '{}',   -- the 8 แผนก
  sites text[] NOT NULL DEFAULT '{}',         -- Bangkok and Pattaya sites
  speaker_guidance_version text,      -- current speaker guidance (do not name service users or third parties)
  retention_years smallint NOT NULL DEFAULT 5,
  study_end date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  -- Collection can only be unlocked once both approvals are on file
  CONSTRAINT study_settings_unlock_needs_approvals
    CHECK (NOT collection_unlocked OR (ethics_approved_at IS NOT NULL AND mou_signed_at IS NOT NULL))
);
INSERT INTO public.study_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

REVOKE ALL ON public.study_settings FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.study_settings TO authenticated;
GRANT ALL ON public.study_settings TO service_role;
ALTER TABLE public.study_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study_settings_read" ON public.study_settings;
CREATE POLICY "study_settings_read" ON public.study_settings FOR SELECT TO authenticated
  USING (public.is_research_member(auth.uid()));
DROP POLICY IF EXISTS "study_settings_update" ON public.study_settings;
CREATE POLICY "study_settings_update" ON public.study_settings FOR UPDATE TO authenticated
  USING (public.is_admin_user(auth.uid()) OR public.has_research_role(auth.uid(), 'data_steward'))
  WITH CHECK (public.is_admin_user(auth.uid()) OR public.has_research_role(auth.uid(), 'data_steward'));


-- ---------------------------------------------------------
-- 2. Consent form versions (content is not sensitive; decisions are)
--    items: [{ "key": "record_audio", "gate": "processing"|"research"|"optional",
--              "label_th": "...", "label_en": "..." }, ...]
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consent_form_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,       -- e.g. "v1.0-draft"
  title text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'retired')),
  approved_ref text,                  -- ethics committee reference for this form
  approved_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CONSTRAINT consent_form_items_is_array CHECK (jsonb_typeof(items) = 'array'),
  CONSTRAINT consent_form_approved_has_ref CHECK (status <> 'approved' OR (approved_ref IS NOT NULL AND approved_at IS NOT NULL))
);

REVOKE ALL ON public.consent_form_versions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.consent_form_versions TO authenticated;
GRANT ALL ON public.consent_form_versions TO service_role;
ALTER TABLE public.consent_form_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consent_forms_read" ON public.consent_form_versions;
CREATE POLICY "consent_forms_read" ON public.consent_form_versions FOR SELECT TO authenticated
  USING (public.is_research_member(auth.uid()));
-- Writing and approving forms belongs to the consent keepers, not to admins.
DROP POLICY IF EXISTS "consent_forms_write" ON public.consent_form_versions;
CREATE POLICY "consent_forms_write" ON public.consent_form_versions FOR INSERT TO authenticated
  WITH CHECK (public.is_consent_keeper(auth.uid()));
DROP POLICY IF EXISTS "consent_forms_update" ON public.consent_form_versions;
CREATE POLICY "consent_forms_update" ON public.consent_form_versions FOR UPDATE TO authenticated
  USING (public.is_consent_keeper(auth.uid()) AND status <> 'retired')
  WITH CHECK (public.is_consent_keeper(auth.uid()));

-- Draft form v1 from the storage memo and proposal. Wording is a DRAFT until the
-- ethics committee approves it; clearance only counts approved forms.
INSERT INTO public.consent_form_versions (version, title, items)
VALUES (
  'v1.0-draft',
  'ใบยินยอมเข้าร่วมงานวิจัย CVSK (ร่าง)',
  '[
    {"key":"record_audio","gate":"processing","label_th":"ยินยอมให้บันทึกเสียงระหว่างกิจกรรม","label_en":"I agree to audio recording during the session"},
    {"key":"ai_processing_abroad","gate":"processing","label_th":"ยินยอมให้ถอดเสียงและประมวลผลด้วย AI ของผู้ให้บริการในต่างประเทศ (ไฟล์เสียงเก็บในระบบขององค์กร)","label_en":"I agree to transcription and AI processing by providers outside Thailand (audio is stored in the organisation''s system)"},
    {"key":"research_analysis","gate":"research","label_th":"ยินยอมให้ใช้ข้อมูลที่ไม่ระบุตัวตนในการวิเคราะห์และรายงานผลงานวิจัย","label_en":"I agree to de-identified use in research analysis and reports"},
    {"key":"model_training","gate":"optional","label_th":"(ไม่บังคับ) ยินยอมให้นำข้อมูลที่ไม่ระบุตัวตนไปพัฒนาโมเดลภาษาของ SWING","label_en":"(Optional) I agree to de-identified use for developing SWING''s own language model"}
  ]'::jsonb
)
ON CONFLICT (version) DO NOTHING;


-- ---------------------------------------------------------
-- 3. Participants (pseudonymous) and their identity key (restricted)
-- ---------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.participant_code_seq;

CREATE TABLE IF NOT EXISTS public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pseudo_code text NOT NULL UNIQUE
    DEFAULT ('P-' || lpad(nextval('public.participant_code_seq')::text, 3, '0')),
  department text,
  site text,
  experience_tier text CHECK (experience_tier IS NULL OR experience_tier IN ('high', 'low', 'manager', 'not_applicable')),
  roles text[] NOT NULL DEFAULT '{}', -- speaker, interviewee, round0_answerer, rater, survey, task
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);

REVOKE ALL ON public.participants FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.participants TO authenticated;
GRANT ALL ON public.participants TO service_role;
GRANT USAGE ON SEQUENCE public.participant_code_seq TO authenticated, service_role;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

-- Pseudonymous rows: consent keepers and session workers may read
DROP POLICY IF EXISTS "participants_read" ON public.participants;
CREATE POLICY "participants_read" ON public.participants FOR SELECT TO authenticated
  USING (public.is_consent_keeper(auth.uid()) OR public.is_session_worker(auth.uid()));
-- Enrolment is done by consent keepers
DROP POLICY IF EXISTS "participants_insert" ON public.participants;
CREATE POLICY "participants_insert" ON public.participants FOR INSERT TO authenticated
  WITH CHECK (public.is_consent_keeper(auth.uid()));
DROP POLICY IF EXISTS "participants_update" ON public.participants;
CREATE POLICY "participants_update" ON public.participants FOR UPDATE TO authenticated
  USING (public.is_consent_keeper(auth.uid()))
  WITH CHECK (public.is_consent_keeper(auth.uid()));

-- The re-identification key. Consent keepers only (not admins, not researchers).
CREATE TABLE IF NOT EXISTS public.participant_identity (
  participant_id uuid PRIMARY KEY REFERENCES public.participants(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  contact text,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

REVOKE ALL ON public.participant_identity FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.participant_identity TO authenticated;
GRANT ALL ON public.participant_identity TO service_role;
ALTER TABLE public.participant_identity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participant_identity_keepers" ON public.participant_identity;
CREATE POLICY "participant_identity_keepers" ON public.participant_identity FOR ALL TO authenticated
  USING (public.is_consent_keeper(auth.uid()))
  WITH CHECK (public.is_consent_keeper(auth.uid()));


-- ---------------------------------------------------------
-- 4. Consent decisions (one row per participant x form version x item)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE RESTRICT,
  form_version_id uuid NOT NULL REFERENCES public.consent_form_versions(id) ON DELETE RESTRICT,
  item_key text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('granted', 'refused')),
  method text NOT NULL CHECK (method IN ('paper', 'e_sign', 'verbal_recorded')),
  given_at date NOT NULL,
  paper_ref text,                     -- where the signed paper form is kept (not a scan)
  taken_by uuid NOT NULL DEFAULT auth.uid(),
  withdrawn_at timestamptz,
  withdrawn_recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, form_version_id, item_key)
);

REVOKE ALL ON public.consents FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.consents TO authenticated;
GRANT ALL ON public.consents TO service_role;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consents_keepers" ON public.consents;
CREATE POLICY "consents_keepers" ON public.consents FOR ALL TO authenticated
  USING (public.is_consent_keeper(auth.uid()))
  WITH CHECK (public.is_consent_keeper(auth.uid()));


-- ---------------------------------------------------------
-- 5. Withdrawal events (cascade log)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.withdrawal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE RESTRICT,
  scope text NOT NULL CHECK (scope IN ('all', 'processing', 'research', 'optional')),
  recorded_by uuid NOT NULL DEFAULT auth.uid(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  note text,
  sessions_put_on_hold integer NOT NULL DEFAULT 0
);

REVOKE ALL ON public.withdrawal_events FROM anon, authenticated;
GRANT SELECT, INSERT ON public.withdrawal_events TO authenticated;
GRANT ALL ON public.withdrawal_events TO service_role;
ALTER TABLE public.withdrawal_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "withdrawals_keepers_read" ON public.withdrawal_events;
CREATE POLICY "withdrawals_keepers_read" ON public.withdrawal_events FOR SELECT TO authenticated
  USING (public.is_consent_keeper(auth.uid()));
-- Inserts happen through apply_withdrawal() only (SECURITY DEFINER); no INSERT policy.


-- ---------------------------------------------------------
-- 6. Capture sessions and who spoke in them
-- ---------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.capture_session_code_seq;

CREATE TABLE IF NOT EXISTS public.capture_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE
    DEFAULT ('S-' || lpad(nextval('public.capture_session_code_seq')::text, 3, '0')),
  session_type text NOT NULL CHECK (session_type IN (
    'monthly_training', 'elicitation_circle', 'on_the_job', 'lesson_debrief', 'interview', 'retrospective'
  )),
  title text,
  department text,
  site text,
  held_at date,
  study_month smallint CHECK (study_month IS NULL OR study_month BETWEEN 1 AND 12),
  facilitator_id uuid,
  -- level 1 of the 3-level protection for third parties
  speaker_guidance_version text,
  speaker_guidance_given_at timestamptz,
  speaker_guidance_given_by uuid,
  -- no individual health data, service records or SWING RIGHTS cases
  out_of_scope_attested boolean NOT NULL DEFAULT false,
  out_of_scope_attested_by uuid,
  -- raw audio (private bucket research-raw; server-signed access only)
  audio_path text,
  audio_bytes bigint,
  audio_sha256 text,
  audio_uploaded_at timestamptz,
  audio_uploaded_by uuid,
  duration_sec integer,
  retention_until date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'recorded', 'on_hold', 'closed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_capture_sessions_dept ON public.capture_sessions (department, held_at);

REVOKE ALL ON public.capture_sessions FROM anon, authenticated;
GRANT SELECT ON public.capture_sessions TO authenticated;
-- Column-level writes. The audio_* fields, duration and retention are written by the
-- server only (service role), after it has checked the stored object itself.
GRANT INSERT (session_type, title, department, site, held_at, study_month, notes, facilitator_id)
  ON public.capture_sessions TO authenticated;
GRANT UPDATE (session_type, title, department, site, held_at, study_month, notes,
              speaker_guidance_version, speaker_guidance_given_at, speaker_guidance_given_by,
              out_of_scope_attested, out_of_scope_attested_by, status, updated_at)
  ON public.capture_sessions TO authenticated;
GRANT ALL ON public.capture_sessions TO service_role;
GRANT USAGE ON SEQUENCE public.capture_session_code_seq TO authenticated, service_role;
ALTER TABLE public.capture_sessions ENABLE ROW LEVEL SECURITY;

-- Department coordinators see and edit only their own department
CREATE OR REPLACE FUNCTION public.can_work_on_department(_user_id uuid, _department text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_admin_user(_user_id)
      OR public.has_research_role(_user_id, 'researcher')
      OR public.has_research_role(_user_id, 'data_steward')
      OR EXISTS (
        SELECT 1 FROM public.research_members
        WHERE user_id = _user_id AND role = 'dept_coordinator' AND active
          AND department IS NOT NULL AND department = _department
      )
$$;
REVOKE EXECUTE ON FUNCTION public.can_work_on_department(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_work_on_department(uuid, text) TO authenticated, service_role;

DROP POLICY IF EXISTS "capture_sessions_read" ON public.capture_sessions;
CREATE POLICY "capture_sessions_read" ON public.capture_sessions FOR SELECT TO authenticated
  USING (public.can_work_on_department(auth.uid(), department));
DROP POLICY IF EXISTS "capture_sessions_insert" ON public.capture_sessions;
CREATE POLICY "capture_sessions_insert" ON public.capture_sessions FOR INSERT TO authenticated
  WITH CHECK (public.can_work_on_department(auth.uid(), department));
DROP POLICY IF EXISTS "capture_sessions_update" ON public.capture_sessions;
CREATE POLICY "capture_sessions_update" ON public.capture_sessions FOR UPDATE TO authenticated
  USING (public.can_work_on_department(auth.uid(), department))
  WITH CHECK (public.can_work_on_department(auth.uid(), department));

CREATE TABLE IF NOT EXISTS public.session_participants (
  session_id uuid NOT NULL REFERENCES public.capture_sessions(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE RESTRICT,
  role text NOT NULL DEFAULT 'speaker' CHECK (role IN ('speaker', 'interviewee', 'facilitator')),
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by uuid DEFAULT auth.uid(),
  PRIMARY KEY (session_id, participant_id)
);

REVOKE ALL ON public.session_participants FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.session_participants TO authenticated;
GRANT ALL ON public.session_participants TO service_role;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "session_participants_rw" ON public.session_participants;
DROP POLICY IF EXISTS "session_participants_read" ON public.session_participants;
CREATE POLICY "session_participants_read" ON public.session_participants FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.capture_sessions s
    WHERE s.id = session_id AND public.can_work_on_department(auth.uid(), s.department)
  ));
-- The speaker list is frozen once audio exists or while a session is on hold or closed.
DROP POLICY IF EXISTS "session_participants_insert" ON public.session_participants;
CREATE POLICY "session_participants_insert" ON public.session_participants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.capture_sessions s
    WHERE s.id = session_id AND public.can_work_on_department(auth.uid(), s.department)
      AND s.audio_path IS NULL AND s.status IN ('draft', 'ready')
  ));
DROP POLICY IF EXISTS "session_participants_delete" ON public.session_participants;
CREATE POLICY "session_participants_delete" ON public.session_participants FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.capture_sessions s
    WHERE s.id = session_id AND public.can_work_on_department(auth.uid(), s.department)
      AND s.audio_path IS NULL AND s.status IN ('draft', 'ready')
  ));


-- ---------------------------------------------------------
-- 7. Clearance: per participant (internal) and per session (what workers see)
-- ---------------------------------------------------------
-- A participant is cleared for a gate when, on the most recent APPROVED form
-- version they signed, every item with that gate is granted and not withdrawn.
CREATE OR REPLACE FUNCTION public.participant_cleared(_participant uuid, _gate text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  fv record;
  item jsonb;
  ok boolean := false;
BEGIN
  SELECT f.* INTO fv
  FROM public.consent_form_versions f
  JOIN public.consents c ON c.form_version_id = f.id
  WHERE c.participant_id = _participant AND f.status = 'approved'
  ORDER BY c.given_at DESC, f.approved_at DESC
  LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(fv.items) LOOP
    IF item->>'gate' = _gate THEN
      ok := true;
      IF NOT EXISTS (
        SELECT 1 FROM public.consents c
        WHERE c.participant_id = _participant AND c.form_version_id = fv.id
          AND c.item_key = item->>'key' AND c.decision = 'granted' AND c.withdrawn_at IS NULL
      ) THEN
        RETURN false;
      END IF;
    END IF;
  END LOOP;
  RETURN ok;  -- false if the form has no item for this gate
END;
$$;
-- Internal: not callable by app users directly (it reveals individual status)
REVOKE EXECUTE ON FUNCTION public.participant_cleared(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.participant_cleared(uuid, text) TO service_role;

-- Per-session flags only. Never says which participant is not cleared.
CREATE OR REPLACE FUNCTION public.session_clearance(_session uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  dept text;
  n integer;
  proc boolean;
  res boolean;
BEGIN
  SELECT department INTO dept FROM public.capture_sessions WHERE id = _session;
  IF NOT FOUND OR NOT public.can_work_on_department(auth.uid(), dept) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  SELECT count(*) INTO n FROM public.session_participants WHERE session_id = _session;
  IF n = 0 THEN
    RETURN jsonb_build_object('speakers', 0, 'processing', false, 'research', false);
  END IF;
  SELECT bool_and(public.participant_cleared(participant_id, 'processing')),
         bool_and(public.participant_cleared(participant_id, 'research'))
    INTO proc, res
  FROM public.session_participants WHERE session_id = _session;
  RETURN jsonb_build_object('speakers', n, 'processing', coalesce(proc, false), 'research', coalesce(res, false));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.session_clearance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.session_clearance(uuid) TO authenticated, service_role;


-- ---------------------------------------------------------
-- 8. Withdrawal: record it, mark consents, put affected sessions on hold
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_withdrawal(_participant uuid, _scope text, _note text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  held integer := 0;
  ev uuid;
BEGIN
  IF NOT public.is_consent_keeper(auth.uid()) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF _scope NOT IN ('all', 'processing', 'research', 'optional') THEN
    RAISE EXCEPTION 'bad scope';
  END IF;

  UPDATE public.consents c
  SET withdrawn_at = now(), withdrawn_recorded_by = auth.uid()
  FROM public.consent_form_versions f
  WHERE c.participant_id = _participant AND c.form_version_id = f.id
    AND c.withdrawn_at IS NULL
    AND (_scope = 'all' OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(f.items) it
      WHERE it->>'key' = c.item_key AND it->>'gate' = _scope
    ));

  -- Sessions the person spoke in stop moving until a data steward reviews them.
  -- Optional-only withdrawals (e.g. model training) do not stop sessions.
  IF _scope IN ('all', 'processing', 'research') THEN
    UPDATE public.capture_sessions s
    SET status = 'on_hold', updated_at = now()
    WHERE s.status <> 'closed'
      AND EXISTS (SELECT 1 FROM public.session_participants sp
                  WHERE sp.session_id = s.id AND sp.participant_id = _participant);
    GET DIAGNOSTICS held = ROW_COUNT;
  END IF;

  INSERT INTO public.withdrawal_events (participant_id, scope, note, sessions_put_on_hold)
  VALUES (_participant, _scope, _note, held)
  RETURNING id INTO ev;

  -- Audit points at the keeper-only withdrawal event, never at the participant,
  -- so admins reading audit_events cannot tell who withdrew.
  INSERT INTO public.audit_events (action, object_type, object_id, purpose, details)
  VALUES ('consent.withdrawal', 'withdrawal_event', ev::text, 'research_consent',
          jsonb_build_object('scope', _scope));
  RETURN held;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.apply_withdrawal(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_withdrawal(uuid, text, text) TO authenticated, service_role;


-- ---------------------------------------------------------
-- 9. Private bucket for raw research audio. No storage.objects policies on
--    purpose: uploads and downloads are signed by the server only.
-- ---------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('research-raw', 'research-raw', false, 524288000,
        ARRAY['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav',
              'audio/webm', 'audio/ogg', 'audio/flac'])
ON CONFLICT (id) DO UPDATE SET public = false;


-- ---------------------------------------------------------
-- 10. Guards that hold no matter how a row is written (server functions,
--     direct API calls, future code).
-- ---------------------------------------------------------

-- 10a. Capture sessions: audio and status rules
CREATE OR REPLACE FUNCTION public.capture_sessions_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  st record;
  n integer;
  all_cleared boolean;
  is_steward boolean := public.has_research_role(auth.uid(), 'data_steward');
BEGIN
  -- Raw audio, once linked, never changes.
  IF TG_OP = 'UPDATE' AND OLD.audio_path IS NOT NULL AND (
       NEW.audio_path IS DISTINCT FROM OLD.audio_path
    OR NEW.audio_sha256 IS DISTINCT FROM OLD.audio_sha256
    OR NEW.audio_bytes IS DISTINCT FROM OLD.audio_bytes) THEN
    RAISE EXCEPTION 'audio is frozen once linked' USING ERRCODE = '42501';
  END IF;

  -- Linking audio: the path must be one the server issues for this session.
  IF NEW.audio_path IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.audio_path IS NULL) THEN
    IF NEW.audio_path !~ ('^sessions/' || NEW.id::text || '/[0-9]{13}\.[a-z0-9]{2,5}$') THEN
      RAISE EXCEPTION 'unexpected audio path' USING ERRCODE = '42501';
    END IF;
    -- Unless the session is being put on hold for review, every gate must hold.
    IF NEW.status <> 'on_hold' THEN
      SELECT * INTO st FROM public.study_settings WHERE id = 1;
      SELECT count(*), bool_and(public.participant_cleared(participant_id, 'processing'))
        INTO n, all_cleared
      FROM public.session_participants WHERE session_id = NEW.id;
      IF NOT coalesce(st.collection_unlocked, false)
         OR NEW.speaker_guidance_given_at IS NULL
         OR NOT NEW.out_of_scope_attested
         OR n = 0 OR NOT coalesce(all_cleared, false) THEN
        RAISE EXCEPTION 'capture gate not satisfied' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Only a data steward releases or closes a session on hold, or closes any session.
    IF OLD.status = 'on_hold' AND NEW.status <> 'on_hold' AND NOT is_steward THEN
      RAISE EXCEPTION 'only a data steward can release a session on hold' USING ERRCODE = '42501';
    END IF;
    IF OLD.status <> 'closed' AND NEW.status = 'closed' AND NOT is_steward THEN
      RAISE EXCEPTION 'only a data steward can close a session' USING ERRCODE = '42501';
    END IF;
    IF OLD.status = 'closed' AND NEW.status <> 'closed' AND NOT is_steward THEN
      RAISE EXCEPTION 'only a data steward can reopen a session' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Status must match what is actually there.
  IF NEW.status = 'recorded' AND NEW.audio_path IS NULL THEN
    RAISE EXCEPTION 'recorded needs audio' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'ready' AND (NEW.speaker_guidance_given_at IS NULL OR NOT NEW.out_of_scope_attested) THEN
    RAISE EXCEPTION 'ready needs guidance and attestation' USING ERRCODE = '23514';
  END IF;
  IF NEW.speaker_guidance_given_at IS NOT NULL AND NEW.speaker_guidance_version IS NULL THEN
    RAISE EXCEPTION 'guidance needs a version' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.capture_sessions_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_capture_sessions_guard ON public.capture_sessions;
CREATE TRIGGER trg_capture_sessions_guard
  BEFORE INSERT OR UPDATE ON public.capture_sessions
  FOR EACH ROW EXECUTE FUNCTION public.capture_sessions_guard();

-- 10b. Separation of duties: the researcher never also holds a consent-keeper role,
--      and nobody grants themselves a consent-keeper role.
CREATE OR REPLACE FUNCTION public.research_members_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT NEW.active THEN RETURN NEW; END IF;
  IF NEW.role IN ('consent_officer', 'data_steward') AND EXISTS (
       SELECT 1 FROM public.research_members m
       WHERE m.user_id = NEW.user_id AND m.role = 'researcher' AND m.active AND m.id <> NEW.id) THEN
    RAISE EXCEPTION 'a researcher cannot also be a consent officer or data steward' USING ERRCODE = '23514';
  END IF;
  IF NEW.role = 'researcher' AND EXISTS (
       SELECT 1 FROM public.research_members m
       WHERE m.user_id = NEW.user_id AND m.role IN ('consent_officer', 'data_steward')
         AND m.active AND m.id <> NEW.id) THEN
    RAISE EXCEPTION 'a consent officer or data steward cannot also be the researcher' USING ERRCODE = '23514';
  END IF;
  IF NEW.role IN ('consent_officer', 'data_steward') AND auth.uid() IS NOT NULL
     AND NEW.user_id = auth.uid()
     AND (TG_OP = 'INSERT' OR NOT OLD.active OR OLD.role IS DISTINCT FROM NEW.role) THEN
    RAISE EXCEPTION 'ask another admin to grant this role' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.research_members_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_research_members_guard ON public.research_members;
CREATE TRIGGER trg_research_members_guard
  BEFORE INSERT OR UPDATE ON public.research_members
  FOR EACH ROW EXECUTE FUNCTION public.research_members_guard();

-- 10c. Data stewards can see the whole research team (admins already can).
DROP POLICY IF EXISTS "research_members_steward_read" ON public.research_members;
CREATE POLICY "research_members_steward_read" ON public.research_members FOR SELECT TO authenticated
  USING (public.has_research_role(auth.uid(), 'data_steward'));

-- 10d. Consent forms: once approved, only retiring is allowed. A draft that already has
--      practice records can never become approved (they would start counting as consent).
CREATE OR REPLACE FUNCTION public.consent_form_versions_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'draft' THEN
    IF NEW.status = 'approved'
       AND EXISTS (SELECT 1 FROM public.consents WHERE form_version_id = OLD.id) THEN
      RAISE EXCEPTION 'a draft with practice records cannot be approved' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.version = OLD.version AND NEW.title = OLD.title AND NEW.items = OLD.items
     AND NEW.approved_ref IS NOT DISTINCT FROM OLD.approved_ref
     AND NEW.approved_at IS NOT DISTINCT FROM OLD.approved_at
     AND (NEW.status = OLD.status OR (OLD.status = 'approved' AND NEW.status = 'retired')) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'approved and retired consent forms cannot change' USING ERRCODE = '42501';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.consent_form_versions_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_consent_form_versions_guard ON public.consent_form_versions;
CREATE TRIGGER trg_consent_form_versions_guard
  BEFORE UPDATE ON public.consent_form_versions
  FOR EACH ROW EXECUTE FUNCTION public.consent_form_versions_guard();

-- 10e. Consent decisions: a withdrawal is final for that record, nothing moves between
--      people or forms, and every correction keeps the earlier decision (keepers only).
CREATE TABLE IF NOT EXISTS public.consent_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id uuid NOT NULL REFERENCES public.consents(id) ON DELETE RESTRICT,
  participant_id uuid NOT NULL,
  form_version_id uuid NOT NULL,
  item_key text NOT NULL,
  old_decision text NOT NULL,
  old_method text NOT NULL,
  old_given_at date NOT NULL,
  old_paper_ref text,
  old_taken_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid DEFAULT auth.uid()
);
REVOKE ALL ON public.consent_revisions FROM anon, authenticated;
GRANT SELECT ON public.consent_revisions TO authenticated;
GRANT ALL ON public.consent_revisions TO service_role;
ALTER TABLE public.consent_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "consent_revisions_keepers_read" ON public.consent_revisions;
CREATE POLICY "consent_revisions_keepers_read" ON public.consent_revisions FOR SELECT TO authenticated
  USING (public.is_consent_keeper(auth.uid()));
-- Rows are written by consents_guard() only; no INSERT policy.

CREATE OR REPLACE FUNCTION public.consents_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  fstatus text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.participant_id <> OLD.participant_id OR NEW.form_version_id <> OLD.form_version_id
       OR NEW.item_key <> OLD.item_key THEN
      RAISE EXCEPTION 'a consent record cannot move' USING ERRCODE = '42501';
    END IF;
    IF OLD.withdrawn_at IS NOT NULL AND (
         NEW.withdrawn_at IS DISTINCT FROM OLD.withdrawn_at
      OR NEW.decision IS DISTINCT FROM OLD.decision
      OR NEW.method IS DISTINCT FROM OLD.method
      OR NEW.given_at IS DISTINCT FROM OLD.given_at
      OR NEW.paper_ref IS DISTINCT FROM OLD.paper_ref) THEN
      RAISE EXCEPTION 'a withdrawn consent cannot change' USING ERRCODE = '42501';
    END IF;
    -- Recording a withdrawal (apply_withdrawal) is allowed on any form, retired ones included.
    IF NEW.decision IS NOT DISTINCT FROM OLD.decision AND NEW.method IS NOT DISTINCT FROM OLD.method
       AND NEW.given_at IS NOT DISTINCT FROM OLD.given_at
       AND NEW.paper_ref IS NOT DISTINCT FROM OLD.paper_ref THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT status INTO fstatus FROM public.consent_form_versions WHERE id = NEW.form_version_id;
  IF fstatus = 'retired' THEN
    RAISE EXCEPTION 'consent form is retired' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.consent_revisions (consent_id, participant_id, form_version_id, item_key,
      old_decision, old_method, old_given_at, old_paper_ref, old_taken_by)
    VALUES (OLD.id, OLD.participant_id, OLD.form_version_id, OLD.item_key,
      OLD.decision, OLD.method, OLD.given_at, OLD.paper_ref, OLD.taken_by);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.consents_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_consents_guard ON public.consents;
CREATE TRIGGER trg_consents_guard
  BEFORE INSERT OR UPDATE ON public.consents
  FOR EACH ROW EXECUTE FUNCTION public.consents_guard();
