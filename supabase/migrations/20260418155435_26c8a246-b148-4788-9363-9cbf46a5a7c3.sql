
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL CHECK (platform IN ('web', 'ios', 'android')),
  endpoint text,
  p256dh text,
  auth text,
  fcm_token text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_unique
  ON public.push_subscriptions (endpoint) WHERE endpoint IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_fcm_unique
  ON public.push_subscriptions (fcm_token) WHERE fcm_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push subs" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subs"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all push subs" ON public.push_subscriptions;
CREATE POLICY "Admins read all push subs"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE OR REPLACE FUNCTION public.notify_admins_on_new_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id uuid;
  customer_name text;
  studio_label text;
BEGIN
  SELECT COALESCE(full_name, email, 'Onbekend') INTO customer_name
    FROM public.profiles WHERE id = NEW.user_id;

  studio_label := CASE NEW.studio_id
    WHEN 'studio-1' THEN 'Studio 1'
    WHEN 'studio-2' THEN 'Studio 2'
    WHEN 'content-room' THEN 'Content Room'
    ELSE NEW.studio_id
  END;

  FOR admin_id IN
    SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'staff')
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      admin_id,
      '🎙️ Nieuwe boeking: ' || studio_label,
      customer_name || ' • ' || to_char(NEW.booking_date, 'DD-MM') || ' ' || NEW.start_time || ' (' || NEW.duration_hours || 'u)',
      'info',
      '/planning'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_new_booking ON public.bookings;
CREATE TRIGGER trg_notify_admins_new_booking
  AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_new_booking();

CREATE OR REPLACE FUNCTION public.notify_admins_on_new_producer_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id uuid;
  customer_name text;
BEGIN
  SELECT COALESCE(full_name, email, 'Onbekend') INTO customer_name
    FROM public.profiles WHERE id = NEW.user_id;

  FOR admin_id IN
    SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'staff')
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      admin_id,
      '🎛️ Nieuwe producer-aanvraag',
      customer_name || ' • ' || to_char(NEW.preferred_date, 'DD-MM') || ' ' || NEW.preferred_time,
      'info',
      '/admin'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_new_producer_booking ON public.producer_bookings;
CREATE TRIGGER trg_notify_admins_new_producer_booking
  AFTER INSERT ON public.producer_bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_new_producer_booking();

CREATE OR REPLACE FUNCTION public.notify_user_on_booking_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  studio_label text;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'confirmed')
     OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'confirmed') THEN

    studio_label := CASE NEW.studio_id
      WHEN 'studio-1' THEN 'Studio 1'
      WHEN 'studio-2' THEN 'Studio 2'
      WHEN 'content-room' THEN 'Content Room'
      ELSE NEW.studio_id
    END;

    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.user_id,
      '✅ Boeking bevestigd',
      studio_label || ' op ' || to_char(NEW.booking_date, 'DD-MM-YYYY') || ' om ' || NEW.start_time,
      'success',
      '/account'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_user_booking_confirmed ON public.bookings;
CREATE TRIGGER trg_notify_user_booking_confirmed
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_user_on_booking_confirmed();
