-- Label / business accounts: a shared pool of studio hours that the label
-- tops up per term, with per-artist usage tracking and PDF invoicing. The
-- label manager books sessions on behalf of their artists, drawing from the
-- pool.

CREATE TABLE public.labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text,
  contact_email text,
  billing_address text,
  vat_number text,
  manager_user_id uuid,                 -- the label-manager account (books + sees dashboard)
  hours_balance numeric NOT NULL DEFAULT 0,  -- shared pool, in hours
  default_rate numeric NOT NULL DEFAULT 45,  -- €/hour used to price top-up invoices
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX labels_manager_idx ON public.labels (manager_user_id);

CREATE TABLE public.label_artists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label_id uuid NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  name text NOT NULL,
  user_id uuid,                         -- optional link to an app account
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX label_artists_label_idx ON public.label_artists (label_id);

-- Ledger for the shared pool: positive = top-up, negative = usage. Usage rows
-- carry the artist + booking so we can report per-artist consumption.
CREATE TABLE public.label_hour_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label_id uuid NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  hours numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('topup', 'usage', 'refund', 'admin_adjust')),
  artist_id uuid REFERENCES public.label_artists(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX label_hour_tx_label_idx ON public.label_hour_transactions (label_id, created_at DESC);
CREATE INDEX label_hour_tx_artist_idx ON public.label_hour_transactions (artist_id);

CREATE TABLE public.label_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label_id uuid NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  invoice_number text NOT NULL UNIQUE,
  hours numeric NOT NULL,
  rate numeric NOT NULL,
  subtotal numeric NOT NULL,
  vat_rate numeric NOT NULL DEFAULT 21,
  vat_amount numeric NOT NULL,
  total numeric NOT NULL,
  term text,                            -- e.g. "Q1 2026" / free description
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'cancelled')),
  pdf_path text,                        -- storage path in the invoices bucket
  sent_at timestamptz,
  paid_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX label_invoices_label_idx ON public.label_invoices (label_id, created_at DESC);

-- Link bookings to a label + artist (both nullable for normal bookings)
ALTER TABLE public.bookings
  ADD COLUMN label_id uuid REFERENCES public.labels(id) ON DELETE SET NULL,
  ADD COLUMN label_artist_id uuid REFERENCES public.label_artists(id) ON DELETE SET NULL;

-- ── Atomic pool mutation ──
CREATE OR REPLACE FUNCTION public.label_hours_apply(
  p_label_id uuid,
  p_hours numeric,
  p_type text,
  p_artist_id uuid DEFAULT NULL,
  p_booking_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL
) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance numeric;
BEGIN
  SELECT hours_balance INTO v_balance
  FROM public.labels WHERE id = p_label_id FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'label not found: %', p_label_id;
  END IF;

  IF v_balance + p_hours < 0 THEN
    RAISE EXCEPTION 'insufficient label hours: have %, need %', v_balance, -p_hours;
  END IF;

  INSERT INTO public.label_hour_transactions (label_id, hours, type, artist_id, booking_id, note)
  VALUES (p_label_id, p_hours, p_type, p_artist_id, p_booking_id, p_note);

  UPDATE public.labels
  SET hours_balance = v_balance + p_hours, updated_at = now()
  WHERE id = p_label_id;

  RETURN v_balance + p_hours;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.label_hours_apply FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.label_hours_apply TO service_role;

-- Helper: is this user the manager of the label?
CREATE OR REPLACE FUNCTION public.is_label_manager(_user_id uuid, _label_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.labels WHERE id = _label_id AND manager_user_id = _user_id);
$$;

-- ── RLS ──
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.label_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.label_hour_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.label_invoices ENABLE ROW LEVEL SECURITY;

-- Labels: manager sees own, admins manage all
CREATE POLICY "Manager views own label" ON public.labels FOR SELECT TO authenticated
  USING (manager_user_id = auth.uid());
CREATE POLICY "Admins manage labels" ON public.labels FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Artists: manager manages own label's artists, admins all
CREATE POLICY "Manager manages own artists" ON public.label_artists FOR ALL TO authenticated
  USING (public.is_label_manager(auth.uid(), label_id))
  WITH CHECK (public.is_label_manager(auth.uid(), label_id));
CREATE POLICY "Admins manage artists" ON public.label_artists FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Ledger + invoices: read for manager/admin; writes go through service role
CREATE POLICY "Manager views own ledger" ON public.label_hour_transactions FOR SELECT TO authenticated
  USING (public.is_label_manager(auth.uid(), label_id));
CREATE POLICY "Admins view ledger" ON public.label_hour_transactions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Manager views own invoices" ON public.label_invoices FOR SELECT TO authenticated
  USING (public.is_label_manager(auth.uid(), label_id));
CREATE POLICY "Admins view invoices" ON public.label_invoices FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Private storage bucket for invoice PDFs (access via signed URLs / service role)
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins read invoices bucket" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'invoices' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));
