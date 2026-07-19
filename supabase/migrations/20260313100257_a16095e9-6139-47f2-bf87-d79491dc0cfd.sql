
DROP VIEW IF EXISTS public.booking_availability;
CREATE VIEW public.booking_availability AS
SELECT booking_date, studio_id, start_time, duration_hours, status
FROM public.bookings
WHERE status IN ('pending', 'confirmed');

GRANT SELECT ON public.booking_availability TO authenticated;
