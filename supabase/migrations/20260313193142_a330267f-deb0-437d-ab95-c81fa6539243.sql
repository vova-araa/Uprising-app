
-- ============================================================
-- FIX 1: Column-level security on profiles table
-- Prevent users from self-updating credit_balance, membership, hours
-- ============================================================
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, phone, address, postal_code, city, language, email, broedplaats, referral_code) ON public.profiles TO authenticated;

-- ============================================================
-- FIX 2: Replace broad bookings user update policy with restricted one
-- Users should only update notes on their own bookings
-- ============================================================
DROP POLICY IF EXISTS "Users can update own bookings" ON public.bookings;
CREATE POLICY "Users can update own booking notes"
ON public.bookings FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Then restrict columns
REVOKE UPDATE ON public.bookings FROM authenticated;
GRANT UPDATE (notes) ON public.bookings TO authenticated;
-- Re-grant all to admin via service_role (admins use has_role check in policy)
-- We need a security definer function for admin updates instead

-- Actually, column-level grants affect ALL policies including admin ones.
-- Better approach: use trigger to block sensitive column changes by non-admins.
-- Let me revert and use triggers instead.
GRANT UPDATE ON public.bookings TO authenticated;

-- Drop the restrictive policy and recreate original
DROP POLICY IF EXISTS "Users can update own booking notes" ON public.bookings;
CREATE POLICY "Users can update own bookings"
ON public.bookings FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Revert profiles too - column grants break admin updates
GRANT UPDATE ON public.profiles TO authenticated;

-- ============================================================
-- BETTER APPROACH: Triggers to block non-admin sensitive field changes
-- ============================================================

-- Profiles: block non-admin changes to credit_balance, membership, hours
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff') THEN
    RETURN NEW;
  END IF;
  -- Block sensitive field changes for regular users
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
$$;

DROP TRIGGER IF EXISTS protect_profile_sensitive ON public.profiles;
CREATE TRIGGER protect_profile_sensitive
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_sensitive_fields();

-- Bookings: block non-admin changes to status, total_price, stripe_session_id
CREATE OR REPLACE FUNCTION public.protect_booking_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff') THEN
    RETURN NEW;
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    RAISE EXCEPTION 'Cannot modify booking status';
  END IF;
  IF OLD.total_price IS DISTINCT FROM NEW.total_price THEN
    RAISE EXCEPTION 'Cannot modify total_price';
  END IF;
  IF OLD.stripe_session_id IS DISTINCT FROM NEW.stripe_session_id THEN
    RAISE EXCEPTION 'Cannot modify stripe_session_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_booking_sensitive ON public.bookings;
CREATE TRIGGER protect_booking_sensitive
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_booking_sensitive_fields();

-- Producer bookings: block non-admin changes to status, producer_notes, stripe_session_id
CREATE OR REPLACE FUNCTION public.protect_producer_booking_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff') THEN
    RETURN NEW;
  END IF;
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
$$;

DROP TRIGGER IF EXISTS protect_producer_booking_sensitive ON public.producer_bookings;
CREATE TRIGGER protect_producer_booking_sensitive
  BEFORE UPDATE ON public.producer_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_producer_booking_sensitive_fields();

-- Projects: block non-admin changes to price, status, stripe_session_id
CREATE OR REPLACE FUNCTION public.protect_project_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff') THEN
    RETURN NEW;
  END IF;
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
$$;

DROP TRIGGER IF EXISTS protect_project_sensitive ON public.projects;
CREATE TRIGGER protect_project_sensitive
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_project_sensitive_fields();

-- Content requests: block non-admin changes to status, staff_notes
-- First replace the ALL policy with separate SELECT, INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can manage own content requests" ON public.content_requests;

CREATE POLICY "Users can select own content requests"
ON public.content_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own content requests"
ON public.content_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own content requests"
ON public.content_requests FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own content requests"
ON public.content_requests FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.protect_content_request_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff') THEN
    RETURN NEW;
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    RAISE EXCEPTION 'Cannot modify content request status';
  END IF;
  IF OLD.staff_notes IS DISTINCT FROM NEW.staff_notes THEN
    RAISE EXCEPTION 'Cannot modify staff_notes';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_content_request_sensitive ON public.content_requests;
CREATE TRIGGER protect_content_request_sensitive
  BEFORE UPDATE ON public.content_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_content_request_sensitive_fields();

-- ============================================================
-- FIX 3: Fix mutable search_path on existing functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT pgmq.send(queue_name, payload); $$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT msg_id, read_ct, message FROM pgmq.read(queue_name, vt, batch_size); $$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT pgmq.delete(queue_name, message_id); $$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
END;
$$;

-- ============================================================
-- FIX 4: Add indexes for common queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bookings_date_status ON public.bookings(booking_date, status);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_studio_date ON public.bookings(studio_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_producer_bookings_user_id ON public.producer_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_app_config_key ON public.app_config(config_key);
CREATE INDEX IF NOT EXISTS idx_content_requests_user_id ON public.content_requests(user_id);

-- ============================================================
-- FIX 5: Create admin_audit_logs table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  action text NOT NULL,
  target_table text,
  target_id text,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can read audit logs"
ON public.admin_audit_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can insert audit logs"
ON public.admin_audit_logs FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
