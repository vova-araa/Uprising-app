CREATE TABLE public.org_workshop_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.broedplaats_workshops(id) ON DELETE CASCADE,
  item text NOT NULL,
  checked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.org_workshop_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage org_workshop_checklist" ON public.org_workshop_checklist
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE TABLE public.org_workshop_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.broedplaats_workshops(id) ON DELETE CASCADE,
  reported_by uuid NOT NULL,
  notes text,
  participant_count integer DEFAULT 0,
  file_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.org_workshop_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage org_workshop_reports" ON public.org_workshop_reports
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- Add draaiboek_url to workshops
ALTER TABLE public.broedplaats_workshops ADD COLUMN IF NOT EXISTS draaiboek_url text DEFAULT NULL;