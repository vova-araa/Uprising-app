-- Content Coach upgrade: deeper intake, automatic weekly content plans with
-- done-tracking, coach check-ins, and admin-run intake.

-- Deeper intake fields the AI coach reasons over
ALTER TABLE public.creator_profiles
  ADD COLUMN brand_description text,        -- what the artist stands for / their story
  ADD COLUMN target_audience text,         -- who they want to reach
  ADD COLUMN time_budget text,             -- how much time/week for content
  ADD COLUMN money_budget text,            -- budget for ads/promo
  ADD COLUMN camera_comfort text,          -- comfort on camera + strengths
  ADD COLUMN strengths text,               -- what they're already good at
  ADD COLUMN struggles text,               -- what they find hard
  ADD COLUMN posting_platforms text[],     -- where they post most
  ADD COLUMN intake_by text NOT NULL DEFAULT 'self'  -- 'self' or 'team'
    CHECK (intake_by IN ('self', 'team')),
  ADD COLUMN intake_completed_at timestamptz,
  ADD COLUMN coach_notes text;             -- private team notes about the artist

-- Admins/staff can run and edit the intake for a member (the team wants to
-- know the process from day one).
CREATE POLICY "Admins manage creator profiles"
  ON public.creator_profiles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Weekly content plans: the coach generates a concrete plan and the artist
-- ticks items off. week_start is the Monday of that week.
CREATE TABLE public.content_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL, -- set for session-linked plans
  title text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',   -- [{ id, day, format, idea, caption, hashtags, done }]
  source text NOT NULL DEFAULT 'weekly' CHECK (source IN ('weekly', 'session', 'manual')),
  generated_by text NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX content_plans_user_idx ON public.content_plans (user_id, week_start DESC);
CREATE UNIQUE INDEX content_plans_user_week_weekly_idx
  ON public.content_plans (user_id, week_start) WHERE source = 'weekly';

ALTER TABLE public.content_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own content plans"
  ON public.content_plans FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view content plans"
  ON public.content_plans FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Coach check-ins: lightweight follow-up log ("did you post? how did it go?")
-- that the coach reads back so advice adapts to what actually works.
CREATE TABLE public.coach_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content_plan_id uuid REFERENCES public.content_plans(id) ON DELETE SET NULL,
  posted boolean,
  reflection text,               -- free text: what worked / what didn't
  reach_note text,               -- optional: views/likes they got
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX coach_checkins_user_idx ON public.coach_checkins (user_id, created_at DESC);

ALTER TABLE public.coach_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own checkins"
  ON public.coach_checkins FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view checkins"
  ON public.coach_checkins FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));
