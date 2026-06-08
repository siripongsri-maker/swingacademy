
CREATE TABLE public.person_avatars (
  person_id text PRIMARY KEY,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_avatars TO authenticated;
GRANT SELECT ON public.person_avatars TO anon;
GRANT ALL ON public.person_avatars TO service_role;

ALTER TABLE public.person_avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read avatars" ON public.person_avatars FOR SELECT USING (true);
CREATE POLICY "Authenticated manage avatars" ON public.person_avatars FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_person_avatars_updated_at BEFORE UPDATE ON public.person_avatars
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Anyone can read avatar files" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Authenticated can upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Authenticated can update avatars" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "Authenticated can delete avatars" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars');
