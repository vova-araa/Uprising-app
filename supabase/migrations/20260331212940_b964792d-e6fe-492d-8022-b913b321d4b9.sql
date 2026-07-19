CREATE OR REPLACE FUNCTION public.enforce_initial_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow service_role (edge functions) to set any status
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  -- Also check via auth.role() for service_role clients
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) THEN
    IF TG_TABLE_NAME = 'projects' THEN
      NEW.status := 'received';
    ELSE
      NEW.status := 'pending';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;