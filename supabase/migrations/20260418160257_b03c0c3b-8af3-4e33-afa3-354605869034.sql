DROP POLICY IF EXISTS "Anyone authenticated can read org_team_members" ON public.org_team_members;

CREATE POLICY "Admins and staff can read org_team_members"
ON public.org_team_members
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));