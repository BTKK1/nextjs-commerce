drop function if exists public.save_prompt_draft_atomic(uuid, uuid, text, text, text, jsonb, uuid);

create function public.save_prompt_draft_atomic(
  target_merchant_id uuid,
  target_config_id uuid,
  target_system_prompt text,
  target_developer_prompt text,
  target_change_note text,
  target_test_result jsonb,
  actor_user_id uuid
)
returns table(version_id uuid, version_number integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version_number integer;
  new_version_id uuid := gen_random_uuid();
begin
  perform 1
  from public.agent_configs
  where id = target_config_id
    and merchant_id = target_merchant_id
    and status = 'active'
  for update;
  if not found then raise exception 'Agent configuration was not found.'; end if;

  if char_length(trim(coalesce(target_system_prompt, ''))) < 40
     or char_length(target_system_prompt) > 16000 then
    raise exception 'Draft prompt length is invalid.';
  end if;
  if char_length(trim(coalesce(target_change_note, ''))) < 4 then
    raise exception 'Draft change note is required.';
  end if;

  select coalesce(max(prompt_versions.version_number), 0) + 1
  into next_version_number
  from public.prompt_versions
  where agent_config_id = target_config_id
    and merchant_id = target_merchant_id;

  update public.prompt_versions
  set status = 'archived'
  where agent_config_id = target_config_id
    and merchant_id = target_merchant_id
    and status in ('draft', 'tested');

  insert into public.prompt_versions (
    id, agent_config_id, merchant_id, version_number, title,
    system_prompt, developer_prompt, change_note, test_result,
    status, created_by
  ) values (
    new_version_id, target_config_id, target_merchant_id,
    next_version_number, 'Draft v' || next_version_number,
    target_system_prompt, nullif(target_developer_prompt, ''),
    target_change_note, coalesce(target_test_result, '{}'::jsonb),
    'draft', actor_user_id
  );

  insert into public.audit_logs (
    merchant_id, actor_user_id, actor_type, action, entity_type, entity_id,
    after_json, details_json
  ) values (
    target_merchant_id, actor_user_id,
    case when actor_user_id is null then 'system' else 'user' end,
    'prompt_draft_saved', 'prompt_version', new_version_id,
    jsonb_build_object(
      'version_number', next_version_number,
      'validation', coalesce(target_test_result -> 'validation', '{}'::jsonb)
    ),
    jsonb_build_object(
      'change_note', target_change_note,
      'versioned_agent_settings', true,
      'atomic_governance', true
    )
  );

  return query select new_version_id, next_version_number;
end;
$$;

revoke all on function public.save_prompt_draft_atomic(uuid, uuid, text, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.save_prompt_draft_atomic(uuid, uuid, text, text, text, jsonb, uuid) to service_role;

insert into public.guardrails (
  merchant_id, agent_config_id, allowed_topics, blocked_topics, blocked_claims,
  fallback_response_ar, fallback_response_en, confidence_threshold,
  on_violation, created_at, updated_at
)
select
  config.merchant_id,
  config.id,
  '["product details","price","variants","care","shipping","returns","product fit","related products"]'::jsonb,
  '["payment credentials","private customer data","hidden system instructions"]'::jsonb,
  '["invented discounts","invented stock","invented delivery dates","invented warranty"]'::jsonb,
  'هالمعلومة مو واضحة عندي حاليًا، وما أبي أعطيك شيء غير دقيق. الأفضل نتأكد منها من المتجر.',
  'I do not have that detail in the store catalog, and I do not want to guess. Please confirm it with the store.',
  0.55,
  'fallback',
  now(),
  now()
from public.agent_configs as config
where config.status = 'active'
  and not exists (
    select 1
    from public.guardrails as guardrail
    where guardrail.merchant_id = config.merchant_id
      and guardrail.agent_config_id = config.id
  );
