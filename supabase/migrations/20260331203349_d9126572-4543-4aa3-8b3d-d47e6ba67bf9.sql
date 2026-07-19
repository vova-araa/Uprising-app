
-- Create org_workshops table
CREATE TABLE public.org_workshops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  total_lessons INTEGER NOT NULL DEFAULT 6,
  class_name TEXT,
  class_size INTEGER DEFAULT 0,
  team_member_id UUID REFERENCES public.org_team_members(id),
  location_id UUID REFERENCES public.org_locations(id),
  school_id UUID REFERENCES public.org_schools(id),
  last_lesson_at_studio BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add org_workshop_id to org_sessions
ALTER TABLE public.org_sessions ADD COLUMN org_workshop_id UUID REFERENCES public.org_workshops(id);

-- Add guest_teacher field to org_sessions
ALTER TABLE public.org_sessions ADD COLUMN guest_teacher TEXT;

-- RLS for org_workshops
ALTER TABLE public.org_workshops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage org_workshops"
  ON public.org_workshops
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- Create org_workshop_reports table for workshop session reports
CREATE TABLE public.org_workshop_session_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.org_sessions(id) ON DELETE CASCADE,
  org_workshop_id UUID NOT NULL REFERENCES public.org_workshops(id) ON DELETE CASCADE,
  notes TEXT,
  participant_count INTEGER DEFAULT 0,
  file_urls TEXT[] DEFAULT '{}',
  reported_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.org_workshop_session_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage org_workshop_session_reports"
  ON public.org_workshop_session_reports
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
