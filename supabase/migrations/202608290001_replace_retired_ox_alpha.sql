begin;

update public.platform_agent_config
set
  model_provider = 'openrouter',
  model_name = 'z-ai/glm-5.3-flash',
  updated_at = now(),
  updated_by = 'system:model-retirement'
where singleton_key = 'global';

update public.agent_configs
set
  model_provider = 'openrouter',
  model_name = 'z-ai/glm-5.3-flash',
  updated_at = now()
where status = 'active';

commit;
