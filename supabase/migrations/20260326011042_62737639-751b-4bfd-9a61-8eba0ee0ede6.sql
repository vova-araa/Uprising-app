-- Add explicit restrictive policy to prevent non-admin INSERT on user_roles
-- This closes the theoretical privilege escalation vector
CREATE POLICY "Block non-admin inserts"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- Add explicit restrictive policy to prevent non-admin UPDATE on user_roles
CREATE POLICY "Block non-admin updates"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- Add explicit restrictive policy to prevent non-admin DELETE on user_roles
CREATE POLICY "Block non-admin deletes"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);