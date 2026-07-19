-- Gift cards: buy studio credit as a gift (Stripe), the recipient redeems the
-- code into their wallet.

CREATE TABLE public.gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  amount numeric NOT NULL,
  purchaser_user_id uuid,
  recipient_email text,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'redeemed', 'cancelled')),
  redeemed_by uuid,
  stripe_session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz
);

CREATE INDEX gift_cards_code_idx ON public.gift_cards (code);
CREATE INDEX gift_cards_purchaser_idx ON public.gift_cards (purchaser_user_id);

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

-- Buyers can see the cards they purchased (to retrieve the code); everything
-- else (issuing, redeeming) goes through service-role edge functions so codes
-- can't be enumerated or forged.
CREATE POLICY "Buyer views own gift cards"
  ON public.gift_cards FOR SELECT TO authenticated
  USING (purchaser_user_id = auth.uid());

CREATE POLICY "Admins view gift cards"
  ON public.gift_cards FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));
