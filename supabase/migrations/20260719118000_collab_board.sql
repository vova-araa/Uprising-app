-- Collab board: artists post what they're looking for (vocalist, producer,
-- beat, engineer, ...) and others respond. Community feature that matches the
-- Uprising / The Culture hub.

CREATE TABLE public.collab_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  looking_for text[] NOT NULL DEFAULT '{}',   -- e.g. {vocalist, producer}
  genre text,
  contact_info text,                            -- voluntary handle / how to reach
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX collab_posts_status_idx ON public.collab_posts (status, created_at DESC);
CREATE INDEX collab_posts_user_idx ON public.collab_posts (user_id);

ALTER TABLE public.collab_posts ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can browse open posts; owners see their own always.
CREATE POLICY "Authenticated read open collab posts"
  ON public.collab_posts FOR SELECT TO authenticated
  USING (status = 'open' OR user_id = auth.uid());

CREATE POLICY "Users create own collab posts"
  ON public.collab_posts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own collab posts"
  ON public.collab_posts FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users delete own collab posts"
  ON public.collab_posts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins manage collab posts"
  ON public.collab_posts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));
