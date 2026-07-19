CREATE OR REPLACE FUNCTION public.prevent_user_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow service_role (edge functions)
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff') THEN
    RETURN NEW;
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    RAISE EXCEPTION 'You cannot change the status of this record';
  END IF;
  RETURN NEW;
END;
$function$;

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
  RETURN NEW;
END;
$function$;