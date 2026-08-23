-- Nbeh MVP beta readiness: secure merchant access bootstrap and hot-path indexes.

create index if not exists idx_merchants_normalized_email
  on public.merchants (lower(email))
  where email is not null and status = 'active';

create index if not exists idx_integrations_status_sync_age
  on public.platform_integrations (status, last_synced_at);

create index if not exists idx_messages_normalized_question
  on public.messages (merchant_id, product_id, (metadata_json ->> 'normalized_question'))
  where sender_type = 'visitor' and metadata_json ? 'normalized_question';

drop function if exists public.claim_merchant_memberships_by_email();
create function public.claim_merchant_memberships_by_email()
returns table (claimed_count integer, merchant_count integer)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  verified_email text;
  inserted_count integer := 0;
begin
  select lower(btrim(email))
  into verified_email
  from auth.users
  where id = auth.uid()
    and email_confirmed_at is not null;

  if verified_email is null or verified_email = '' then
    raise exception 'A verified email address is required.';
  end if;

  insert into public.merchant_users (merchant_id, user_id, role)
  select merchant.id, auth.uid(), 'owner'
  from public.merchants merchant
  where merchant.status = 'active'
    and merchant.email is not null
    and lower(btrim(merchant.email)) = verified_email
  on conflict (merchant_id, user_id) do nothing;

  get diagnostics inserted_count = row_count;

  return query
  select inserted_count, count(*)::integer
  from public.merchant_users membership
  where membership.user_id = auth.uid();
end;
$$;

revoke all on function public.claim_merchant_memberships_by_email() from public, anon;
grant execute on function public.claim_merchant_memberships_by_email() to authenticated;

comment on function public.claim_merchant_memberships_by_email() is
  'Claims active merchant workspaces whose platform-verified owner email matches the authenticated, verified Supabase email.';

