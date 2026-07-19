
-- Create a view exposing only scheduling columns for availability checks
CREATE VIEW public.booking_availability AS
SELECT booking_date, studio_id, start_time, duration_hours, status
FROM public.bookings
WHERE status IN ('pending', 'confirmed');

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.booking_availability TO authenticated;

-- Drop the overly broad policy
DROP POLICY "All authenticated can view bookings for availability" ON public.bookings;
