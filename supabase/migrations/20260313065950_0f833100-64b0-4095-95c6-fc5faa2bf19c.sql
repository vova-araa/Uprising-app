
CREATE TABLE public.broedplaats_workshops (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL DEFAULT 'Workshop',
  description text,
  learning_module text,
  workshop_date date NOT NULL,
  start_time text NOT NULL DEFAULT '14:00',
  end_time text NOT NULL DEFAULT '17:00',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.broedplaats_workshops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read workshops"
  ON public.broedplaats_workshops FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage workshops"
  ON public.broedplaats_workshops FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));
