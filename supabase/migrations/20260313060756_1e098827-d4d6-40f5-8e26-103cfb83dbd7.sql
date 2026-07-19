
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS membership text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS broedplaats text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS studio_hours integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS content_hours integer NOT NULL DEFAULT 0;
