-- Maison Vert merchant dashboard foundation.
-- This migration preserves the earlier text-key demo tables by renaming them
-- when detected. The new production tables use UUID ownership and RLS.

create extension if not exists pgcrypto;

do $$
declare
  legacy_table text;
  legacy_tables text[] := array[
    'insight_sources', 'messages', 'insights', 'conversations', 'visitors',
    'dashboard_settings', 'guardrails', 'audit_logs', 'platform_integrations',
    'sync_jobs', 'webhook_events', 'config_versions', 'analytics_events',
    'agent_actions', 'agent_evaluations', 'products', 'merchants'
  ];
begin
  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'merchants'
      and c.column_name = 'id' and c.data_type <> 'uuid'
  ) then
    foreach legacy_table in array legacy_tables loop
      if to_regclass('public.' || legacy_table) is not null
         and to_regclass('public.legacy_' || legacy_table || '_20260803') is null then
        execute format('alter table public.%I rename to %I', legacy_table, 'legacy_' || legacy_table || '_20260803');
      end if;
    end loop;
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.merchants (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  display_name text,
  email text,
  phone text,
  platform_type text not null default 'demo' check (platform_type in ('demo', 'salla', 'zid', 'multi')),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.merchant_users (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'advanced_admin', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, user_id)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  external_id text,
  platform text not null default 'demo' check (platform in ('demo', 'salla', 'zid')),
  slug text not null,
  name text not null,
  arabic_name text,
  description text,
  short_description text,
  price numeric,
  compare_at_price numeric,
  currency text not null default 'SAR',
  image_url text,
  category text,
  availability text,
  inventory_count integer,
  variants jsonb not null default '[]'::jsonb,
  attributes jsonb not null default '{}'::jsonb,
  faqs jsonb not null default '[]'::jsonb,
  sales_guidance jsonb not null default '{}'::jsonb,
  raw_platform_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, platform, slug)
);

create table if not exists public.visitors (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  anonymous_ref text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata_json jsonb not null default '{}'::jsonb,
  unique (merchant_id, anonymous_ref)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  visitor_id uuid references public.visitors(id) on delete set null,
  status text not null default 'open',
  language text,
  channel text not null default 'product_page_widget',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  sender_type text not null check (sender_type in ('visitor', 'assistant', 'system', 'evaluator')),
  content text not null,
  language text,
  model text,
  provider text,
  token_usage jsonb not null default '{}'::jsonb,
  latency_ms integer,
  safety_flags jsonb not null default '{}'::jsonb,
  fallback_reason text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  insight_type text not null check (insight_type in ('repeated_question', 'objection', 'weak_description', 'unknown_answer', 'answer_quality', 'product_content_gap', 'prompt_issue')),
  title text not null,
  content text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  frequency integer not null default 1,
  status text not null default 'open' check (status in ('open', 'reviewed', 'resolved', 'ignored')),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.insight_sources (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  insight_id uuid not null references public.insights(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.dashboard_settings (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null unique references public.merchants(id) on delete cascade,
  theme_config jsonb not null default '{}'::jsonb,
  date_filter jsonb not null default '{}'::jsonb,
  refresh_interval text not null default 'manual',
  dashboard_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_configs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  model_provider text not null default 'openrouter',
  model_name text not null,
  temperature numeric not null default 0.25 check (temperature >= 0 and temperature <= 1),
  max_tokens integer not null default 420 check (max_tokens between 64 and 2000),
  response_language_policy text not null default 'match_shopper',
  tone_preset text not null default 'neutral_saudi',
  system_prompt text not null,
  developer_prompt text,
  product_context_policy jsonb not null default '{}'::jsonb,
  fallback_policy jsonb not null default '{}'::jsonb,
  safety_policy jsonb not null default '{}'::jsonb,
  objection_policy jsonb not null default '{}'::jsonb,
  advanced_settings jsonb not null default '{}'::jsonb,
  active_version_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, name)
);

create table if not exists public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  agent_config_id uuid not null references public.agent_configs(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  version_number integer not null,
  title text,
  system_prompt text not null,
  developer_prompt text,
  change_note text,
  test_result jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'tested', 'published', 'archived', 'rollback')),
  created_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (agent_config_id, version_number)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'agent_configs_active_version_fk') then
    alter table public.agent_configs
      add constraint agent_configs_active_version_fk
      foreign key (active_version_id) references public.prompt_versions(id) on delete set null;
  end if;
end $$;

