
CREATE TABLE public.knowledge_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  knowledge_id UUID NOT NULL REFERENCES public.knowledge_products(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  attachment_path TEXT,
  attachment_name TEXT,
  attachment_size BIGINT,
  attachment_content_type TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_activity_logs_knowledge ON public.knowledge_activity_logs(knowledge_id, created_at DESC);

GRANT SELECT, INSERT ON public.knowledge_activity_logs TO authenticated;
GRANT ALL ON public.knowledge_activity_logs TO service_role;

ALTER TABLE public.knowledge_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff and admins can view activity logs"
  ON public.knowledge_activity_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Staff and admins can insert activity logs"
  ON public.knowledge_activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  );
