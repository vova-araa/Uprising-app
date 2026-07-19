
-- Harden bookings INSERT: force total_price = 0 for non-admin/non-service direct inserts.
-- Edge function (service_role) bypasses this and sets the correct price.
CREATE OR REPLACE FUNCTION public.enforce_booking_insert_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN RETURN NEW; END IF;
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff') THEN RETURN NEW; END IF;
  -- Force safe defaults for direct user inserts; server flow (service_role) sets real values
  NEW.total_price := 0;
  NEW.stripe_session_id := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_booking_insert_price ON public.bookings;
CREATE TRIGGER enforce_booking_insert_price
BEFORE INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_insert_price();

-- Extend profile sensitive-field protection to also cover membership_end_date and membership_override
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN RETURN NEW; END IF;
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' THEN RETURN NEW; END IF;
  IF has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff') THEN RETURN NEW; END IF;
  IF OLD.credit_balance IS DISTINCT FROM NEW.credit_balance THEN
    RAISE EXCEPTION 'Cannot modify credit_balance';
  END IF;
  IF OLD.membership IS DISTINCT FROM NEW.membership THEN
    RAISE EXCEPTION 'Cannot modify membership';
  END IF;
  IF OLD.membership_end_date IS DISTINCT FROM NEW.membership_end_date THEN
    RAISE EXCEPTION 'Cannot modify membership_end_date';
  END IF;
  IF OLD.membership_override IS DISTINCT FROM NEW.membership_override THEN
    RAISE EXCEPTION 'Cannot modify membership_override';
  END IF;
  IF OLD.studio1_hours IS DISTINCT FROM NEW.studio1_hours THEN
    RAISE EXCEPTION 'Cannot modify studio1_hours';
  END IF;
  IF OLD.studio2_hours IS DISTINCT FROM NEW.studio2_hours THEN
    RAISE EXCEPTION 'Cannot modify studio2_hours';
  END IF;
  IF OLD.content_hours IS DISTINCT FROM NEW.content_hours THEN
    RAISE EXCEPTION 'Cannot modify content_hours';
  END IF;
  RETURN NEW;
END;
$$;

-- Also protect these privileged fields on INSERT (force NULL/defaults for non-admin/non-service)
CREATE OR REPLACE FUNCTION public.protect_profile_insert_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN RETURN NEW; END IF;
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff') THEN RETURN NEW; END IF;
  NEW.credit_balance := 0;
  NEW.membership := NULL;
  NEW.membership_end_date := NULL;
  NEW.membership_override := NULL;
  NEW.studio1_hours := 0;
  NEW.studio2_hours := 0;
  NEW.content_hours := 0;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_insert_fields ON public.profiles;
CREATE TRIGGER protect_profile_insert_fields
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_insert_fields();
