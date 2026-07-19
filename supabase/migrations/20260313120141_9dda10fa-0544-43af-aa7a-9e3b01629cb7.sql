CREATE POLICY "Admins can delete producer bookings"
ON public.producer_bookings
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));