-- Atomic, id-preserving booking modification.
--
-- Background: regular users can't edit a booking's date/time/studio/duration
-- because protect_booking_sensitive_fields() blocks those columns. The frontend
-- worked around this by DELETE + INSERT, which (a) risked losing the booking if
-- the re-insert failed and (b) minted a NEW booking id, orphaning any Nuki door
-- access already provisioned against the old id.
--
-- This migration lets the owner move their own booking IN PLACE via a
-- SECURITY DEFINER RPC that does its own ownership/status checks. The existing
-- bookings_no_overlap exclusion constraint still guarantees atomicity: moving
-- onto an occupied slot raises 23P01 and the whole UPDATE rolls back, so the
-- booking is never left half-changed.

-- 1) Let the protect trigger pass for the in-place edit performed by the RPC.
--    The flag is set transaction-locally inside the SECURITY DEFINER function
--    only, and the function validates ownership first, so a normal REST update
--    still cannot set it and is still blocked.
CREATE OR REPLACE FUNCTION public.protect_booking_sensitive_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN RETURN NEW; END IF;
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' THEN RETURN NEW; END IF;
  IF has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff') THEN RETURN NEW; END IF;
  -- Allow the vetted in-place reschedule performed by modify_own_booking().
  IF current_setting('app.allow_booking_modify', true) = 'on' THEN RETURN NEW; END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    RAISE EXCEPTION 'Cannot modify booking status';
  END IF;
  IF OLD.total_price IS DISTINCT FROM NEW.total_price THEN
    RAISE EXCEPTION 'Cannot modify total_price';
  END IF;
  IF OLD.stripe_session_id IS DISTINCT FROM NEW.stripe_session_id THEN
    RAISE EXCEPTION 'Cannot modify stripe_session_id';
  END IF;
  IF OLD.studio_id IS DISTINCT FROM NEW.studio_id THEN
    RAISE EXCEPTION 'Cannot modify studio_id';
  END IF;
  IF OLD.duration_hours IS DISTINCT FROM NEW.duration_hours THEN
    RAISE EXCEPTION 'Cannot modify duration_hours';
  END IF;
  IF OLD.booking_date IS DISTINCT FROM NEW.booking_date THEN
    RAISE EXCEPTION 'Cannot modify booking_date';
  END IF;
  IF OLD.start_time IS DISTINCT FROM NEW.start_time THEN
    RAISE EXCEPTION 'Cannot modify start_time';
  END IF;
  IF OLD.extras IS DISTINCT FROM NEW.extras THEN
    RAISE EXCEPTION 'Cannot modify extras';
  END IF;
  IF OLD.session_type IS DISTINCT FROM NEW.session_type THEN
    RAISE EXCEPTION 'Cannot modify session_type';
  END IF;
  IF OLD.notes IS DISTINCT FROM NEW.notes THEN
    RAISE EXCEPTION 'Cannot modify notes';
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) The reschedule RPC. Returns the updated booking row (same id).
CREATE OR REPLACE FUNCTION public.modify_own_booking(
  p_booking_id uuid,
  p_studio_id text,
  p_booking_date date,
  p_start_time text,
  p_duration_hours integer
) RETURNS public.bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_booking public.bookings;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Only the owner (or admin/staff) may reschedule.
  IF v_booking.user_id IS DISTINCT FROM auth.uid()
     AND NOT has_role(auth.uid(), 'admin')
     AND NOT has_role(auth.uid(), 'staff') THEN
    RAISE EXCEPTION 'Not allowed to modify this booking';
  END IF;

  -- Only active bookings can be moved.
  IF v_booking.status NOT IN ('confirmed', 'pending', 'pending_payment') THEN
    RAISE EXCEPTION 'Only active bookings can be modified';
  END IF;

  IF p_duration_hours IS NULL OR p_duration_hours < 1 THEN
    RAISE EXCEPTION 'Invalid duration';
  END IF;

  -- Whitelist the in-place edit for this transaction, then update by id so the
  -- booking (and any Nuki access keyed to it) keeps the same id. A clash with
  -- another active booking trips bookings_no_overlap (SQLSTATE 23P01) and rolls
  -- the whole statement back.
  PERFORM set_config('app.allow_booking_modify', 'on', true);

  UPDATE public.bookings
     SET studio_id      = p_studio_id,
         booking_date   = p_booking_date,
         start_time     = p_start_time,
         duration_hours = p_duration_hours,
         updated_at     = now()
   WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$function$;

REVOKE ALL ON FUNCTION public.modify_own_booking(uuid, text, date, text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.modify_own_booking(uuid, text, date, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.modify_own_booking(uuid, text, date, text, integer) TO service_role;
