ALTER TABLE public.org_participants ADD COLUMN IF NOT EXISTS address text DEFAULT NULL;
ALTER TABLE public.org_participants ADD COLUMN IF NOT EXISTS guardian_phone text DEFAULT NULL;