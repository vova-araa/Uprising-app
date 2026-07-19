-- Restrict org_schools SELECT to admin/staff only
DROP POLICY IF EXISTS "Anyone authenticated can read org_schools" ON public.org_schools;

CREATE POLICY "Admins and staff can read org_schools"
ON public.org_schools
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Ensure org_participants SELECT is restricted to admin/staff only
DROP POLICY IF EXISTS "Anyone authenticated can read org_participants" ON public.org_participants;
DROP POLICY IF EXISTS "Authenticated users can read org_participants" ON public.org_participants;

CREATE POLICY "Admins and staff can read org_participants"
ON public.org_participants
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));