create table if not exists public.guardrails (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  agent_config_id uuid references public.agent_configs(id) on delete cascade,
  allowed_topics jsonb not null default '[]'::jsonb,
  blocked_topics jsonb not null default '[]'::jsonb,
  blocked_claims jsonb not null default '[]'::jsonb,
  fallback_response_ar text,
  fallback_response_en text,
  confidence_threshold numeric not null default 0.55,
  on_violation text not null default 'fallback' check (on_violation in ('refuse', 'fallback', 'escalate')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_integrations (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  provider text not null check (provider in ('demo', 'salla', 'zid')),
  status text not null check (status in ('connected', 'not_connected', 'pending', 'disabled', 'error')),
  encrypted_credential_ref text,
  scopes jsonb not null default '[]'::jsonb,
  connected_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, provider)
);

create table if not exists public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  integration_id uuid references public.platform_integrations(id) on delete set null,
  resource text,
  status text not null check (status in ('pending', 'running', 'success', 'failed')),
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  integration_id uuid references public.platform_integrations(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received' check (status in ('received', 'processed', 'failed', 'ignored')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null check (actor_type in ('user', 'system', 'agent', 'webhook')),
  action text not null,
  entity_type text,
  entity_id uuid,
  before_json jsonb,
  after_json jsonb,
  details_json jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.qa_runs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  agent_config_id uuid not null references public.agent_configs(id) on delete cascade,
  prompt_version_id uuid references public.prompt_versions(id) on delete set null,
  status text not null,
  total_conversations integer not null default 0,
  total_messages integer not null default 0,
  average_score numeric,
  hard_failures integer not null default 0,
  report_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.qa_cases (
  id uuid primary key default gen_random_uuid(),
  qa_run_id uuid not null references public.qa_runs(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  language text,
  scenario text,
  user_messages jsonb not null default '[]'::jsonb,
  assistant_messages jsonb not null default '[]'::jsonb,
  score numeric,
  hard_failures jsonb not null default '[]'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  visitor_id uuid references public.visitors(id) on delete set null,
  event_type text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_dashboard_products_merchant on public.products(merchant_id);
create index if not exists idx_dashboard_products_slug on public.products(slug);
create index if not exists idx_dashboard_conversations_merchant on public.conversations(merchant_id);
create index if not exists idx_dashboard_conversations_product on public.conversations(product_id);
create index if not exists idx_dashboard_conversations_visitor on public.conversations(visitor_id);
create index if not exists idx_dashboard_messages_conversation on public.messages(conversation_id);
create index if not exists idx_dashboard_messages_merchant on public.messages(merchant_id);
create index if not exists idx_dashboard_insights_merchant on public.insights(merchant_id);
create index if not exists idx_dashboard_insights_product on public.insights(product_id);
create index if not exists idx_dashboard_insights_type on public.insights(insight_type);
create index if not exists idx_dashboard_prompt_versions_config on public.prompt_versions(agent_config_id);
create index if not exists idx_dashboard_audit_merchant_created on public.audit_logs(merchant_id, created_at desc);
create index if not exists idx_dashboard_qa_cases_run on public.qa_cases(qa_run_id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'merchants','merchant_users','products','visitors','conversations','messages','insights',
    'insight_sources','dashboard_settings','agent_configs','prompt_versions','guardrails',
    'platform_integrations','sync_jobs','webhook_events','audit_logs','qa_runs','qa_cases','analytics_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create or replace function public.current_user_merchant_ids()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select merchant_id from public.merchant_users where user_id = auth.uid();
$$;

create or replace function public.has_merchant_role(target_merchant uuid, allowed_roles text[])
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.merchant_users
    where user_id = auth.uid() and merchant_id = target_merchant and role = any(allowed_roles)
  );
$$;

drop policy if exists merchant_member_read on public.merchants;
create policy merchant_member_read on public.merchants for select to authenticated
using (id in (select public.current_user_merchant_ids()));

drop policy if exists merchant_users_self_read on public.merchant_users;
create policy merchant_users_self_read on public.merchant_users for select to authenticated
using (user_id = auth.uid() or public.has_merchant_role(merchant_id, array['owner','admin','advanced_admin']));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'products','visitors','conversations','messages','insights','insight_sources',
    'dashboard_settings','platform_integrations','sync_jobs','webhook_events','analytics_events'
  ] loop
    execute format('drop policy if exists merchant_scoped_read on public.%I', table_name);
    execute format(
      'create policy merchant_scoped_read on public.%I for select to authenticated using (merchant_id in (select public.current_user_merchant_ids()))',
      table_name
    );
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['agent_configs','prompt_versions','guardrails','qa_runs','qa_cases'] loop
    execute format('drop policy if exists merchant_scoped_read on public.%I', table_name);
    execute format('drop policy if exists advanced_agent_read on public.%I', table_name);
    execute format(
      'create policy advanced_agent_read on public.%I for select to authenticated using (public.has_merchant_role(merchant_id, array[''owner'',''advanced_admin'']))',
      table_name
    );
  end loop;
end $$;

drop policy if exists audit_privileged_read on public.audit_logs;
create policy audit_privileged_read on public.audit_logs for select to authenticated
using (public.has_merchant_role(merchant_id, array['owner','admin','advanced_admin']));

drop policy if exists products_admin_write on public.products;
create policy products_admin_write on public.products for all to authenticated
using (public.has_merchant_role(merchant_id, array['owner','admin','advanced_admin']))
with check (public.has_merchant_role(merchant_id, array['owner','admin','advanced_admin']));

drop policy if exists settings_admin_write on public.dashboard_settings;
create policy settings_admin_write on public.dashboard_settings for all to authenticated
using (public.has_merchant_role(merchant_id, array['owner','admin','advanced_admin']))
with check (public.has_merchant_role(merchant_id, array['owner','admin','advanced_admin']));

do $$
declare
  table_name text;
begin
  foreach table_name in array array['agent_configs','prompt_versions','guardrails','qa_runs','qa_cases'] loop
    execute format('drop policy if exists advanced_agent_write on public.%I', table_name);
    execute format(
      'create policy advanced_agent_write on public.%I for all to authenticated using (public.has_merchant_role(merchant_id, array[''owner'',''advanced_admin''])) with check (public.has_merchant_role(merchant_id, array[''owner'',''advanced_admin'']))',
      table_name
    );
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on public.products, public.dashboard_settings, public.agent_configs,
  public.prompt_versions, public.guardrails, public.qa_runs, public.qa_cases to authenticated;

do $$
declare
  table_name text;
begin
  drop trigger if exists set_visitors_updated_at on public.visitors;
  foreach table_name in array array[
    'merchants','merchant_users','products','insights','dashboard_settings',
    'agent_configs','guardrails','platform_integrations','sync_jobs'
  ] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;
