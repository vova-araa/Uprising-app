
CREATE TABLE public.org_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  traject_id uuid REFERENCES public.org_trajecten(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  city text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage org_participants"
  ON public.org_participants FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