drop function if exists public.persist_agent_turn_atomic(uuid, uuid, text, text, uuid, boolean, text, text, text, text, text, jsonb, jsonb, timestamptz);
create function public.persist_agent_turn_atomic(
  target_merchant_id uuid,
  target_product_id uuid,
  target_product_slug text,
  target_visitor_ref text,
  target_conversation_id uuid,
  target_is_new boolean,
  target_storefront_locale text,
  target_response_language text,
  target_welcome_message text,
  target_user_message text,
  target_normalized_question text,
  target_answer jsonb,
  target_signals jsonb,
  request_time timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_visitor_id uuid;
  user_message_id uuid := gen_random_uuid();
  signal jsonb;
  target_insight_id uuid;
  repeated_question boolean := false;
  created_insights integer := 0;
  conversation_metadata jsonb;
begin
  if target_visitor_ref !~ '^anon-[a-zA-Z0-9-]{4,64}$' then raise exception 'Invalid anonymous visitor reference.'; end if;
  if target_response_language not in ('ar', 'en') then raise exception 'Invalid response language.'; end if;
  if target_storefront_locale is not null and target_storefront_locale not in ('ar', 'en') then raise exception 'Invalid storefront language.'; end if;
  if not exists (select 1 from public.products where id = target_product_id and merchant_id = target_merchant_id) then
    raise exception 'Product does not belong to the merchant.';
  end if;

  insert into public.visitors (merchant_id, anonymous_ref, first_seen_at, last_seen_at, metadata_json)
  values (target_merchant_id, target_visitor_ref, request_time, request_time, jsonb_build_object('pii_collected', false))
  on conflict (merchant_id, anonymous_ref) do update
    set last_seen_at = excluded.last_seen_at
  returning id into target_visitor_id;

  conversation_metadata := jsonb_build_object(
    'visitor_ref', target_visitor_ref,
    'product_slug', target_product_slug,
    'fallback_reason', target_answer ->> 'fallback_reason',
    'detected_objection', target_answer ->> 'detected_objection',
    'storefront_locale', target_storefront_locale
  );

  if target_is_new then
    insert into public.conversations (
      id, merchant_id, product_id, visitor_id, status, language, channel, started_at, metadata_json
    ) values (
      target_conversation_id, target_merchant_id, target_product_id, target_visitor_id,
      'open', target_response_language, 'product_page_widget', request_time, conversation_metadata
    );
  else
    update public.conversations
    set visitor_id = target_visitor_id,
        status = 'open',
        language = target_response_language,
        metadata_json = conversation_metadata
    where id = target_conversation_id
      and merchant_id = target_merchant_id
      and product_id = target_product_id
      and metadata_json ->> 'visitor_ref' = target_visitor_ref;
    if not found then raise exception 'Conversation does not belong to this visitor, merchant, and product.'; end if;
  end if;

  if target_is_new then
    insert into public.messages (
      id, conversation_id, merchant_id, product_id, sender_type, content, language,
      token_usage, safety_flags, metadata_json, created_at
    ) values (
      gen_random_uuid(), target_conversation_id, target_merchant_id, target_product_id,
      'assistant', target_welcome_message, coalesce(target_storefront_locale, target_response_language),
      '{}'::jsonb, '{}'::jsonb, jsonb_build_object('welcome', true), request_time
    );
  end if;

  insert into public.messages (
    id, conversation_id, merchant_id, product_id, sender_type, content, language,
    token_usage, safety_flags, metadata_json, created_at
  ) values (
    user_message_id, target_conversation_id, target_merchant_id, target_product_id,
    'visitor', target_user_message, target_response_language, '{}'::jsonb, '{}'::jsonb,
    jsonb_build_object('normalized_question', target_normalized_question), request_time
  );

  insert into public.messages (
    id, conversation_id, merchant_id, product_id, sender_type, content, language,
    model, provider, token_usage, latency_ms, safety_flags, fallback_reason, metadata_json, created_at
  ) values (
    gen_random_uuid(), target_conversation_id, target_merchant_id, target_product_id,
    'assistant', target_answer ->> 'text', target_answer ->> 'language',
    nullif(target_answer ->> 'model', ''), nullif(target_answer ->> 'provider', ''),
    coalesce(target_answer -> 'token_usage', '{}'::jsonb),
    nullif(target_answer ->> 'latency_ms', '')::integer,
    coalesce(target_answer -> 'safety_flags', '{}'::jsonb),
    nullif(target_answer ->> 'fallback_reason', ''),
    coalesce(target_answer -> 'metadata', '{}'::jsonb), request_time
  );

  select count(*) > 1 into repeated_question
  from public.messages
  where merchant_id = target_merchant_id
    and product_id = target_product_id
    and sender_type = 'visitor'
    and metadata_json ->> 'normalized_question' = target_normalized_question;

  if repeated_question then
    target_signals := coalesce(target_signals, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'type', 'repeated_question', 'category', 'repeated', 'title', 'Repeated shopper question',
      'content', 'A shopper question is recurring for this product.', 'severity', 'medium'
    ));
  end if;

  for signal in select value from jsonb_array_elements(coalesce(target_signals, '[]'::jsonb)) loop
    perform pg_advisory_xact_lock(hashtextextended(
      target_merchant_id::text || ':' || target_product_id::text || ':' || (signal ->> 'type') || ':' || (signal ->> 'category'), 0
    ));
    select id into target_insight_id
    from public.insights
    where merchant_id = target_merchant_id
      and product_id = target_product_id
      and insight_type = (signal ->> 'type')
      and (metadata_json ->> 'category') = (signal ->> 'category')
    order by created_at
    limit 1
    for update;

    if target_insight_id is null then
      target_insight_id := gen_random_uuid();
      insert into public.insights (
        id, merchant_id, product_id, insight_type, title, content, severity,
        frequency, status, metadata_json, created_at, updated_at
      ) values (
        target_insight_id, target_merchant_id, target_product_id, signal ->> 'type',
        signal ->> 'title', signal ->> 'content', signal ->> 'severity', 1, 'open',
        jsonb_build_object('category', signal ->> 'category'), request_time, request_time
      );
    else
      update public.insights
      set frequency = frequency + 1,
          content = signal ->> 'content',
          severity = signal ->> 'severity',
          status = 'open',
          updated_at = request_time
      where id = target_insight_id and merchant_id = target_merchant_id;
    end if;

    insert into public.insight_sources (
      id, merchant_id, insight_id, conversation_id, message_id, created_at
    ) values (
      gen_random_uuid(), target_merchant_id, target_insight_id, target_conversation_id, user_message_id, request_time
    );
    created_insights := created_insights + 1;
    target_insight_id := null;
  end loop;

  insert into public.analytics_events (
    id, merchant_id, product_id, visitor_id, product_slug, visitor_ref,
    event_type, storefront_locale, metadata_json, created_at
  )
  select gen_random_uuid(), target_merchant_id, target_product_id, target_visitor_id,
    target_product_slug, target_visitor_ref, event_type, target_storefront_locale,
    jsonb_build_object('source', 'agent_runtime', 'pii_minimized', true), request_time
  from unnest(array_remove(array[
    case when target_is_new then 'conversation_started' end,
    'message_sent',
    'agent_answered',
    case when nullif(target_answer ->> 'fallback_reason', '') is not null then 'fallback_triggered' end,
    case when nullif(target_answer ->> 'detected_objection', '') is not null then 'objection_detected' end,
    case when repeated_question then 'repeated_question_detected' end
  ], null)) as event_type;

  return jsonb_build_object('insights_created', created_insights, 'repeated_question', repeated_question);
end;
$$;

