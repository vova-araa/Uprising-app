
-- 1. Make uploads bucket private
UPDATE storage.buckets SET public = false WHERE id = 'uploads';

-- 2. Fix RLS: Restrict user self-UPDATE to safe columns only
-- Drop existing overly broad user update policies and replace with column-restricted ones

-- BOOKINGS: users can only update notes and extras, not status
DROP POLICY IF EXISTS "Users can update own bookings" ON public.bookings;
CREATE POLICY "Users can update own bookings safe columns"
ON public.bookings FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- We need a trigger to prevent users from changing status on their own rows
CREATE OR REPLACE FUNCTION public.prevent_user_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow admins/staff to change any column
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff') THEN
    RETURN NEW;
  END IF;
  
  -- For regular users, prevent status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    RAISE EXCEPTION 'You cannot change the status of this record';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply trigger to bookings
DROP TRIGGER IF EXISTS prevent_booking_status_change ON public.bookings;
CREATE TRIGGER prevent_booking_status_change
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_status_change();

-- Apply trigger to projects
DROP TRIGGER IF EXISTS prevent_project_status_change ON public.projects;
CREATE TRIGGER prevent_project_status_change
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_status_change();

-- Apply trigger to producer_bookings
DROP TRIGGER IF EXISTS prevent_producer_booking_status_change ON public.producer_bookings;
CREATE TRIGGER prevent_producer_booking_status_change
  BEFORE UPDATE ON public.producer_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_status_change();

-- Apply trigger to content_requests
DROP TRIGGER IF EXISTS prevent_content_request_status_change ON public.content_requests;
CREATE TRIGGER prevent_content_request_status_change
  BEFORE UPDATE ON public.content_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_status_change();
