
-- Schools table for workshop partners
CREATE TABLE public.org_schools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.org_schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage org_schools"
  ON public.org_schools FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Anyone authenticated can read org_schools"
  ON public.org_schools FOR SELECT TO authenticated
  USING (true);

-- Trajecten (programs/tracks) table
CREATE TABLE public.org_trajecten (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  school_id UUID REFERENCES public.org_schools(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  participant_count INTEGER DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.org_trajecten ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage org_trajecten"
  ON public.org_trajecten FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- Add school_id to org_sessions so sessions can be linked to a traject
ALTER TABLE public.org_sessions ADD COLUMN traject_id UUID REFERENCES public.org_trajecten(id) ON DELETE SET NULL;
