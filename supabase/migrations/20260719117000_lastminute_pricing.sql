-- Enable last-minute deals: 25% off slots starting within 6 hours today, to
-- fill otherwise-empty hours. Tunable via this app_config row.
INSERT INTO public.app_config (config_key, config_value, category, description, is_active)
VALUES (
  'lastminute_pricing',
  '{"enabled": true, "discount_pct": 25, "within_hours": 6}'::jsonb,
  'pricing',
  'Last-minute korting op slots die vandaag binnen within_hours starten',
  true
)
ON CONFLICT (config_key) DO UPDATE
  SET config_value = EXCLUDED.config_value, is_active = true, updated_at = now();
