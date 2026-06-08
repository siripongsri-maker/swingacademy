
-- 1. CREATE TABLE
CREATE TABLE public.knowledge_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title_th TEXT NOT NULL,
  title_en TEXT,
  summary TEXT,
  key_message TEXT,
  content_md TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'th',
  categories TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  audiences TEXT[] NOT NULL DEFAULT '{}',
  product_service TEXT,
  source TEXT,
  source_type TEXT,
  cover_url TEXT,
  sponsors JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  visibility TEXT NOT NULL DEFAULT 'internal',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  featured_order INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_products_public
  ON public.knowledge_products (visibility, status, is_featured, featured_order);
CREATE INDEX idx_knowledge_products_slug ON public.knowledge_products (slug);

-- 2. GRANTS
GRANT SELECT ON public.knowledge_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_products TO authenticated;
GRANT ALL ON public.knowledge_products TO service_role;

-- 3. ENABLE RLS
ALTER TABLE public.knowledge_products ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES
-- Public can read only published + public items
CREATE POLICY "Public can read published public knowledge"
  ON public.knowledge_products
  FOR SELECT
  TO anon, authenticated
  USING (visibility = 'public' AND status = 'published');

-- Staff/Admin can read everything
CREATE POLICY "Staff and admin can read all knowledge"
  ON public.knowledge_products
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

-- Staff/Admin can insert
CREATE POLICY "Staff and admin can insert knowledge"
  ON public.knowledge_products
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

-- Staff/Admin can update
CREATE POLICY "Staff and admin can update knowledge"
  ON public.knowledge_products
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

-- Admin only can delete
CREATE POLICY "Admin can delete knowledge"
  ON public.knowledge_products
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE TRIGGER update_knowledge_products_updated_at
  BEFORE UPDATE ON public.knowledge_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed HIVST as first published+public+featured knowledge product
INSERT INTO public.knowledge_products (
  slug, title_th, title_en, summary, key_message, content_md, language,
  categories, tags, audiences, product_service, source, source_type,
  sponsors, status, visibility, is_featured, featured_order, published_at, approved_at
) VALUES (
  'hivst-community-led-model',
  'โมเดลการตรวจเอชไอวีด้วยตนเองที่นำโดยชุมชน',
  'A Community-Led Model for HIV Self-Testing',
  'โมเดล HIVST ของ SWING ที่นำโดยชุมชน · บทเรียนเก้าปีจากการเข้าถึง สู่การดูแล · ฉบับ testD (มิถุนายน 2026)',
  'การเข้าถึงเป็นเพียงครึ่งทาง โมเดลนี้จะได้ผลก็ต่อเมื่อ ‘การรู้สถานะของตัวเอง’ กับ ‘การได้รับการดูแล’ เชื่อมถึงกัน',
  '',
  'th',
  ARRAY['health','community'],
  ARRAY['HIVST','community-led','testD','harm-reduction','SWING'],
  ARRAY['staff','partners','funders','community'],
  'testD · HIV Self-Testing',
  'SWING · testD Platform',
  'internal',
  '[{"name":"SWING","role":"องค์กรหลัก / Lead organization"},{"name":"testD Platform","role":"แพลตฟอร์มบริการ / Service platform"}]'::jsonb,
  'published',
  'public',
  true,
  1,
  now(),
  now()
);
