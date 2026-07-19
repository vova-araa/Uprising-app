-- Allow unauthenticated (anon) users to read app_config so the app works without login
CREATE POLICY "Anyone can read config"
ON public.app_config
FOR SELECT
TO anon
USING (true);

-- Also allow anon to read broedplaats_config
CREATE POLICY "Anyone can read broedplaats config"
ON public.broedplaats_config
FOR SELECT
TO anon
USING (true);

-- Also allow anon to read broedplaats_workshops
CREATE POLICY "Anyone can read workshops"
ON public.broedplaats_workshops
FOR SELECT
TO anon
USING (true);