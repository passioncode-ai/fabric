-- An import lands whole or not at all (S12).
--
-- MEASURED BEFORE THIS: `importWorkspace` appended events in a loop — one RPC
-- per project, then one per settings row, then one per agent. A file that went
-- wrong on its last row, a network blip, or the process closing left an estate
-- holding every project before the failure and none of the agents. The refusal
-- the operator then read named a problem in a file that had already been half
-- applied, and there was no way back: the events were in the journal, which is
-- append-only by design (ADR-0014).
--
-- The fix is not a smaller loop. It is ONE transaction, so the crash window
-- closes: either every event is in the journal or none is.
--
-- IT RECHECKS EMPTINESS UNDER A LOCK. The old check ran in the client, minutes
-- before the writes; two imports started together both saw an empty estate and
-- both proceeded. Here the check and the writes are the same transaction.

create or replace function import_declared_snapshot(
  p_estate_id   uuid,
  p_command_id  uuid,
  p_input_digest text,
  p_actor       jsonb,
  p_events      jsonb
)
returns journal
language plpgsql
security definer set search_path = public
as $$
declare
  ev      jsonb;
  receipt journal;
  n       int := 0;
begin
  if jsonb_typeof(p_events) <> 'array' then
    raise exception 'an import takes an array of events' using errcode = 'invalid_parameter_value';
  end if;

  -- IDEMPOTENT BY COMMAND. A retry after a timeout must not import twice, and
  -- the client cannot tell a lost response from a lost request.
  select * into receipt from journal
   where estate_id = p_estate_id
     and type = 'estate.imported@1'
     and payload->>'command_id' = p_command_id::text
   limit 1;
  if found then return receipt; end if;

  -- The lock is on the estate row, so two imports racing serialise here rather
  -- than both finding an empty estate and both proceeding.
  perform 1 from estates where id = p_estate_id for update;

  if exists (select 1 from projects where estate_id = p_estate_id) then
    raise exception 'this estate already holds projects. Importing over them would be a merge nobody has specified — which id wins, and what happens to the work hanging off a project in both. Import into an empty estate.'
      using errcode = 'check_violation';
  end if;

  for ev in select * from jsonb_array_elements(p_events)
  loop
    perform append_event(
      p_estate_id,
      ev->>'type',
      p_actor,
      coalesce(ev->'payload', '{}'::jsonb),
      '1',
      nullif(ev->>'project_id', '')::uuid
    );
    n := n + 1;
  end loop;

  -- The receipt is an EVENT, not a table. "What was imported, from what, and
  -- when" is estate history and belongs on the spine like everything else.
  select * into receipt from append_event(
    p_estate_id,
    'estate.imported@1',
    p_actor,
    jsonb_build_object(
      'command_id', p_command_id,
      'input_digest', p_input_digest,
      'events', n,
      -- Written down because the claim ages: a folder imported today under this
      -- coverage may be read next year as though it had held everything.
      'coverage_note', 'the declared mirror carries projects and agent bindings only'
    )
  );
  return receipt;
end;
$$;

insert into event_types (type, projects, note) values
  ('estate.imported@1', false,
   'a declared workspace was imported into an empty estate, in one transaction')
on conflict (type) do nothing;

revoke execute on function import_declared_snapshot(uuid, uuid, text, jsonb, jsonb) from public;
revoke execute on function import_declared_snapshot(uuid, uuid, text, jsonb, jsonb) from anon;
grant execute on function import_declared_snapshot(uuid, uuid, text, jsonb, jsonb) to service_role;
