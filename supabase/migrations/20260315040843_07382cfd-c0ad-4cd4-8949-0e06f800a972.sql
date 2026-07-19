
-- Nuki smartlocks mapping table
CREATE TABLE public.nuki_smartlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id text NOT NULL UNIQUE,
  smartlock_id text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nuki_smartlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage smartlocks" ON public.nuki_smartlocks
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Authenticated can read smartlocks" ON public.nuki_smartlocks
  FOR SELECT TO authenticated
  USING (true);

-- Booking access table for Nuki access records
CREATE TABLE public.booking_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  studio_id text NOT NULL,
  smartlock_id text NOT NULL,
  access_start timestamptz NOT NULL,
  access_end timestamptz NOT NULL,
  access_status text NOT NULL DEFAULT 'pending',
  nuki_authorization_id text,
  last_unlock_attempt timestamptz,
  last_unlock_result text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(booking_id)
);

ALTER TABLE public.booking_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own access" ON public.booking_access
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all access" ON public.booking_access
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Nuki unlock log
CREATE TABLE public.nuki_unlock_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_access_id uuid REFERENCES public.booking_access(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  studio_id text NOT NULL,
  smartlock_id text NOT NULL,
  action text NOT NULL,
  result text NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nuki_unlock_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own unlock logs" ON public.nuki_unlock_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all unlock logs" ON public.nuki_unlock_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Service role can insert unlock logs" ON public.nuki_unlock_log
  FOR INSERT TO service_role
  WITH CHECK (true);
