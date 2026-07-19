-- Re-create credit balance protection trigger (may have been lost)
CREATE OR REPLACE FUNCTION public.prevent_credit_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.credit_balance IS DISTINCT FROM NEW.credit_balance THEN
    IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) THEN
      RAISE EXCEPTION 'credit_balance is read-only for regular users';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_credit_balance ON public.profiles;
CREATE TRIGGER guard_credit_balance
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_credit_self_update();

-- Re-create status update protection trigger
CREATE OR REPLACE FUNCTION public.prevent_user_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff') THEN
    RETURN NEW;
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    RAISE EXCEPTION 'You cannot change the status of this record';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_status_change_bookings ON public.bookings;
CREATE TRIGGER prevent_status_change_bookings
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_status_change();

DROP TRIGGER IF EXISTS prevent_status_change_projects ON public.projects;
CREATE TRIGGER prevent_status_change_projects
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_status_change();

DROP TRIGGER IF EXISTS prevent_status_change_producer_bookings ON public.producer_bookings;
CREATE TRIGGER prevent_status_change_producer_bookings
  BEFORE UPDATE ON public.producer_bookings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_status_change();

DROP TRIGGER IF EXISTS prevent_status_change_content_requests ON public.content_requests;
CREATE TRIGGER prevent_status_change_content_requests
  BEFORE UPDATE ON public.content_requests
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_status_change();

-- NEW: Enforce initial status on INSERT for non-admin users
CREATE OR REPLACE FUNCTION public.enforce_initial_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) THEN
    IF TG_TABLE_NAME = 'projects' THEN
      NEW.status := 'received';
    ELSE
      NEW.status := 'pending';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_booking_initial_status
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_initial_status();

CREATE TRIGGER enforce_producer_booking_initial_status
  BEFORE INSERT ON public.producer_bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_initial_status();

CREATE TRIGGER enforce_project_initial_status
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_initial_status();

CREATE TRIGGER enforce_content_request_initial_status
  BEFORE INSERT ON public.content_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_initial_status();