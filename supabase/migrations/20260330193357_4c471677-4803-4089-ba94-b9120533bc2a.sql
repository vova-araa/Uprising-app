-- Allow members to delete their own confirmed member/gratis bookings
CREATE POLICY "Members can delete own member/gratis bookings"
ON public.bookings
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id 
  AND session_type IN ('member', 'gratis')
  AND status = 'confirmed'
);

-- Allow members to insert bookings with confirmed status (for re-creating after modify)
-- Already covered by existing "Users can insert own bookings" policy