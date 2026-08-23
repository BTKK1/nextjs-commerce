-- Make the per-merchant token wallet allowance explicit for existing stores.
-- Token consumption remains derived from immutable assistant message telemetry.
update public.dashboard_settings
set dashboard_preferences = jsonb_set(
  coalesce(dashboard_preferences, '{}'::jsonb),
  '{monthly_token_allowance}',
  coalesce(dashboard_preferences -> 'monthly_token_allowance', '1000000'::jsonb),
  true
)
where not (coalesce(dashboard_preferences, '{}'::jsonb) ? 'monthly_token_allowance');
