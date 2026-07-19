-- Fix error_logs: make user_id NOT NULL to prevent null user_id inserts
ALTER TABLE public.error_logs ALTER COLUMN user_id SET NOT NULL;

-- Fix user_roles: add restrictive SELECT policy so even self-read requires the row to match auth.uid()
-- This doesn't change functionality but makes it explicit and prevents any bypass
CREATE POLICY "Restrict select to own or admin"
ON public.user_roles
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role)
);