CREATE OR REPLACE FUNCTION public.get_booking_availability(target_date date, target_studio_id text DEFAULT NULL::text)
 RETURNS TABLE(studio_id text, start_time text, duration_hours integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT b.studio_id, b.start_time, b.duration_hours
  FROM public.bookings b
  WHERE b.booking_date = target_date
    AND b.status IN ('pending', 'confirmed', 'pending_payment')
    AND (target_studio_id IS NULL OR b.studio_id = target_studio_id);
$$;