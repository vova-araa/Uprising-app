
-- Prevent regular users from modifying their own credit_balance
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
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_credit_self_update();
