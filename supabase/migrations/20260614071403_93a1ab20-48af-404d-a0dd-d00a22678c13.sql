CREATE POLICY "Staff update training files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'training-attachments'
  AND (public.has_role(auth.uid(), 'staff'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))
)
WITH CHECK (
  bucket_id = 'training-attachments'
  AND (public.has_role(auth.uid(), 'staff'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))
);