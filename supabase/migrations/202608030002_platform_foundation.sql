-- Merchant-installable AI Sales Agent platform foundation.
-- The demo catalog remains a development provider; Salla and Zid are first-class future providers.

alter table public.merchants
  add column if not exists public_key text,
  add column if not exists allowed_widget_origins jsonb not null default '[]'::jsonb;

update public.merchants
set public_key = 'merchant_' || replace(id::text, '-', '')
where public_key is null or btrim(public_key) = '';

alter table public.merchants
  alter column public_key set default ('merchant_' || replace(gen_random_uuid()::text, '-', '')),
  alter column public_key set not null;

create unique index if not exists idx_merchants_public_key on public.merchants(public_key);

alter table public.platform_integrations
  add column if not exists external_store_id text,
  add column if not exists last_synced_at timestamptz,
  add column if not exists provider_config jsonb not null default '{}'::jsonb;

alter table public.sync_jobs
  add column if not exists provider text,
  add column if not exists job_type text not null default 'catalog_sync',
  add column if not exists cursor text,
  add column if not exists records_processed integer not null default 0;

update public.sync_jobs as job
set provider = integration.provider
from public.platform_integrations as integration
where job.integration_id = integration.id and job.provider is null;

update public.sync_jobs set provider = 'demo' where provider is null;

alter table public.sync_jobs
  alter column provider set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sync_jobs_provider_check'
  ) then
    alter table public.sync_jobs
      add constraint sync_jobs_provider_check check (provider in ('demo', 'salla', 'zid'));
  end if;
end $$;

alter table public.webhook_events
  add column if not exists provider text,
  add column if not exists external_event_id text,
  add column if not exists headers_json jsonb not null default '{}'::jsonb;

update public.webhook_events as event
set provider = integration.provider
from public.platform_integrations as integration
where event.integration_id = integration.id and event.provider is null;

update public.webhook_events set provider = 'demo' where provider is null;

alter table public.webhook_events
  alter column provider set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'webhook_events_provider_check'
  ) then
    alter table public.webhook_events
      add constraint webhook_events_provider_check check (provider in ('demo', 'salla', 'zid'));
  end if;
end $$;

create table if not exists public.oauth_states (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  integration_id uuid references public.platform_integrations(id) on delete cascade,
  provider text not null check (provider in ('salla', 'zid')),
  state_hash text not null unique,
  redirect_path text not null default '/dashboard/integrations',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_products_merchant_platform_external on public.products(merchant_id, platform, external_id);
create index if not exists idx_integrations_external_store on public.platform_integrations(provider, external_store_id);
create index if not exists idx_sync_jobs_merchant_created on public.sync_jobs(merchant_id, created_at desc);
create index if not exists idx_webhook_events_provider_external on public.webhook_events(provider, external_event_id);
create index if not exists idx_oauth_states_expiry on public.oauth_states(expires_at);

alter table public.oauth_states enable row level security;

drop policy if exists oauth_state_owner_admin_read on public.oauth_states;
create policy oauth_state_owner_admin_read on public.oauth_states for select to authenticated
using (public.has_merchant_role(merchant_id, array['owner','admin']));

do $$
declare
  table_name text;
begin
  foreach table_name in array array['platform_integrations','sync_jobs'] loop
    execute format('drop policy if exists integration_admin_write on public.%I', table_name);
    execute format(
      'create policy integration_admin_write on public.%I for all to authenticated using (public.has_merchant_role(merchant_id, array[''owner'',''admin''])) with check (public.has_merchant_role(merchant_id, array[''owner'',''admin'']))',
      table_name
    );
  end loop;
end $$;

grant select, insert, update, delete on public.platform_integrations, public.sync_jobs to authenticated;
grant select on public.oauth_states to authenticated;

