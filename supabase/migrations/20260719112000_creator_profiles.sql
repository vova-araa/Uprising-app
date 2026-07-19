-- Creator profiles: the content-coach intake. The AI coach builds on this —
-- who the artist is, where they are in the process, what they've achieved —
-- and helps producers/artists with little reach grow through content.

CREATE TABLE public.creator_profiles (
  user_id uuid PRIMARY KEY,
  artist_name text,
  genre text,
  goals text,                                  -- e.g. "eerste EP uitbrengen, 1000 volgers"
  socials jsonb NOT NULL DEFAULT '{}',         -- { instagram, tiktok, spotify, youtube }
  followers_total integer,
  releases text,                               -- what's out already
  process_stage text NOT NULL DEFAULT 'idee'
    CHECK (process_stage IN ('idee', 'opnemen', 'mixen', 'release', 'promo')),
  reference_artists text,                      -- moodboard / sound references
  release_plan jsonb NOT NULL DEFAULT '[]',    -- [{ title, date, type }]
  weekly_content_goal integer,                 -- posts per week
  weekly_reminder boolean NOT NULL DEFAULT true,
  milestones jsonb NOT NULL DEFAULT '[]',      -- [{ text, achieved_at }]
  last_weekly_reminder_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own creator profile"
  ON public.creator_profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view creator profiles"
  ON public.creator_profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));
