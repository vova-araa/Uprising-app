
-- Re-add broad SELECT policy since the view needs it, and non-admin code will use the view (which only exposes safe columns)
CREATE POLICY "All authenticated can read bookings for availability"
ON public.bookings
FOR SELECT
TO authenticated
USING (true);
