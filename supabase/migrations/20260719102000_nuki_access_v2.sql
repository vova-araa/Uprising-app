-- Nuki access v2: booking-scoped keypad codes, layered entrance + room access,
-- webhook events, and check-in tracking via actual door unlocks.

ALTER TABLE public.booking_access
  ADD COLUMN keypad_code text,
  ADD COLUMN checked_in_at timestamptz,
  ADD COLUMN auths_cleaned boolean NOT NULL DEFAULT false;

-- Locks flagged as entrance are included in every booking's access scope
-- (Pirate Studios-style layered pattern: front door + room door, one code).
ALTER TABLE public.nuki_smartlocks
  ADD COLUMN is_entrance boolean NOT NULL DEFAULT false;

-- Raw webhook events from Nuki (decentral webhooks: DEVICE_LOGS,
-- DEVICE_STATUS, DEVICE_AUTHS). Admin-only; written by service role.
CREATE TABLE public.nuki_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smartlock_id text,
  feature text,
  event_type text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX nuki_events_lock_idx ON public.nuki_events (smartlock_id, created_at DESC);

ALTER TABLE public.nuki_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view nuki events"
  ON public.nuki_events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));
