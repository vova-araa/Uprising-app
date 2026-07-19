CREATE POLICY "Admins can insert bookings for any user"
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));