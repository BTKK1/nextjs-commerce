alter table public.analytics_events add column if not exists product_slug text;
alter table public.analytics_events add column if not exists visitor_ref text;
alter table public.analytics_events add column if not exists storefront_locale text;

update public.analytics_events events
set product_slug = products.slug
from public.products products
where events.product_id = products.id and events.product_slug is null;

update public.analytics_events events
set visitor_ref = visitors.anonymous_ref
from public.visitors visitors
where events.visitor_id = visitors.id and events.visitor_ref is null;

create index if not exists idx_analytics_events_product_type_created
  on public.analytics_events(product_slug, event_type, created_at desc);

create index if not exists idx_analytics_events_visitor_created
  on public.analytics_events(merchant_id, visitor_ref, created_at desc);

create index if not exists idx_conversations_merchant_visitor_started
  on public.conversations(merchant_id, visitor_id, started_at desc);

create index if not exists idx_messages_merchant_sender_created
  on public.messages(merchant_id, sender_type, created_at desc);

create index if not exists idx_messages_merchant_product_sender_created
  on public.messages(merchant_id, product_id, sender_type, created_at desc);

create index if not exists idx_insights_merchant_product_type_category
  on public.insights(merchant_id, product_id, insight_type, ((metadata_json ->> 'category')));

drop function if exists public.publish_prompt_version_atomic(uuid, uuid, uuid, uuid, jsonb, jsonb);

