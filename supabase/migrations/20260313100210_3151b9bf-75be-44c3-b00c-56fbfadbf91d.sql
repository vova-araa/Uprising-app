
-- Fix security definer view by recreating with SECURITY INVOKER
DROP VIEW IF EXISTS public.booking_availability;
CREATE VIEW public.booking_availability WITH (security_invoker = true) AS
SELECT booking_date, studio_id, start_time, duration_hours, status
FROM public.bookings
WHERE status IN ('pending', 'confirmed');

GRANT SELECT ON public.booking_availability TO authenticated;
