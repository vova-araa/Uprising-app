-- Attendance tracking
CREATE TABLE public.org_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.org_participants(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.org_sessions(id) ON DELETE CASCADE,
  present boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(participant_id, session_id)
);

ALTER TABLE public.org_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage org_attendance" ON public.org_attendance
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- Session checklist items
CREATE TABLE public.org_session_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.org_sessions(id) ON DELETE CASCADE,
  item text NOT NULL,
  checked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_session_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage org_session_checklist" ON public.org_session_checklist
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- Add columns to org_trajecten
ALTER TABLE public.org_trajecten ADD COLUMN IF NOT EXISTS total_budget numeric DEFAULT 0;
ALTER TABLE public.org_trajecten ADD COLUMN IF NOT EXISTS spent_budget numeric DEFAULT 0;
ALTER TABLE public.org_trajecten ADD COLUMN IF NOT EXISTS traject_type text DEFAULT 'general';

-- Add draaiboek_url to org_sessions
ALTER TABLE public.org_sessions ADD COLUMN IF NOT EXISTS draaiboek_url text DEFAULT NULL;