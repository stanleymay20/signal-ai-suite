
CREATE POLICY "datasets bucket: members read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'datasets'
  AND public.is_workspace_member((storage.foldername(name))[1]::uuid, auth.uid())
);

CREATE POLICY "datasets bucket: members upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'datasets'
  AND public.is_workspace_member((storage.foldername(name))[1]::uuid, auth.uid())
  AND owner = auth.uid()
);

CREATE POLICY "datasets bucket: uploader or owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'datasets'
  AND (
    owner = auth.uid()
    OR public.is_workspace_owner((storage.foldername(name))[1]::uuid, auth.uid())
  )
);
