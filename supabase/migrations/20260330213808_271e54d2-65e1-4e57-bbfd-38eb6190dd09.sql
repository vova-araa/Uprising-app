
ALTER TABLE public.org_trajecten ADD COLUMN team_member_id uuid REFERENCES public.org_team_members(id) ON DELETE SET NULL;
