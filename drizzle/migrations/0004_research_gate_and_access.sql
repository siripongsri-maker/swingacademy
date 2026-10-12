-- =========================================================
-- CVSK: research-use consent gate, raw-audio access, participant status
-- and the collection unlock (supplement sections 4.2, 4.3 and 4.7)
--
-- 1. Audio is linked to a session only when every speaker is cleared for
--    BOTH the processing gate and the research gate (Appendix จ: routine
--    recording and research use are signed separately). A session that is
--    put on hold for review still takes its audio, as before.
-- 2. New research role deid_assistant (de-identification assistant). Raw
--    audio plays only for the data steward and this role (server code; the
--    bucket has no storage policies). The researcher can never hold it, and
--    nobody gives it to their own account. It sees recorded sessions only.
-- 3. participants.active is readable by consent keepers only, through
--    participant_active_flags(). Session workers get the pickable codes
--    through active_participant_codes() and never see the flag itself.
-- 4. Only a data steward opens or locks collection. Opening needs a
--    non-empty ethics reference, the ethics approval date, the MoU date and
--    the new foundation permission date. Every change of the lock is written
--    to audit_events by the database itself.
--
-- HOW TO APPLY: ask Lovable to run this pending migration. Safe to run twice.
-- Depends on: 20261011120000 and 20261012150000.
-- =========================================================


-- ---------------------------------------------------------
-- 0. The de-identification assistant role
-- ---------------------------------------------------------
ALTER TYPE public.research_role ADD VALUE IF NOT EXISTS 'deid_assistant';

