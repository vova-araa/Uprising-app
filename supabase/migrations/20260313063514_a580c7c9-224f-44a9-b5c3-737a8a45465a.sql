
CREATE TABLE public.broedplaats_rsvp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  slot_type text NOT NULL, -- 'day1', 'day2', 'workshop'
  activity text, -- 'studio', 'content', 'clothing' (null for workshop)
  confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, slot_type)
);

ALTER TABLE public.broedplaats_rsvp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rsvp" ON public.broedplaats_rsvp
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rsvp" ON public.broedplaats_rsvp
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rsvp" ON public.broedplaats_rsvp
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own rsvp" ON public.broedplaats_rsvp
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all rsvp" ON public.broedplaats_rsvp
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
