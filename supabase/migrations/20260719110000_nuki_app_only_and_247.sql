-- Correction: Uprising's Nuki setup is app-based only — one lock on the front
-- door that opens automatically after an in-app unlock. There are no keypads,
-- so the keypad-code columns go away again.

ALTER TABLE public.booking_access
  DROP COLUMN IF EXISTS keypad_code,
  DROP COLUMN IF EXISTS auths_cleaned;

-- Enable off-peak pricing: 30% off weekday hours starting before 17:00
-- (confirmed choice). Managed via app_config so it stays tweakable.
INSERT INTO public.app_config (config_key, config_value, category, description, is_active)
VALUES (
  'offpeak_pricing',
  '{"enabled": true, "discount_pct": 30, "weekday_end_hour": 17}'::jsonb,
  'pricing',
  'Daluren-korting: percentage korting op weekdag-uren die starten vóór weekday_end_hour',
  true
)
ON CONFLICT (config_key) DO UPDATE
  SET config_value = EXCLUDED.config_value, is_active = true, updated_at = now();