-- Compares the role as text on purpose: a new enum value cannot be used as a
-- literal inside the transaction that adds it.
CREATE OR REPLACE FUNCTION public.is_deid_assistant(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.research_members
    WHERE user_id = _user_id AND role::text = 'deid_assistant' AND active
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_deid_assistant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_deid_assistant(uuid) TO authenticated, service_role;


-- ---------------------------------------------------------
-- 1. Capture gate: processing AND research consent for every speaker
--    (same function as 20261012150000 section 10a, one condition added)
-- ---------------------------------------------------------
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
    -- Unless the session is being put on hold for review, every gate must hold:
    -- each speaker agreed to recording and processing AND to research use.
    IF NEW.status <> 'on_hold' THEN
      SELECT * INTO st FROM public.study_settings WHERE id = 1;
      SELECT count(*),
             bool_and(public.participant_cleared(participant_id, 'processing')
                      AND public.participant_cleared(participant_id, 'research'))
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
-- trg_capture_sessions_guard (20261012150000) already calls this function.


-- ---------------------------------------------------------
-- 2. Raw audio: who may reach a session to play it
-- ---------------------------------------------------------

-- 2a. The de-identification assistant reads recorded sessions with audio, in every
--     department, and nothing else: no drafts, nothing on hold or closed, no writes.
DROP POLICY IF EXISTS "capture_sessions_deid_read" ON public.capture_sessions;
CREATE POLICY "capture_sessions_deid_read" ON public.capture_sessions FOR SELECT TO authenticated
  USING (public.is_deid_assistant(auth.uid()) AND audio_path IS NOT NULL AND status = 'recorded');

-- 2b. Per-session flags, now also for the sessions the assistant may play.
CREATE OR REPLACE FUNCTION public.session_clearance(_session uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s record;
  n integer;
  proc boolean;
  res boolean;
BEGIN
  SELECT department, audio_path, status INTO s FROM public.capture_sessions WHERE id = _session;
  IF NOT FOUND OR NOT (
       public.can_work_on_department(auth.uid(), s.department)
    OR (public.is_deid_assistant(auth.uid()) AND s.audio_path IS NOT NULL AND s.status = 'recorded')
  ) THEN
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

-- 2c. Separation of duties (same function as 20261012150000 section 10b, extended):
--     the researcher never also hears raw audio, nobody gives themselves a consent-keeper
--     or de-identification role, and a role row cannot be moved onto one's own account.
CREATE OR REPLACE FUNCTION public.research_members_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r text := NEW.role::text;
BEGIN
  IF NOT NEW.active THEN RETURN NEW; END IF;
  IF r IN ('consent_officer', 'data_steward', 'deid_assistant') AND EXISTS (
       SELECT 1 FROM public.research_members m
       WHERE m.user_id = NEW.user_id AND m.role::text = 'researcher' AND m.active AND m.id <> NEW.id) THEN
    RAISE EXCEPTION 'a researcher cannot also be a consent officer, data steward or de-identification assistant'
      USING ERRCODE = '23514';
  END IF;
  IF r = 'researcher' AND EXISTS (
       SELECT 1 FROM public.research_members m
       WHERE m.user_id = NEW.user_id
         AND m.role::text IN ('consent_officer', 'data_steward', 'deid_assistant')
         AND m.active AND m.id <> NEW.id) THEN
    RAISE EXCEPTION 'a consent officer, data steward or de-identification assistant cannot also be the researcher'
      USING ERRCODE = '23514';
  END IF;
  IF r IN ('consent_officer', 'data_steward', 'deid_assistant') AND auth.uid() IS NOT NULL
     AND NEW.user_id = auth.uid()
     AND (TG_OP = 'INSERT' OR NOT OLD.active OR OLD.role IS DISTINCT FROM NEW.role
          OR OLD.user_id IS DISTINCT FROM NEW.user_id) THEN
    RAISE EXCEPTION 'ask another admin to grant this role' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.research_members_guard() FROM PUBLIC, anon, authenticated;
-- trg_research_members_guard (20261012150000) already calls this function.


-- ---------------------------------------------------------
-- 3. participants.active: consent keepers only
--    Column privileges apply to the database role, and every app user is
--    "authenticated", so the flag is taken out of the readable columns for
--    everyone and keepers read it through a function that checks the person.
--    Writing it (keepers, under RLS) is unchanged.
-- ---------------------------------------------------------
REVOKE SELECT ON public.participants FROM authenticated;
GRANT SELECT (id, pseudo_code, department, site, experience_tier, roles, created_at, created_by)
  ON public.participants TO authenticated;

CREATE OR REPLACE FUNCTION public.participant_active_flags()
RETURNS TABLE (participant_id uuid, active boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_consent_keeper(auth.uid()) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT p.id, p.active FROM public.participants p;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.participant_active_flags() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.participant_active_flags() TO authenticated, service_role;

-- The speaker picker: active codes only, and never the flag itself.
CREATE OR REPLACE FUNCTION public.active_participant_codes()
RETURNS TABLE (id uuid, pseudo_code text, department text, site text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_session_worker(auth.uid()) OR public.is_consent_keeper(auth.uid())) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.pseudo_code, p.department, p.site
    FROM public.participants p
    WHERE p.active
    ORDER BY p.pseudo_code;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.active_participant_codes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.active_participant_codes() TO authenticated, service_role;


-- ---------------------------------------------------------
-- 4. Collection unlock: data steward only, four approvals on file
-- ---------------------------------------------------------
ALTER TABLE public.study_settings ADD COLUMN IF NOT EXISTS foundation_permission_at date;

CREATE OR REPLACE FUNCTION public.study_settings_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  steward boolean := uid IS NOT NULL AND public.has_research_role(uid, 'data_steward');
  was_open boolean := false;
BEGIN
  IF TG_OP = 'UPDATE' THEN was_open := OLD.collection_unlocked; END IF;

  -- Opening always needs a data steward signed in to the app.
  IF NEW.collection_unlocked AND NOT was_open AND NOT steward THEN
    RAISE EXCEPTION 'only a data steward can open collection' USING ERRCODE = '42501';
  END IF;
  -- Locking is the safe direction. In the app only a data steward does it; with no app user
  -- (a migration, or the platform's own tools) it is allowed, so collection can always be stopped.
  IF was_open AND NOT NEW.collection_unlocked AND uid IS NOT NULL AND NOT steward THEN
    RAISE EXCEPTION 'only a data steward can lock collection' USING ERRCODE = '42501';
  END IF;
  -- While collection is open, the approvals it rests on change only through a data steward.
  IF was_open AND NEW.collection_unlocked AND NOT steward AND (
       NEW.ethics_ref IS DISTINCT FROM OLD.ethics_ref
    OR NEW.ethics_approved_at IS DISTINCT FROM OLD.ethics_approved_at
    OR NEW.mou_signed_at IS DISTINCT FROM OLD.mou_signed_at
    OR NEW.foundation_permission_at IS DISTINCT FROM OLD.foundation_permission_at) THEN
    RAISE EXCEPTION 'only a data steward can change approvals while collection is open' USING ERRCODE = '42501';
  END IF;

  IF NEW.collection_unlocked IS DISTINCT FROM was_open THEN
    -- Study settings are not personal, so the approvals go into the trail as they are.
    INSERT INTO public.audit_events (action, object_type, object_id, purpose, details)
    VALUES (
      CASE WHEN NEW.collection_unlocked THEN 'study.collection_open' ELSE 'study.collection_lock' END,
      'study_settings', NEW.id::text, 'research_governance',
      jsonb_build_object(
        'ethics_ref', NEW.ethics_ref,
        'ethics_approved_at', NEW.ethics_approved_at,
        'mou_signed_at', NEW.mou_signed_at,
        'foundation_permission_at', NEW.foundation_permission_at,
        'by_app_user', uid IS NOT NULL
      )
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.study_settings_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_study_settings_guard ON public.study_settings;
CREATE TRIGGER trg_study_settings_guard
  BEFORE INSERT OR UPDATE ON public.study_settings
  FOR EACH ROW EXECUTE FUNCTION public.study_settings_guard();

-- Anything opened under the earlier, weaker rule is locked again (and audited by the
-- trigger above) until all four approvals are on file and a data steward opens it.
UPDATE public.study_settings
SET collection_unlocked = false, updated_at = now()
WHERE collection_unlocked
  AND (coalesce(btrim(ethics_ref), '') = '' OR foundation_permission_at IS NULL);

ALTER TABLE public.study_settings DROP CONSTRAINT IF EXISTS study_settings_unlock_needs_approvals;
ALTER TABLE public.study_settings ADD CONSTRAINT study_settings_unlock_needs_approvals
  CHECK (NOT collection_unlocked OR (
    coalesce(btrim(ethics_ref), '') <> ''
    AND ethics_approved_at IS NOT NULL
    AND mou_signed_at IS NOT NULL
    AND foundation_permission_at IS NOT NULL
  ));