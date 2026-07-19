
UPDATE storage.buckets SET public = false WHERE id = 'uploads';

CREATE POLICY "Anyone can view config images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = 'config');
