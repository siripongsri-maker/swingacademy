-- =========================================================
-- Baseline: room for AI summaries (Round 0)
--
-- Adds what the existing AI summaries (Notion AI meeting notes) need:
-- the summary text itself, what kind of event it was, a link back to the
-- source, a sensitivity flag, and membership in the Round 0 sample of 30.
--
-- HOW TO APPLY: ask Lovable to run this pending migration. Safe to run
-- twice; existing rows keep their values (new columns start empty).
-- =========================================================

ALTER TABLE public.baseline_items
  ADD COLUMN IF NOT EXISTS item_type text,           -- training, workshop, conference_session, internal_meeting, ...
  ADD COLUMN IF NOT EXISTS content_md text,          -- summary text (AI summaries); raw transcripts are never stored here
  ADD COLUMN IF NOT EXISTS content_chars integer,
  ADD COLUMN IF NOT EXISTS has_action_items boolean,
  ADD COLUMN IF NOT EXISTS language text,            -- th, en, mixed
  ADD COLUMN IF NOT EXISTS sensitivity text,         -- none, staff_names, community_identifiable, health_info_about_individuals
  ADD COLUMN IF NOT EXISTS sensitivity_note text,    -- type of issue only, never the sensitive content
  ADD COLUMN IF NOT EXISTS source_url text,          -- link back to the original (e.g. Notion page)
  ADD COLUMN IF NOT EXISTS linked_item text,         -- same event in another source, e.g. LINE inventory T019
  ADD COLUMN IF NOT EXISTS sample_set text;          -- e.g. round0_ai30 for the descriptive Round 0 sample

DO $$ BEGIN
  ALTER TABLE public.baseline_items
    ADD CONSTRAINT baseline_items_sensitivity_check
    CHECK (sensitivity IS NULL OR sensitivity IN
      ('none', 'staff_names', 'community_identifiable', 'health_info_about_individuals'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_baseline_items_sample ON public.baseline_items (sample_set);
