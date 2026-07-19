-- Labels can have multiple managers. label_managers is the source of truth;
-- labels.manager_user_id is kept as an optional "primary" for backward compat.

CREATE TABLE public.label_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label_id uuid NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (label_id, user_id)
);

CREATE INDEX label_managers_user_idx ON public.label_managers (user_id);
CREATE INDEX label_managers_label_idx ON public.label_managers (label_id);

-- Backfill existing single managers
INSERT INTO public.label_managers (label_id, user_id)
SELECT id, manager_user_id FROM public.labels
WHERE manager_user_id IS NOT NULL
ON CONFLICT (label_id, user_id) DO NOTHING;

-- Manager check now spans the join table (plus the legacy column)
CREATE OR REPLACE FUNCTION public.is_label_manager(_user_id uuid, _label_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.label_managers WHERE label_id = _label_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.labels WHERE id = _label_id AND manager_user_id = _user_id
  );
$$;

ALTER TABLE public.label_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User views own manager rows" ON public.label_managers FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins manage label managers" ON public.label_managers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Update the labels SELECT policy so any manager (not just the primary) can
-- read their label.
DROP POLICY IF EXISTS "Manager views own label" ON public.labels;
CREATE POLICY "Managers view own label" ON public.labels FOR SELECT TO authenticated
  USING (public.is_label_manager(auth.uid(), id));
