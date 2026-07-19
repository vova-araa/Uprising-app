CREATE TABLE public.org_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  deadline date,
  assigned_to uuid REFERENCES public.org_team_members(id) ON DELETE SET NULL,
  traject_id uuid REFERENCES public.org_trajecten(id) ON DELETE CASCADE,
  workshop_id uuid REFERENCES public.broedplaats_workshops(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage org_tasks" ON public.org_tasks
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));