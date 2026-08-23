-- Canonical schema entry point.
-- Apply supabase/migrations/202608030001_dashboard_sprint.sql with:
--   pnpm run supabase:migrate
-- This compatibility file is retained for existing deployment references.

\ir migrations/202608030001_dashboard_sprint.sql
\ir migrations/202608030002_platform_foundation.sql

/* Legacy reference below (not executed because the migration command targets
   the versioned migration above).

-- Supabase-ready schema for the Saleh Stores AI Sales Agent demo.
-- The local demo uses .local/demo-db.json by default so it can run
-- without a live Supabase project. These tables map the same POC-style entities
-- for a future production persistence adapter.

create table if not exists merchants (
  id text primary key,
  name text not null,
  arabic_name text,
  niche text,
  country text default 'SA',
  currency text default 'SAR',
  created_at timestamptz default now()
);

create table if not exists products (
  id text primary key,
  merchant_id text references merchants(id) on delete cascade,
  slug text unique not null,
  name text not null,
  arabic_name text,
  category text,
  price_sar numeric not null,
  compare_at_price_sar numeric,
  availability text,
  inventory integer,
  catalog_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists visitors (
  id text primary key,
  anonymous_ref text unique not null,
  created_at timestamptz default now()
);

create table if not exists conversations (
  id text primary key,
  merchant_id text references merchants(id) on delete cascade,
  product_id text references products(id) on delete set null,
  visitor_id text references visitors(id) on delete set null,
  visitor_ref text not null,
  status text not null default 'active',
  fallback_reason text,
  detected_objection text,
  question_category text,
  quality_rating integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists messages (
  id text primary key,
  conversation_id text references conversations(id) on delete cascade,
  role text not null,
  content text not null,
  fallback_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists insights (
  id text primary key,
  merchant_id text references merchants(id) on delete cascade,
  product_id text references products(id) on delete cascade,
  conversation_id text references conversations(id) on delete set null,
  type text not null,
  title text not null,
  description text not null,
  severity text not null default 'medium',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists insight_sources (
  id bigint generated always as identity primary key,
  insight_id text references insights(id) on delete cascade,
  message_id text references messages(id) on delete cascade
);

create table if not exists dashboard_settings (
  merchant_id text primary key references merchants(id) on delete cascade,
  tone text not null default 'neutral_saudi',
  demo_mode boolean not null default true,
  retention_days integer not null default 30,
  refresh_label text
);

create table if not exists guardrails (
  id text primary key,
  merchant_id text references merchants(id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  description text
);

create table if not exists audit_logs (
  id text primary key,
  merchant_id text references merchants(id) on delete cascade,
  actor text not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists platform_integrations (
  id text primary key,
  merchant_id text references merchants(id) on delete cascade,
  provider text not null,
  status text not null,
  description text,
  connected_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists sync_jobs (
  id text primary key,
  merchant_id text references merchants(id) on delete cascade,
  provider text not null,
  status text not null,
  note text,
  created_at timestamptz default now()
);

create table if not exists webhook_events (
  id text primary key,
  merchant_id text references merchants(id) on delete cascade,
  provider text not null,
  status text not null,
  payload jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz default now()
);

create table if not exists config_versions (
  id text primary key,
  merchant_id text references merchants(id) on delete cascade,
  model text not null,
  mode text not null,
  prompt_version text not null,
  created_at timestamptz default now()
);

create table if not exists analytics_events (
  id text primary key,
  merchant_id text references merchants(id) on delete cascade,
  product_id text references products(id) on delete cascade,
  product_slug text not null,
  visitor_ref text not null,
  type text not null,
  storefront_locale text,
  created_at timestamptz default now()
);

create table if not exists agent_actions (
  id bigint generated always as identity primary key,
  agent text not null,
  action text not null,
  actor_kind text not null default 'ai',
  entity_kind text,
  entity_id text,
  provider text,
  model text,
  prompt_version text,
  provider_route text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  estimated_cost numeric,
  latency_ms integer,
  input_snapshot jsonb,
  output jsonb,
  reasoning text,
  data_policy jsonb,
  status text not null default 'ok',
  error_code text,
  error_message text,
  created_at timestamptz default now()
);

create table if not exists agent_evaluations (
  id bigint generated always as identity primary key,
  suite text not null,
  case_id text not null,
  product_slug text not null,
  language text not null,
  score integer not null,
  passed boolean not null,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_products_merchant_slug on products(merchant_id, slug);
create index if not exists idx_conversations_product_updated on conversations(product_id, updated_at desc);
create index if not exists idx_messages_conversation_created on messages(conversation_id, created_at);
create index if not exists idx_insights_product_type on insights(product_id, type);
create index if not exists idx_analytics_events_product_type on analytics_events(product_slug, type, created_at desc);
create index if not exists idx_agent_actions_agent_created on agent_actions(agent, created_at desc);
create index if not exists idx_agent_evaluations_suite_created on agent_evaluations(suite, created_at desc);

alter table merchants enable row level security;
alter table products enable row level security;
alter table visitors enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table insights enable row level security;
alter table insight_sources enable row level security;
alter table dashboard_settings enable row level security;
alter table guardrails enable row level security;
alter table audit_logs enable row level security;
alter table platform_integrations enable row level security;
alter table sync_jobs enable row level security;
alter table webhook_events enable row level security;
alter table config_versions enable row level security;
alter table analytics_events enable row level security;
alter table agent_actions enable row level security;
alter table agent_evaluations enable row level security;
*/
