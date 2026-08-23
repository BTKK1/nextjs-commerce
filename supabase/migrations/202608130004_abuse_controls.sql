-- Durable, privacy-preserving shopper abuse controls.
-- Only an HMAC fingerprint reaches this table; raw IP addresses and forwarding
-- headers are intentionally never persisted.

create table if not exists public.request_rate_limit_buckets (
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  bucket_scope text not null check (bucket_scope ~ '^[a-z_]{3,40}$'),
  fingerprint_hash text not null check (fingerprint_hash ~ '^rfp_v1_[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (merchant_id, bucket_scope, fingerprint_hash)
);

create index if not exists request_rate_limit_buckets_updated_idx
  on public.request_rate_limit_buckets (updated_at);

alter table public.request_rate_limit_buckets enable row level security;
revoke all on table public.request_rate_limit_buckets from public, anon, authenticated;
grant select, insert, update, delete on table public.request_rate_limit_buckets to service_role;

drop function if exists public.consume_request_rate_limit(uuid, text, text, integer, integer, timestamptz);
create function public.consume_request_rate_limit(
  target_merchant_id uuid,
  target_scope text,
  target_fingerprint_hash text,
  target_limit integer,
  target_window_seconds integer,
  request_time timestamptz
)
returns table (allowed boolean, retry_after_seconds integer, current_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  bucket public.request_rate_limit_buckets%rowtype;
begin
  if target_limit not between 1 and 1000 then raise exception 'Invalid rate limit.'; end if;
  if target_window_seconds not between 1 and 86400 then raise exception 'Invalid rate-limit window.'; end if;
  if target_scope !~ '^[a-z_]{3,40}$' then raise exception 'Invalid rate-limit scope.'; end if;
  if target_fingerprint_hash !~ '^rfp_v1_[0-9a-f]{64}$' then raise exception 'Invalid request fingerprint.'; end if;
  if not exists (select 1 from public.merchants where id = target_merchant_id) then raise exception 'Merchant was not found.'; end if;

  insert into public.request_rate_limit_buckets (
    merchant_id, bucket_scope, fingerprint_hash, window_started_at, request_count, updated_at
  ) values (
    target_merchant_id, target_scope, target_fingerprint_hash, request_time, 1, request_time
  )
  on conflict (merchant_id, bucket_scope, fingerprint_hash) do update
  set window_started_at = case
        when public.request_rate_limit_buckets.window_started_at + make_interval(secs => target_window_seconds) <= request_time
          then request_time
        else public.request_rate_limit_buckets.window_started_at
      end,
      request_count = case
        when public.request_rate_limit_buckets.window_started_at + make_interval(secs => target_window_seconds) <= request_time
          then 1
        else public.request_rate_limit_buckets.request_count + 1
      end,
      updated_at = request_time
  returning * into bucket;

  allowed := bucket.request_count <= target_limit;
  retry_after_seconds := case
    when allowed then 0
    else greatest(1, ceil(extract(epoch from (
      bucket.window_started_at + make_interval(secs => target_window_seconds) - request_time
    )))::integer)
  end;
  current_count := bucket.request_count;
  return next;
end;
$$;

revoke all on function public.consume_request_rate_limit(uuid, text, text, integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.consume_request_rate_limit(uuid, text, text, integer, integer, timestamptz) to service_role;
