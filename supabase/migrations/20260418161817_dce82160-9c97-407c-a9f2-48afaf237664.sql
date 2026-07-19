-- 1. Restrict org_locations SELECT to admin/staff only
DROP POLICY IF EXISTS "Anyone authenticated can read org_locations" ON public.org_locations;
DROP POLICY IF EXISTS "Authenticated users can read org_locations" ON public.org_locations;

CREATE POLICY "Admins and staff can read org_locations"
ON public.org_locations
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- 2. Drop overly-permissive public avatars SELECT policy
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;

-- 3. Remove app_config from realtime publication (read access via normal queries remains)
ALTER PUBLICATION supabase_realtime DROP TABLE public.app_config;