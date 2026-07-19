-- Revoke UPDATE on sensitive booking columns from authenticated/anon roles
REVOKE UPDATE (status, total_price, stripe_session_id) ON public.bookings FROM authenticated;
REVOKE UPDATE (status, total_price, stripe_session_id) ON public.bookings FROM anon;