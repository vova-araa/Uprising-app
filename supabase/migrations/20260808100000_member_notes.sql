-- Member → team notes. A place on the dashboard for members to leave a remark
-- for the admins/beheerders. Members see their own; admins/staff see all and can
-- mark them resolved. A trigger pings the team so nothing is missed.

CREATE TABLE IF NOT EXISTS public.member_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',   -- 'open' | 'resolved'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.member_notes ENABLE ROW LEVEL SECURITY;

-- Members: insert and read their own notes.
CREATE POLICY "member_notes own insert" ON public.member_notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "member_notes own select" ON public.member_notes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Admin/staff: read every note and update its status.
CREATE POLICY "member_notes admin select" ON public.member_notes
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
CREATE POLICY "member_notes admin update" ON public.member_notes
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- Notify the team on a new note (SECURITY DEFINER so it can write notifications
-- for the admin users regardless of the sender's RLS).
CREATE OR REPLACE FUNCTION public.notify_team_of_member_note()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
BEGIN
  SELECT COALESCE(full_name, email, 'Een lid') INTO v_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT ur.user_id,
         '💬 Nieuw bericht van een lid',
         v_name || ': ' || left(NEW.message, 140),
         'info',
         '/admin?tab=notes'
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'staff');
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_team_of_member_note ON public.member_notes;
CREATE TRIGGER trg_notify_team_of_member_note
  AFTER INSERT ON public.member_notes
  FOR EACH ROW EXECUTE FUNCTION public.notify_team_of_member_note();
