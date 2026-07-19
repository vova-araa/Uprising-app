UPDATE public.app_config
SET config_value = jsonb_set(
  config_value,
  '{0,id}',
  '"broedplaats-students"'
),
updated_at = now()
WHERE config_key = 'broedplaats_plans'
  AND config_value->0->>'id' = 'scholieren';