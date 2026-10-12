-- =========================================================
-- CVSK Round 0 baseline inventory
--
-- What already exists before CVSK: trainings and learning events found in
-- LINE groups, ad hoc AI summaries, knowledge products, documents. One row
-- per item, with how much reusable knowledge material survives.
--
-- HOW TO APPLY: ask Lovable to run this pending migration (same as
-- 20261011120000). Safe to run twice; nothing is dropped.
-- Depends on: has_role, has_research_role (20261011120000).
-- =========================================================

CREATE TABLE IF NOT EXISTS public.baseline_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- where the item was found
  source text NOT NULL
    CHECK (source IN ('line_chat', 'ai_summary', 'knowledge_product', 'document', 'other')),
  external_id text NOT NULL,          -- id inside the source inventory, e.g. T001
  source_group text,                  -- e.g. "SWING Family"
  -- what it is
  title text NOT NULL,
  topic_area text,
  date_start date,
  date_end date,
  date_note text,                     -- raw text when the date is approximate or unknown
  swing_role text,                    -- delivered_by_swing, attended_external, ...
  organiser text,
  audience text,
  format text,
  status text,                        -- happened, planned_unconfirmed, planned_future, ...
  -- what knowledge survives
  artifacts text,
  knowledge_level text NOT NULL DEFAULT 'unknown'
    CHECK (knowledge_level IN (
      'content_file', 'written_summary', 'recording', 'admin_only',
      'photos_or_links', 'deleted', 'none', 'unknown'
    )),
  -- provenance
  confidence text,
  verified boolean NOT NULL DEFAULT false,
  evidence text,                      -- e.g. "SWING Family L2157" (no personal data)
  notes text,
  import_batch uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_baseline_items_date ON public.baseline_items (date_start);
CREATE INDEX IF NOT EXISTS idx_baseline_items_level ON public.baseline_items (knowledge_level);
CREATE INDEX IF NOT EXISTS idx_baseline_items_batch ON public.baseline_items (source, import_batch);

REVOKE ALL ON public.baseline_items FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.baseline_items TO authenticated;
GRANT ALL ON public.baseline_items TO service_role;
ALTER TABLE public.baseline_items ENABLE ROW LEVEL SECURITY;

-- Admins, researchers and data stewards read and write the baseline
DROP POLICY IF EXISTS "baseline_items_research_all" ON public.baseline_items;

DROP POLICY IF EXISTS "baseline_items_research_read" ON public.baseline_items;
CREATE POLICY "baseline_items_research_read" ON public.baseline_items FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin')
    OR public.has_research_role(auth.uid(), 'researcher')
    OR public.has_research_role(auth.uid(), 'data_steward')
  );

DROP POLICY IF EXISTS "baseline_items_research_insert" ON public.baseline_items;
CREATE POLICY "baseline_items_research_insert" ON public.baseline_items FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin')
    OR public.has_research_role(auth.uid(), 'researcher')
    OR public.has_research_role(auth.uid(), 'data_steward')
  );

DROP POLICY IF EXISTS "baseline_items_research_update" ON public.baseline_items;
CREATE POLICY "baseline_items_research_update" ON public.baseline_items FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin')
    OR public.has_research_role(auth.uid(), 'researcher')
    OR public.has_research_role(auth.uid(), 'data_steward')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin')
    OR public.has_research_role(auth.uid(), 'researcher')
    OR public.has_research_role(auth.uid(), 'data_steward')
  );

-- Deleting research data is narrower: admins and data stewards only
DROP POLICY IF EXISTS "baseline_items_steward_delete" ON public.baseline_items;
CREATE POLICY "baseline_items_steward_delete" ON public.baseline_items FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin')
    OR public.has_research_role(auth.uid(), 'data_steward')
  );

-- Keep updated_at honest on re-imports
CREATE OR REPLACE FUNCTION public.baseline_items_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_baseline_items_touch ON public.baseline_items;
CREATE TRIGGER trg_baseline_items_touch
  BEFORE UPDATE ON public.baseline_items
  FOR EACH ROW EXECUTE FUNCTION public.baseline_items_touch();