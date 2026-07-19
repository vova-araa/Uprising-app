-- Credit wallet + cancellation policy support.
-- profiles.credit_balance (euros) becomes a cached balance backed by an
-- auditable ledger, and bookings learn how they were cancelled/refunded.

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL, -- positive = credit, negative = spend
  type text NOT NULL CHECK (type IN (
    'refund_credit',   -- cancellation inside the cash-refund window
    'compensation',    -- fault report / access failure compensation
    'referral',        -- two-sided referral reward
    'purchase',        -- pre-purchased credit
    'spend',           -- applied to a booking
    'admin_adjust',    -- manual admin correction
    'expiry'           -- expired credit sweep
  )),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  note text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX wallet_transactions_user_idx ON public.wallet_transactions (user_id, created_at DESC);
CREATE INDEX wallet_transactions_expiry_idx ON public.wallet_transactions (expires_at) WHERE expires_at IS NOT NULL AND amount > 0;

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet transactions"
  ON public.wallet_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all wallet transactions"
  ON public.wallet_transactions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Writes go exclusively through wallet_apply() (service role / security definer),
-- so no INSERT/UPDATE/DELETE policies for regular users.

-- Atomically record a ledger entry and update the cached balance.
-- Locks the profile row so concurrent spends can't overdraw.
CREATE OR REPLACE FUNCTION public.wallet_apply(
  p_user_id uuid,
  p_amount numeric,
  p_type text,
  p_booking_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance numeric;
BEGIN
  SELECT credit_balance INTO v_balance
  FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'profile not found for user %', p_user_id;
  END IF;

  IF v_balance + p_amount < 0 THEN
    RAISE EXCEPTION 'insufficient wallet balance: have %, need %', v_balance, -p_amount;
  END IF;

  INSERT INTO public.wallet_transactions (user_id, amount, type, booking_id, note, expires_at)
  VALUES (p_user_id, p_amount, p_type, p_booking_id, p_note, p_expires_at);

  UPDATE public.profiles
  SET credit_balance = v_balance + p_amount, updated_at = now()
  WHERE id = p_user_id;

  RETURN v_balance + p_amount;
END;
$$;

-- Only service role may call wallet_apply
REVOKE EXECUTE ON FUNCTION public.wallet_apply FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_apply TO service_role;

-- Cancellation metadata on bookings
ALTER TABLE public.bookings
  ADD COLUMN wallet_applied numeric NOT NULL DEFAULT 0,
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancellation_refund text;
