-- Atomic slot locking: make overlapping bookings physically impossible at the
-- database level. The edge functions keep their friendly pre-check, but the
-- exclusion constraint is what actually prevents race-condition double
-- bookings (two clients grabbing the same slot simultaneously).

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- start_time is stored as 'HH:MM' text; parsing it is DateStyle-independent,
-- so this wrapper is safe to declare IMMUTABLE for use in the index below.
CREATE OR REPLACE FUNCTION public.booking_time_range(
  p_booking_date date,
  p_start_time text,
  p_duration_hours integer
) RETURNS tsrange
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path TO 'public'
AS $$
  SELECT tsrange(
    p_booking_date + p_start_time::time,
    p_booking_date + p_start_time::time + make_interval(hours => p_duration_hours)
  );
$$;

-- Pre-clean: demote any not-yet-confirmed booking that overlaps an earlier
-- active booking, so the constraint can be created. Confirmed-vs-confirmed
-- overlaps are a real business conflict and intentionally fail the migration
-- so they get human attention.
UPDATE public.bookings b
SET status = 'expired', updated_at = now()
WHERE b.status IN ('pending', 'pending_payment')
  AND EXISTS (
    SELECT 1 FROM public.bookings o
    WHERE o.id <> b.id
      AND o.studio_id = b.studio_id
      AND o.status IN ('pending', 'pending_payment', 'confirmed')
      AND public.booking_time_range(o.booking_date, o.start_time, o.duration_hours)
       && public.booking_time_range(b.booking_date, b.start_time, b.duration_hours)
      AND (o.created_at < b.created_at OR (o.created_at = b.created_at AND o.id < b.id))
  );

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    studio_id WITH =,
    public.booking_time_range(booking_date, start_time, duration_hours) WITH &&
  )
  WHERE (status IN ('pending', 'pending_payment', 'confirmed'));
