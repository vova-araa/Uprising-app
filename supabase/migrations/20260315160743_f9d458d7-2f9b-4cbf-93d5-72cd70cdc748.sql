-- Revoke UPDATE on sensitive columns from authenticated role
REVOKE UPDATE (credit_balance, membership, studio1_hours, studio2_hours, content_hours, broedplaats) ON public.profiles FROM authenticated;
REVOKE UPDATE (credit_balance, membership, studio1_hours, studio2_hours, content_hours, broedplaats) ON public.profiles FROM anon;