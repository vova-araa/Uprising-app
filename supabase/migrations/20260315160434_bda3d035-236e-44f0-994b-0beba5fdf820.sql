-- Fix error_logs INSERT policy to prevent user_id spoofing
DROP POLICY IF EXISTS "Anyone can insert error logs" ON public.error_logs;
CREATE POLICY "Anyone can insert error logs" ON public.error_logs
FOR INSERT TO authenticated
WITH CHECK (user_id IS NULL OR auth.uid() = user_id);