
-- 1. Lock down trainings: writes only by staff/admin; non-published reads only by staff/admin
DROP POLICY IF EXISTS "Authenticated can manage trainings" ON public.trainings;
DROP POLICY IF EXISTS "Authenticated can read all trainings" ON public.trainings;

CREATE POLICY "Staff manage trainings"
  ON public.trainings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff read all trainings"
  ON public.trainings FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- 2. Lock down training_attachments: writes only by staff/admin
DROP POLICY IF EXISTS "Authenticated can manage attachments" ON public.training_attachments;
DROP POLICY IF EXISTS "Authenticated can read all attachments" ON public.training_attachments;

CREATE POLICY "Staff manage training attachments"
  ON public.training_attachments FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff read all training attachments"
  ON public.training_attachments FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- 3. Lock down person_avatars: writes only by staff/admin
DROP POLICY IF EXISTS "Authenticated manage avatars" ON public.person_avatars;

CREATE POLICY "Staff manage person avatars"
  ON public.person_avatars FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- 4. Lock down storage policies — restrict mutations to staff/admin
DROP POLICY IF EXISTS "Authenticated can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete training files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload training files" ON storage.objects;

CREATE POLICY "Staff upload avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Staff update avatars"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Staff delete avatars"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Staff upload training files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'training-attachments' AND (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Staff delete training files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'training-attachments' AND (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

-- 5. Restrict EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
