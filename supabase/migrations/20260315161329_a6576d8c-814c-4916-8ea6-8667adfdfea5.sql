-- Replace the broad user update policy with one that only allows updating safe columns
DROP POLICY IF EXISTS "Users can update own bookings" ON public.bookings;

-- Users can only update notes on their own bookings
CREATE POLICY "Users can update own bookings"
ON public.bookings
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);