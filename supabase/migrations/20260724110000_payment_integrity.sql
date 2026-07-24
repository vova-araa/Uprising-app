-- Payment integrity backstops.
--
-- verify-payment confirms bookings/subscriptions by re-checking the Stripe
-- Checkout Session (no webhook secret is used — this is the intended design).
-- These DB constraints make the "pay once, confirm many" replay class
-- impossible even if application logic regresses:
--
--   * A given Stripe session may mark at most ONE studio booking and at most
--     ONE producer booking as paid (partial-unique on stripe_session_id).
--   * Gift-card codes are globally unique, so redeem-gift-card can never match
--     two cards.

-- One Stripe session -> at most one studio booking.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_stripe_session_id_uniq
  ON public.bookings (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

-- One Stripe session -> at most one producer booking.
CREATE UNIQUE INDEX IF NOT EXISTS producer_bookings_stripe_session_id_uniq
  ON public.producer_bookings (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

-- Gift-card codes must be unique (redeem matches on code).
CREATE UNIQUE INDEX IF NOT EXISTS gift_cards_code_uniq
  ON public.gift_cards (code)
  WHERE code IS NOT NULL;