create function public.publish_prompt_version_atomic(
  target_merchant_id uuid,
  target_config_id uuid,
  target_version_id uuid,
  actor_user_id uuid,
  config_snapshot jsonb,
  guardrail_snapshot jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_version public.prompt_versions%rowtype;
  previous_active_version_id uuid;
  published_time timestamptz := now();
begin
  select active_version_id into previous_active_version_id
  from public.agent_configs
  where id = target_config_id and merchant_id = target_merchant_id
  for update;
  if not found then raise exception 'Agent configuration was not found.'; end if;

  select * into target_version
  from public.prompt_versions
  where id = target_version_id and merchant_id = target_merchant_id and agent_config_id = target_config_id
  for update;
  if not found then raise exception 'Prompt version was not found.'; end if;

  update public.prompt_versions
  set status = 'archived'
  where merchant_id = target_merchant_id and agent_config_id = target_config_id and status in ('published', 'rollback');

  update public.prompt_versions
  set status = 'published', published_by = actor_user_id, published_at = published_time
  where id = target_version_id and merchant_id = target_merchant_id;

  update public.agent_configs
  set active_version_id = target_version_id,
      system_prompt = target_version.system_prompt,
      developer_prompt = target_version.developer_prompt,
      tone_preset = coalesce(config_snapshot ->> 'tone_preset', tone_preset),
      response_language_policy = coalesce(config_snapshot ->> 'response_language_policy', response_language_policy),
      temperature = coalesce((config_snapshot ->> 'temperature')::numeric, temperature),
      max_tokens = coalesce((config_snapshot ->> 'max_tokens')::integer, max_tokens),
      product_context_policy = coalesce(config_snapshot -> 'product_context_policy', product_context_policy),
      fallback_policy = coalesce(config_snapshot -> 'fallback_policy', fallback_policy),
      safety_policy = coalesce(config_snapshot -> 'safety_policy', safety_policy),
      objection_policy = coalesce(config_snapshot -> 'objection_policy', objection_policy),
      advanced_settings = coalesce(config_snapshot -> 'advanced_settings', advanced_settings),
      updated_at = published_time
  where id = target_config_id and merchant_id = target_merchant_id;
  if not found then raise exception 'Agent configuration was not found.'; end if;

  if guardrail_snapshot is not null then
    update public.guardrails
    set allowed_topics = coalesce(guardrail_snapshot -> 'allowed_topics', allowed_topics),
        blocked_topics = coalesce(guardrail_snapshot -> 'blocked_topics', blocked_topics),
        blocked_claims = coalesce(guardrail_snapshot -> 'blocked_claims', blocked_claims),
        fallback_response_ar = coalesce(guardrail_snapshot ->> 'fallback_response_ar', fallback_response_ar),
        fallback_response_en = coalesce(guardrail_snapshot ->> 'fallback_response_en', fallback_response_en),
        confidence_threshold = coalesce((guardrail_snapshot ->> 'confidence_threshold')::numeric, confidence_threshold),
        on_violation = coalesce(guardrail_snapshot ->> 'on_violation', on_violation),
        updated_at = published_time
    where merchant_id = target_merchant_id and agent_config_id = target_config_id;
  end if;

  insert into public.audit_logs (
    merchant_id, actor_user_id, actor_type, action, entity_type, entity_id,
    before_json, after_json, details_json
  ) values (
    target_merchant_id, actor_user_id,
    case when actor_user_id is null then 'system' else 'user' end,
    'prompt_published', 'prompt_version', target_version_id,
    jsonb_build_object('previous_active_version_id', previous_active_version_id),
    jsonb_build_object('active_version_id', target_version_id, 'version_number', target_version.version_number),
    coalesce(config_snapshot -> 'audit_details', '{}'::jsonb) || jsonb_build_object('atomic_governance', true)
  );
end;
$$;

drop function if exists public.rollback_prompt_version_atomic(uuid, uuid, uuid, uuid, jsonb, jsonb);

create function public.rollback_prompt_version_atomic(
  target_merchant_id uuid,
  target_config_id uuid,
  target_version_id uuid,
  actor_user_id uuid,
  config_snapshot jsonb,
  guardrail_snapshot jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_version public.prompt_versions%rowtype;
  previous_active_version_id uuid;
  rollback_time timestamptz := now();
begin
  select active_version_id into previous_active_version_id
  from public.agent_configs
  where id = target_config_id and merchant_id = target_merchant_id
  for update;
  if not found then raise exception 'Agent configuration was not found.'; end if;

  select * into target_version
  from public.prompt_versions
  where id = target_version_id and merchant_id = target_merchant_id and agent_config_id = target_config_id
  for update;
  if not found then raise exception 'Rollback target was not found.'; end if;

  update public.prompt_versions
  set status = 'archived'
  where merchant_id = target_merchant_id and agent_config_id = target_config_id and status in ('published', 'rollback');

  update public.prompt_versions
  set status = 'rollback', published_by = actor_user_id, published_at = rollback_time
  where id = target_version_id and merchant_id = target_merchant_id;

  update public.agent_configs
  set active_version_id = target_version_id,
      system_prompt = target_version.system_prompt,
      developer_prompt = target_version.developer_prompt,
      tone_preset = coalesce(config_snapshot ->> 'tone_preset', tone_preset),
      response_language_policy = coalesce(config_snapshot ->> 'response_language_policy', response_language_policy),
      temperature = coalesce((config_snapshot ->> 'temperature')::numeric, temperature),
      max_tokens = coalesce((config_snapshot ->> 'max_tokens')::integer, max_tokens),
      product_context_policy = coalesce(config_snapshot -> 'product_context_policy', product_context_policy),
      fallback_policy = coalesce(config_snapshot -> 'fallback_policy', fallback_policy),
      safety_policy = coalesce(config_snapshot -> 'safety_policy', safety_policy),
      objection_policy = coalesce(config_snapshot -> 'objection_policy', objection_policy),
      advanced_settings = coalesce(config_snapshot -> 'advanced_settings', advanced_settings),
      updated_at = rollback_time
  where id = target_config_id and merchant_id = target_merchant_id;
  if not found then raise exception 'Agent configuration was not found.'; end if;

  if guardrail_snapshot is not null then
    update public.guardrails
    set allowed_topics = coalesce(guardrail_snapshot -> 'allowed_topics', allowed_topics),
        blocked_topics = coalesce(guardrail_snapshot -> 'blocked_topics', blocked_topics),
        blocked_claims = coalesce(guardrail_snapshot -> 'blocked_claims', blocked_claims),
        fallback_response_ar = coalesce(guardrail_snapshot ->> 'fallback_response_ar', fallback_response_ar),
        fallback_response_en = coalesce(guardrail_snapshot ->> 'fallback_response_en', fallback_response_en),
        confidence_threshold = coalesce((guardrail_snapshot ->> 'confidence_threshold')::numeric, confidence_threshold),
        on_violation = coalesce(guardrail_snapshot ->> 'on_violation', on_violation),
        updated_at = rollback_time
    where merchant_id = target_merchant_id and agent_config_id = target_config_id;
  end if;

  insert into public.audit_logs (
    merchant_id, actor_user_id, actor_type, action, entity_type, entity_id,
    before_json, after_json, details_json
  ) values (
    target_merchant_id, actor_user_id,
    case when actor_user_id is null then 'system' else 'user' end,
    'prompt_rolled_back', 'prompt_version', target_version_id,
    jsonb_build_object('previous_active_version_id', previous_active_version_id),
    jsonb_build_object('active_version_id', target_version_id, 'version_number', target_version.version_number),
    coalesce(config_snapshot -> 'audit_details', '{}'::jsonb) || jsonb_build_object('atomic_governance', true)
  );
end;
$$;

revoke all on function public.publish_prompt_version_atomic(uuid, uuid, uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.rollback_prompt_version_atomic(uuid, uuid, uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.publish_prompt_version_atomic(uuid, uuid, uuid, uuid, jsonb, jsonb) to service_role;
grant execute on function public.rollback_prompt_version_atomic(uuid, uuid, uuid, uuid, jsonb, jsonb) to service_role;

create unique index if not exists idx_webhook_events_integration_event_unique
  on public.webhook_events(integration_id, external_event_id)
  where external_event_id is not null;

create unique index if not exists idx_integrations_provider_store_unique
  on public.platform_integrations(provider, external_store_id)
  where external_store_id is not null;

drop function if exists public.prepare_oauth_connection_atomic(uuid, text, jsonb, text, timestamptz, uuid);
create function public.prepare_oauth_connection_atomic(
  target_merchant_id uuid,
  target_provider text,
  requested_scopes jsonb,
  target_state_hash text,
  target_expires_at timestamptz,
  actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_integration_id uuid;
begin
  if target_provider not in ('salla', 'zid') then raise exception 'Unsupported provider.'; end if;
  insert into public.platform_integrations (
    merchant_id, provider, status, scopes, provider_config
  ) values (
    target_merchant_id, target_provider, 'pending', requested_scopes,
    jsonb_build_object('approval_required', true, 'oauth_placeholder_ready', true)
  )
  on conflict (merchant_id, provider) do update
  set status = 'pending', scopes = excluded.scopes, provider_config = excluded.provider_config
  returning id into target_integration_id;

  insert into public.oauth_states (
    merchant_id, integration_id, provider, state_hash, expires_at, created_by
  ) values (
    target_merchant_id, target_integration_id, target_provider, target_state_hash, target_expires_at, actor_user_id
  );

  insert into public.audit_logs (
    merchant_id, actor_user_id, actor_type, action, entity_type, entity_id, details_json
  ) values (
    target_merchant_id, actor_user_id,
    case when actor_user_id is null then 'system' else 'user' end,
    'integration_oauth_started', 'platform_integration', target_integration_id,
    jsonb_build_object('provider', target_provider, 'expires_at', target_expires_at, 'credential_material_stored', false)
  );
  return target_integration_id;
end;
$$;

drop function if exists public.consume_oauth_state_atomic(text, text, timestamptz);
create function public.consume_oauth_state_atomic(
  target_provider text,
  target_state_hash text,
  consumed_time timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_state public.oauth_states%rowtype;
begin
  update public.oauth_states
  set consumed_at = consumed_time
  where provider = target_provider
    and state_hash = target_state_hash
    and consumed_at is null
    and expires_at > consumed_time
  returning * into target_state;
  if not found then return null; end if;

  update public.platform_integrations
  set status = 'pending',
      provider_config = jsonb_build_object('authorization_code_received', true, 'token_vault_required', true),
      metadata_json = jsonb_build_object('note', 'Authorization completed. Secure token-vault exchange is intentionally pending platform approval.')
  where id = target_state.integration_id and merchant_id = target_state.merchant_id;
  if not found then raise exception 'Integration was not found.'; end if;

  insert into public.audit_logs (
    merchant_id, actor_type, action, entity_type, entity_id, details_json
  ) values (
    target_state.merchant_id, 'system', 'integration_oauth_callback_validated',
    'platform_integration', target_state.integration_id,
    jsonb_build_object('provider', target_provider, 'state_id', target_state.id, 'status', 'pending_token_vault', 'authorization_code_stored', false)
  );
  return target_state.id;
end;
$$;

drop function if exists public.enqueue_webhook_event_atomic(text, text, text, text, jsonb, jsonb);
create function public.enqueue_webhook_event_atomic(
  target_provider text,
  target_external_store_id text,
  target_external_event_id text,
  target_event_type text,
  sanitized_payload jsonb,
  sanitized_headers jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_integration public.platform_integrations%rowtype;
begin
  select * into target_integration
  from public.platform_integrations
  where provider = target_provider
    and external_store_id = target_external_store_id
    and status = 'connected'
  limit 1;
  if not found then return null; end if;

  insert into public.webhook_events (
    merchant_id, integration_id, provider, external_event_id, event_type,
    payload, headers_json, status
  ) values (
    target_integration.merchant_id, target_integration.id, target_provider,
    target_external_event_id, target_event_type, sanitized_payload, sanitized_headers, 'received'
  )
  on conflict (integration_id, external_event_id) where external_event_id is not null do nothing;
  if not found then return 'duplicate'; end if;

  insert into public.audit_logs (
    merchant_id, actor_type, action, entity_type, entity_id, details_json
  ) values (
    target_integration.merchant_id, 'webhook', 'integration_webhook_received',
    'platform_integration', target_integration.id,
    jsonb_build_object('provider', target_provider, 'external_event_id', target_external_event_id, 'event_type', target_event_type, 'payload_sanitized', true)
  );
  return 'accepted';
end;
$$;

revoke all on function public.prepare_oauth_connection_atomic(uuid, text, jsonb, text, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.consume_oauth_state_atomic(text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.enqueue_webhook_event_atomic(text, text, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.prepare_oauth_connection_atomic(uuid, text, jsonb, text, timestamptz, uuid) to service_role;
grant execute on function public.consume_oauth_state_atomic(text, text, timestamptz) to service_role;
grant execute on function public.enqueue_webhook_event_atomic(text, text, text, text, jsonb, jsonb) to service_role;

create table if not exists public.platform_agent_config (
  singleton_key text primary key check (singleton_key = 'global'),
  system_prompt text not null,
  developer_prompt text not null default '',
  model_provider text not null check (model_provider in ('openrouter', 'deepseek-direct')),
  model_name text not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.platform_agent_config enable row level security;
revoke all on table public.platform_agent_config from public, anon, authenticated;
grant select, insert, update on table public.platform_agent_config to service_role;

drop function if exists public.update_global_agent_config_atomic(uuid, text, text, text, text, text, timestamptz);
create function public.update_global_agent_config_atomic(
  audit_merchant_id uuid,
  target_system_prompt text,
  target_developer_prompt text,
  target_model_provider text,
  target_model_name text,
  actor_email text,
  change_time timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_config jsonb;
begin
  if target_model_provider not in ('openrouter', 'deepseek-direct') then raise exception 'Unsupported model provider.'; end if;
  if length(target_system_prompt) not between 40 and 16000 then raise exception 'Invalid system prompt length.'; end if;
  if length(target_developer_prompt) > 8000 then raise exception 'Invalid developer prompt length.'; end if;

  select to_jsonb(config) - 'system_prompt' - 'developer_prompt'
  into previous_config
  from public.platform_agent_config config
  where singleton_key = 'global'
  for update;

  insert into public.platform_agent_config (
    singleton_key, system_prompt, developer_prompt, model_provider, model_name, updated_at, updated_by
  ) values (
    'global', target_system_prompt, target_developer_prompt, target_model_provider, target_model_name, change_time, actor_email
  )
  on conflict (singleton_key) do update
  set system_prompt = excluded.system_prompt,
      developer_prompt = excluded.developer_prompt,
      model_provider = excluded.model_provider,
      model_name = excluded.model_name,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;

  insert into public.audit_logs (
    merchant_id, actor_type, action, entity_type, before_json, after_json, details_json
  ) values (
    audit_merchant_id, 'system', 'global_agent_config_updated', 'platform_agent_config',
    previous_config,
    jsonb_build_object('model_provider', target_model_provider, 'model_name', target_model_name, 'updated_at', change_time, 'updated_by', actor_email),
    jsonb_build_object('scope', 'all_nbeh_agents', 'prompt_changed', true, 'developer_guidance_changed', true)
  );
end;
$$;

revoke all on function public.update_global_agent_config_atomic(uuid, text, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.update_global_agent_config_atomic(uuid, text, text, text, text, text, timestamptz) to service_role;

-- Ensure membership and immutable audit evidence cannot be changed directly by
-- dashboard users. Membership provisioning is an owner bootstrap/service task,
-- and all application audit writes go through the server-only service client or
-- the atomic governance RPCs above.
revoke insert, update, delete on table public.merchant_users from authenticated;
revoke insert, update, delete on table public.audit_logs from authenticated;
revoke insert, update, delete on table public.webhook_events from authenticated;
revoke insert, update, delete on table public.oauth_states from authenticated;

drop function if exists public.record_integration_sync_audit(uuid, uuid, uuid, text, text, integer, text);
create function public.record_integration_sync_audit(
  target_merchant_id uuid,
  target_integration_id uuid,
  target_job_id uuid,
  target_provider text,
  target_status text,
  target_records_processed integer default 0,
  target_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_status not in ('success', 'failed') then raise exception 'Invalid sync audit status.'; end if;
  if not exists (
    select 1 from public.sync_jobs
    where id = target_job_id and merchant_id = target_merchant_id and integration_id = target_integration_id
  ) then raise exception 'Sync job was not found.'; end if;

  insert into public.audit_logs (
    merchant_id, actor_type, action, entity_type, entity_id, details_json
  ) values (
    target_merchant_id, 'system',
    case when target_status = 'success' then 'integration_sync_succeeded' else 'integration_sync_failed' end,
    'sync_job', target_job_id,
    jsonb_build_object(
      'integration_id', target_integration_id,
      'provider', target_provider,
      'status', target_status,
      'records_processed', greatest(target_records_processed, 0),
      'error_code', target_error_code
    )
  );
end;
$$;

revoke all on function public.record_integration_sync_audit(uuid, uuid, uuid, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.record_integration_sync_audit(uuid, uuid, uuid, text, text, integer, text) to service_role;
