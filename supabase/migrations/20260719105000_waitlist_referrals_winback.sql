-- Waitlist with push auto-offer, two-sided referral rewards, and win-back
-- tracking.

CREATE TABLE public.booking_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  studio_id text NOT NULL,
  booking_date date NOT NULL,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'expired')),
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, studio_id, booking_date)
);

CREATE INDEX booking_waitlist_slot_idx ON public.booking_waitlist (studio_id, booking_date, status);

ALTER TABLE public.booking_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own waitlist entries"
  ON public.booking_waitlist FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view waitlist"
  ON public.booking_waitlist FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Win-back: remember when we last reached out so lapsed users are contacted
-- at most once per cycle.
ALTER TABLE public.profiles
  ADD COLUMN last_winback_at timestamptz;
