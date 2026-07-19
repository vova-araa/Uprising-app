CREATE TRIGGER protect_booking_sensitive_fields
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_booking_sensitive_fields();