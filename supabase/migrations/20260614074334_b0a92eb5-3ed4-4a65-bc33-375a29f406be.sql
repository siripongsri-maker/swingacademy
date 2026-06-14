
CREATE TABLE public.knowledge_translations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.knowledge_products(id) ON DELETE CASCADE,
  audience TEXT NOT NULL DEFAULT 'general_public',
  format TEXT NOT NULL DEFAULT 'short_article',
  tone TEXT NOT NULL DEFAULT 'friendly',
  language TEXT NOT NULL DEFAULT 'th',
  instruction TEXT NOT NULL DEFAULT '',
  output_md TEXT NOT NULL DEFAULT '',
  title TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','published')),
  contributor_id TEXT,
  owner_id UUID,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_translations_asset ON public.knowledge_translations(asset_id);
CREATE INDEX idx_knowledge_translations_status ON public.knowledge_translations(status);

GRANT SELECT ON public.knowledge_translations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_translations TO authenticated;
GRANT ALL ON public.knowledge_translations TO service_role;

ALTER TABLE public.knowledge_translations ENABLE ROW LEVEL SECURITY;

-- Anyone can read published translations whose parent asset is public+published
CREATE POLICY "Public can read published translations"
ON public.knowledge_translations
FOR SELECT
USING (
  status = 'published'
  AND EXISTS (
    SELECT 1 FROM public.knowledge_products kp
    WHERE kp.id = knowledge_translations.asset_id
      AND kp.visibility = 'public'
      AND kp.status = 'published'
  )
);

-- Staff/admin can read everything
CREATE POLICY "Staff can read all translations"
ON public.knowledge_translations
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'staff'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Staff can insert translations"
ON public.knowledge_translations
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'staff'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Staff can update translations"
ON public.knowledge_translations
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'staff'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'staff'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Staff can delete translations"
ON public.knowledge_translations
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'staff'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE TRIGGER update_knowledge_translations_updated_at
BEFORE UPDATE ON public.knowledge_translations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
