-- Fault reports with photo evidence, automatic room blocking, and
-- compensation. Fixes the #1 trust-killer of unstaffed studios: a known-broken
-- room that stays bookable.

CREATE TABLE public.fault_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  studio_id text NOT NULL,
  category text NOT NULL CHECK (category IN ('equipment', 'access', 'cleanliness', 'sound', 'other')),
  description text NOT NULL,
  photo_path text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  compensation numeric NOT NULL DEFAULT 0,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX fault_reports_status_idx ON public.fault_reports (status, created_at DESC);

ALTER TABLE public.fault_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fault reports"
  ON public.fault_reports FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all fault reports"
  ON public.fault_reports FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admins can update fault reports"
  ON public.fault_reports FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Inserts go through the report-fault edge function (service role) so the
-- auto-block + compensation logic can't be bypassed or spoofed.

CREATE TABLE public.room_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id text NOT NULL,
  reason text NOT NULL,
  fault_report_id uuid REFERENCES public.fault_reports(id) ON DELETE SET NULL,
  blocked_from timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz, -- NULL = until an admin lifts the block
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX room_blocks_active_idx ON public.room_blocks (studio_id, active) WHERE active;

ALTER TABLE public.room_blocks ENABLE ROW LEVEL SECURITY;

-- Everyone may see active blocks (the booking UI shows the room as
-- unavailable); only admins manage them.
CREATE POLICY "Anyone can view room blocks"
  ON public.room_blocks FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "Admins can manage room blocks"
  ON public.room_blocks FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));
