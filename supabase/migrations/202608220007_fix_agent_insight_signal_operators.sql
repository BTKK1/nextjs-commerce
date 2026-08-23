-- Repair operator precedence in the live atomic agent-turn function.
-- Without explicit parentheses, PostgreSQL evaluates part of the advisory-lock
-- text concatenation before jsonb extraction and raises SQLSTATE 42883 whenever
-- a real shopper turn creates an insight signal.

do $migration$
declare
  original_definition text;
  patched_definition text;
begin
  select pg_get_functiondef(
    'public.persist_agent_turn_atomic(uuid,uuid,text,text,uuid,boolean,text,text,text,text,text,jsonb,jsonb,timestamptz)'::regprocedure
  ) into original_definition;

  patched_definition := replace(
    original_definition,
    'target_merchant_id::text || '':'' || target_product_id::text || '':'' || signal ->> ''type'' || '':'' || signal ->> ''category''',
    'target_merchant_id::text || '':'' || target_product_id::text || '':'' || (signal ->> ''type'') || '':'' || (signal ->> ''category'')'
  );
  patched_definition := replace(
    patched_definition,
    'insight_type = signal ->> ''type''',
    'insight_type = (signal ->> ''type'')'
  );
  patched_definition := replace(
    patched_definition,
    'metadata_json ->> ''category'' = signal ->> ''category''',
    '(metadata_json ->> ''category'') = (signal ->> ''category'')'
  );

  if patched_definition = original_definition
     and position('|| signal ->>' in original_definition) > 0 then
    raise exception 'Could not repair persist_agent_turn_atomic operator precedence.';
  end if;

  if patched_definition <> original_definition then
    execute patched_definition;
  end if;
end;
$migration$;
