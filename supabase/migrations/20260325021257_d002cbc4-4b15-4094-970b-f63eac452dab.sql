
-- Attach the existing protect_profile_sensitive_fields function as a trigger
CREATE TRIGGER protect_profile_sensitive_fields_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_sensitive_fields();

-- Also revoke direct UPDATE on financial columns as defense-in-depth
REVOKE UPDATE (credit_balance, membership, studio1_hours, studio2_hours, content_hours, broedplaats) ON public.profiles FROM authenticated;
