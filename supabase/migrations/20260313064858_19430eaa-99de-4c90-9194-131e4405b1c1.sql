
CREATE TABLE public.broedplaats_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key text NOT NULL UNIQUE,
  config_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.broedplaats_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read config"
  ON public.broedplaats_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage config"
  ON public.broedplaats_config FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Seed default config
INSERT INTO public.broedplaats_config (config_key, config_value) VALUES
  ('weekly_days', '{"day1": {"label": "Dinsdag", "weekday": 2}, "day2": {"label": "Donderdag", "weekday": 4}}'::jsonb),
  ('workshop', '{"title": "Maandelijkse Workshop", "description": "Creatieve workshop voor alle leden", "date": null}'::jsonb);
