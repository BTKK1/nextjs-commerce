-- Charge the complete provider-reported usage for a shopper turn. The former
-- 10k ceiling silently under-counted a response when one catalog-grounding
-- repair was needed, making the merchant wallet and burn rate inaccurate.

alter table public.agent_token_reservations
  drop constraint if exists agent_token_reservations_reserved_tokens_check;

alter table public.agent_token_reservations
  add constraint agent_token_reservations_reserved_tokens_check
  check (reserved_tokens between 1 and 50000);

create or replace function public.reserve_agent_token_budget(
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

create or replace function public.settle_agent_token_budget(
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
