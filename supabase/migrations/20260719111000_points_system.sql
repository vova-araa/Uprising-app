-- Uprising Points: earn points for things that help the studio (session
-- videos for socials, leaving the room clean, feedback, referrals) and spend
-- them in a rewards shop (wallet credit, free studio hours).

ALTER TABLE public.profiles
  ADD COLUMN points_balance integer NOT NULL DEFAULT 0;

CREATE TABLE public.points_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  points integer NOT NULL, -- positive = earned, negative = spent
  type text NOT NULL CHECK (type IN (
    'video_upload',   -- approved session video
    'clean_room',     -- approved clean-room photo
    'feedback',       -- session feedback submitted
    'referral',       -- brought a friend
    'redeem',         -- spent in the rewards shop
    'admin_adjust'    -- manual correction
  )),
  reference_id uuid,  -- submission / booking / referral id
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX points_transactions_user_idx ON public.points_transactions (user_id, created_at DESC);

ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own points transactions"
  ON public.points_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all points transactions"
  ON public.points_transactions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Atomic points mutation, mirroring wallet_apply
CREATE OR REPLACE FUNCTION public.points_apply(
  p_user_id uuid,
  p_points integer,
  p_type text,
  p_reference_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance integer;
BEGIN
  SELECT points_balance INTO v_balance
  FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'profile not found for user %', p_user_id;
  END IF;

  IF v_balance + p_points < 0 THEN
    RAISE EXCEPTION 'insufficient points: have %, need %', v_balance, -p_points;
  END IF;

  INSERT INTO public.points_transactions (user_id, points, type, reference_id, note)
  VALUES (p_user_id, p_points, p_type, p_reference_id, p_note);

  UPDATE public.profiles
  SET points_balance = v_balance + p_points, updated_at = now()
  WHERE id = p_user_id;

  RETURN v_balance + p_points;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.points_apply FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.points_apply TO service_role;

-- Feedback after a session earns points automatically (booking_feedback is
-- unique per booking, so this can't be farmed).
CREATE OR REPLACE FUNCTION public.award_feedback_points()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.points_apply(NEW.user_id, 10, 'feedback', NEW.booking_id, 'Feedback na sessie');
  RETURN NEW;
END;
$$;

CREATE TRIGGER booking_feedback_points
  AFTER INSERT ON public.booking_feedback
  FOR EACH ROW EXECUTE FUNCTION public.award_feedback_points();

-- Media submissions: session videos & clean-room photos, reviewed by admins
-- before points are awarded and content may be used for Uprising's socials.
CREATE TABLE public.media_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('session_video', 'clean_room_photo')),
  storage_path text NOT NULL,
  consent boolean NOT NULL DEFAULT false, -- permission to use for socials
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  points_awarded integer NOT NULL DEFAULT 0,
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX media_submissions_status_idx ON public.media_submissions (status, created_at DESC);

ALTER TABLE public.media_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own submissions"
  ON public.media_submissions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own submissions"
  ON public.media_submissions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all submissions"
  ON public.media_submissions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Review (status/points changes) goes through the review-submission edge
-- function with the service role, so no UPDATE policy for users or admins.
