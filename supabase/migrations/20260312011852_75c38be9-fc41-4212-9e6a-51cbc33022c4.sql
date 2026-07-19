CREATE POLICY "All authenticated can view bookings for availability"
ON public.bookings
FOR SELECT
TO authenticated
USING (true);