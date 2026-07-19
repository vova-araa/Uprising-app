
-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated can read smartlocks" ON public.nuki_smartlocks;

-- Create a restricted SELECT policy: only users with active booking_access or admins/staff
CREATE POLICY "Users with active access can read smartlocks"
  ON public.nuki_smartlocks
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.booking_access ba
      WHERE ba.user_id = auth.uid()
        AND ba.smartlock_id = nuki_smartlocks.smartlock_id
        AND ba.access_status = 'active'
        AND now() BETWEEN ba.access_start AND ba.access_end
    )
  );
