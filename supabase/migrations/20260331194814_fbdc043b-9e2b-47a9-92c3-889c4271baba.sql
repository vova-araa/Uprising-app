ALTER TABLE public.org_participants 
  ALTER COLUMN traject_id DROP NOT NULL,
  ADD COLUMN workshop_id UUID REFERENCES public.broedplaats_workshops(id) ON DELETE CASCADE;

-- Add constraint: must have either traject_id or workshop_id
ALTER TABLE public.org_participants 
  ADD CONSTRAINT org_participants_has_parent 
  CHECK (traject_id IS NOT NULL OR workshop_id IS NOT NULL);