revoke all on function public.persist_agent_turn_atomic(uuid, uuid, text, text, uuid, boolean, text, text, text, text, text, jsonb, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.persist_agent_turn_atomic(uuid, uuid, text, text, uuid, boolean, text, text, text, text, text, jsonb, jsonb, timestamptz) to service_role;

create table if not exists public.merchant_token_usage_monthly (
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  cycle_start date not null,
  consumed_tokens bigint not null default 0 check (consumed_tokens >= 0),
  reserved_tokens bigint not null default 0 check (reserved_tokens >= 0),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (merchant_id, cycle_start)
);

create table if not exists public.agent_token_reservations (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  cycle_start date not null,
  reserved_tokens integer not null check (reserved_tokens between 1 and 50000),
  actual_tokens integer,
  status text not null default 'reserved' check (status in ('reserved', 'settled', 'released', 'expired')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists idx_agent_token_reservations_cleanup
  on public.agent_token_reservations (merchant_id, status, created_at);

alter table public.merchant_token_usage_monthly enable row level security;
alter table public.agent_token_reservations enable row level security;
revoke all on public.merchant_token_usage_monthly, public.agent_token_reservations from public, anon, authenticated;
grant select, insert, update, delete on public.merchant_token_usage_monthly, public.agent_token_reservations to service_role;

drop function if exists public.reserve_agent_token_budget(uuid, integer, timestamptz);
create function public.reserve_agent_token_budget(
  target_merchant_id uuid,
  estimated_tokens integer,
  request_time timestamptz
)
returns table (allowed boolean, reservation_id uuid, remaining_tokens bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_cycle date := date_trunc('month', request_time)::date;
  allowance bigint := 1000000;
  usage public.merchant_token_usage_monthly%rowtype;
  expired_tokens bigint := 0;
begin
  if estimated_tokens not between 1 and 50000 then raise exception 'Invalid token reservation.'; end if;
  if not exists (select 1 from public.merchants where id = target_merchant_id and status = 'active') then raise exception 'Merchant was not found.'; end if;

  select greatest(0, coalesce(nullif(dashboard_preferences ->> 'monthly_token_allowance', '')::bigint, 1000000))
  into allowance
  from public.dashboard_settings
  where merchant_id = target_merchant_id;
  allowance := coalesce(allowance, 1000000);

  insert into public.merchant_token_usage_monthly (merchant_id, cycle_start)
  values (target_merchant_id, target_cycle)
  on conflict (merchant_id, cycle_start) do nothing;

  select * into usage
  from public.merchant_token_usage_monthly
  where merchant_id = target_merchant_id and cycle_start = target_cycle
  for update;

  select coalesce(sum(reserved_tokens), 0) into expired_tokens
  from public.agent_token_reservations
  where merchant_id = target_merchant_id
    and cycle_start = target_cycle
    and status = 'reserved'
    and created_at < request_time - interval '5 minutes';

  if expired_tokens > 0 then
    update public.agent_token_reservations
    set status = 'expired', settled_at = request_time
    where merchant_id = target_merchant_id
      and cycle_start = target_cycle
      and status = 'reserved'
      and created_at < request_time - interval '5 minutes';
    update public.merchant_token_usage_monthly
    set reserved_tokens = greatest(0, reserved_tokens - expired_tokens), updated_at = request_time
    where merchant_id = target_merchant_id and cycle_start = target_cycle
    returning * into usage;
  end if;

  if usage.consumed_tokens + usage.reserved_tokens + estimated_tokens > allowance then
    allowed := false;
    reservation_id := null;
    remaining_tokens := greatest(0, allowance - usage.consumed_tokens - usage.reserved_tokens);
    return next;
    return;
  end if;

  insert into public.agent_token_reservations (merchant_id, cycle_start, reserved_tokens, created_at)
  values (target_merchant_id, target_cycle, estimated_tokens, request_time)
  returning id into reservation_id;
  update public.merchant_token_usage_monthly
  set reserved_tokens = reserved_tokens + estimated_tokens, updated_at = request_time
  where merchant_id = target_merchant_id and cycle_start = target_cycle;

  allowed := true;
  remaining_tokens := greatest(0, allowance - usage.consumed_tokens - usage.reserved_tokens - estimated_tokens);
  return next;
end;
$$;

drop function if exists public.settle_agent_token_budget(uuid, integer, boolean, timestamptz);
create function public.settle_agent_token_budget(
  target_reservation_id uuid,
  actual_tokens integer,
  request_succeeded boolean,
  settlement_time timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation public.agent_token_reservations%rowtype;
  charged_tokens integer;
begin
  select * into reservation
  from public.agent_token_reservations
  where id = target_reservation_id
  for update;
  if not found or reservation.status <> 'reserved' then return; end if;

  charged_tokens := case
    when request_succeeded then greatest(0, least(50000, coalesce(nullif(actual_tokens, 0), reservation.reserved_tokens)))
    else 0
  end;

  update public.merchant_token_usage_monthly
  set reserved_tokens = greatest(0, reserved_tokens - reservation.reserved_tokens),
      consumed_tokens = consumed_tokens + charged_tokens,
      request_count = request_count + case when request_succeeded then 1 else 0 end,
      updated_at = settlement_time
  where merchant_id = reservation.merchant_id and cycle_start = reservation.cycle_start;

  update public.agent_token_reservations
  set actual_tokens = charged_tokens,
      status = case when request_succeeded then 'settled' else 'released' end,
      settled_at = settlement_time
  where id = reservation.id;
end;
$$;

revoke all on function public.reserve_agent_token_budget(uuid, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.settle_agent_token_budget(uuid, integer, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.reserve_agent_token_budget(uuid, integer, timestamptz) to service_role;
grant execute on function public.settle_agent_token_budget(uuid, integer, boolean, timestamptz) to service_role;
