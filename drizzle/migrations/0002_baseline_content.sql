-- =========================================================
-- Baseline: room for AI summaries (Round 0)
--
-- Adds what the existing AI summaries (Notion AI meeting notes) need:
-- the summary text itself, what kind of event it was, a link back to the
-- source, a sensitivity flag, and membership in the Round 0 sample of 30.
-- =========================================================

ALTER TABLE public.baseline_items
  ADD COLUMN IF NOT EXISTS item_type text,
  ADD COLUMN IF NOT EXISTS content_md text,
  ADD COLUMN IF NOT EXISTS content_chars integer,
  ADD COLUMN IF NOT EXISTS has_action_items boolean,
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS sensitivity text,
  ADD COLUMN IF NOT EXISTS sensitivity_note text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS linked_item text,
  ADD COLUMN IF NOT EXISTS sample_set text;

DO $$ BEGIN
  ALTER TABLE public.baseline_items
    ADD CONSTRAINT baseline_items_sensitivity_check
    CHECK (sensitivity IS NULL OR sensitivity IN
      ('none', 'staff_names', 'community_identifiable', 'health_info_about_individuals'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_baseline_items_sample ON public.baseline_items (sample_set);