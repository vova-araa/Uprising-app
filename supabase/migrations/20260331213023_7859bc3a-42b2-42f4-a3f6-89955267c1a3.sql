CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.protect_project_sensitive_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN RETURN NEW; END IF;
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' THEN RETURN NEW; END IF;
  IF has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff') THEN RETURN NEW; END IF;
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    RAISE EXCEPTION 'Cannot modify project price';
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    RAISE EXCEPTION 'Cannot modify project status';
  END IF;
  IF OLD.stripe_session_id IS DISTINCT FROM NEW.stripe_session_id THEN
    RAISE EXCEPTION 'Cannot modify stripe_session_id';
  END IF;
  IF OLD.staff_notes IS DISTINCT FROM NEW.staff_notes THEN
    RAISE EXCEPTION 'Cannot modify staff_notes';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_producer_booking_sensitive_fields()
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
    RAISE EXCEPTION 'Cannot modify producer booking status';
  END IF;
  IF OLD.producer_notes IS DISTINCT FROM NEW.producer_notes THEN
    RAISE EXCEPTION 'Cannot modify producer_notes';
  END IF;
  IF OLD.stripe_session_id IS DISTINCT FROM NEW.stripe_session_id THEN
    RAISE EXCEPTION 'Cannot modify stripe_session_id';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_content_request_sensitive_fields()
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
    RAISE EXCEPTION 'Cannot modify content request status';
  END IF;
  IF OLD.staff_notes IS DISTINCT FROM NEW.staff_notes THEN
    RAISE EXCEPTION 'Cannot modify staff_notes';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_credit_self_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN RETURN NEW; END IF;
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' THEN RETURN NEW; END IF;
  IF OLD.credit_balance IS DISTINCT FROM NEW.credit_balance THEN
    IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) THEN
      RAISE EXCEPTION 'credit_balance is read-only for regular users';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;