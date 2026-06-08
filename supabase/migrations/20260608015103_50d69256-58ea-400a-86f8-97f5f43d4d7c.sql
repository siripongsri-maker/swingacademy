
CREATE POLICY "Authenticated can read training files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'training-attachments');

CREATE POLICY "Authenticated can upload training files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'training-attachments');

CREATE POLICY "Authenticated can delete training files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'training-attachments');
