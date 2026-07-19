
-- Locations for org sessions
CREATE TABLE public.org_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.org_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage org_locations" ON public.org_locations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Anyone authenticated can read org_locations" ON public.org_locations
  FOR SELECT TO authenticated USING (true);

-- Team members for org sessions
CREATE TABLE public.org_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  role text DEFAULT 'member',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.org_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage org_team_members" ON public.org_team_members
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Anyone authenticated can read org_team_members" ON public.org_team_members
  FOR SELECT TO authenticated USING (true);

-- Org sessions (projects & workshops)
CREATE TABLE public.org_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  session_type text NOT NULL DEFAULT 'project', -- 'project' or 'workshop'
  session_date date NOT NULL,
  start_time text NOT NULL DEFAULT '10:00',
  end_time text NOT NULL DEFAULT '12:00',
  location_id uuid REFERENCES public.org_locations(id) ON DELETE SET NULL,
  team_member_id uuid REFERENCES public.org_team_members(id) ON DELETE SET NULL,
  description text,
  status text NOT NULL DEFAULT 'planned', -- planned, completed, cancelled
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.org_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage org_sessions" ON public.org_sessions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- Session reports
CREATE TABLE public.org_session_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.org_sessions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'completed', -- completed, cancelled
  participant_count integer DEFAULT 0,
  notes text,
  file_urls text[] DEFAULT '{}',
  reported_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.org_session_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage org_session_reports" ON public.org_session_reports
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
