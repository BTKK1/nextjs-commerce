-- Keep the Founder demo usable throughout the 100-merchant beta without
-- changing the default allowance for ordinary merchants.
update public.dashboard_settings
set dashboard_preferences = jsonb_set(
  coalesce(dashboard_preferences, '{}'::jsonb),
  '{monthly_token_allowance}',
  '10000000'::jsonb,
  true
)
where merchant_id = '83da73d3-32d4-4f3f-a2db-4bd2ea9f4781'::uuid
  and coalesce(nullif(dashboard_preferences ->> 'monthly_token_allowance', '')::bigint, 0) < 10000000;
