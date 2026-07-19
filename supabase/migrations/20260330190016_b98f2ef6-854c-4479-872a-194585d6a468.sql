
INSERT INTO storage.buckets (id, name, public) VALUES ('org-reports', 'org-reports', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can upload org reports" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'org-reports' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')));

CREATE POLICY "Admins can read org reports" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'org-reports' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')));

CREATE POLICY "Admins can delete org reports" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'org-reports' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')));
