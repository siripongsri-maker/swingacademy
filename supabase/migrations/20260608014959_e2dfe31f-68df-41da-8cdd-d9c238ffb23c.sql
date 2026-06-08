
CREATE TABLE public.trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date date,
  end_date date,
  topics text,
  visit_type text,
  sites text,
  location text,
  notes text,
  meeting_notes text,
  participants text,
  outcomes text,
  source text DEFAULT 'manual',
  published boolean NOT NULL DEFAULT false,
  public_title_en text,
  public_title_th text,
  public_summary_en text,
  public_summary_th text,
  cover_attachment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainings TO authenticated;
GRANT SELECT ON public.trainings TO anon;
GRANT ALL ON public.trainings TO service_role;

ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published trainings"
  ON public.trainings FOR SELECT
  TO anon, authenticated
  USING (published = true);

CREATE POLICY "Authenticated can read all trainings"
  ON public.trainings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can manage trainings"
  ON public.trainings FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE TABLE public.training_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id uuid NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'file',
  label text,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_attachments TO authenticated;
GRANT SELECT ON public.training_attachments TO anon;
GRANT ALL ON public.training_attachments TO service_role;

ALTER TABLE public.training_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read public attachments"
  ON public.training_attachments FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

CREATE POLICY "Authenticated can read all attachments"
  ON public.training_attachments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can manage attachments"
  ON public.training_attachments FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX idx_trainings_start ON public.trainings (start_date DESC);
CREATE INDEX idx_trainings_published ON public.trainings (published);
CREATE INDEX idx_attach_training ON public.training_attachments (training_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_trainings_updated_at BEFORE UPDATE ON public.trainings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
