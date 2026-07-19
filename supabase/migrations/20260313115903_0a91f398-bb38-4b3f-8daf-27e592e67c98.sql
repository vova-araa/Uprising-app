CREATE POLICY "Users can delete own pending_payment bookings"
ON public.bookings
FOR DELETE
TO authenticated
USING (auth.uid() = user_id AND status = 'pending_payment');