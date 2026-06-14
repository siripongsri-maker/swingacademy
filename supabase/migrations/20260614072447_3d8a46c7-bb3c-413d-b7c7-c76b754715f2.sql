
CREATE TABLE public.knowledge_talent_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id text NOT NULL,
  asset_id uuid NOT NULL REFERENCES public.knowledge_products(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('contributor','reviewer','trainer','practitioner','expert')),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, asset_id)
);

CREATE INDEX idx_ktm_person ON public.knowledge_talent_mappings(person_id);
CREATE INDEX idx_ktm_asset ON public.knowledge_talent_mappings(asset_id);

GRANT SELECT ON public.knowledge_talent_mappings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_talent_mappings TO authenticated;
GRANT ALL ON public.knowledge_talent_mappings TO service_role;

ALTER TABLE public.knowledge_talent_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read talent mappings"
  ON public.knowledge_talent_mappings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Staff manage talent mappings"
  ON public.knowledge_talent_mappings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'staff'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'staff'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_ktm_updated_at
  BEFORE UPDATE ON public.knowledge_talent_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.knowledge_talent_mappings (person_id, asset_id, role)
SELECT 'p-sakda-unkarnkamol', id, 'practitioner'
FROM public.knowledge_products
WHERE slug = 'hivst-community-led-model'
ON CONFLICT (person_id, asset_id) DO NOTHING;
