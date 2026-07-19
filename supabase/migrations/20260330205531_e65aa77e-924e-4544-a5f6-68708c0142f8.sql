ALTER TABLE public.org_trajecten ADD COLUMN location_id UUID REFERENCES public.org_locations(id);
ALTER TABLE public.org_schools ADD COLUMN location_id UUID REFERENCES public.org_locations(id);