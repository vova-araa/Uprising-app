
CREATE TABLE public.org_ambassadors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_ambassadors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage org_ambassadors"
  ON public.org_ambassadors FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Anyone authenticated can read org_ambassadors"
  ON public.org_ambassadors FOR SELECT TO authenticated
  USING (true);
