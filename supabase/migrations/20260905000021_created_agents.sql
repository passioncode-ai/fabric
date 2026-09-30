-- An agent created from a prompt (M125).
--
-- `agents.ts` predicted this migration and named its trigger: "the projector
-- branch for agent.registered@1 stays deliberately empty… return trigger: the
-- first agent that must exist without a release." This is that agent, and the
-- distinction that lets the prediction come true WITHOUT the registry moving is
-- one the note did not draw:
--
--   A RUNNER is a program on this machine. It names a binary and the flags that
--   binary understands, so it ships with the app and stays code in `agents.ts`.
--   Nothing there grows.
--
--   AN AGENT is a named configuration of a runner: what it is for, what it may
--   reach, which permission mode it launches in. That is created at runtime and
--   is what these rows hold.
--
-- REUSING `agent_bindings` RATHER THAN ADDING A TABLE. ADR-0010 already made a
-- binding the unit: a provider bound to a role inside a project. A created agent
-- is exactly that — `role` is the name the operator picks it by, `provider_ref`
-- is the runner it runs in — so the columns added here are the three the org
-- chart never needed and a created agent cannot do without.

alter table agent_bindings
  add column if not exists instructions    text,
  add column if not exists mcp_servers     text[] not null default '{}',
  add column if not exists permission_mode text,
  add column if not exists created_by      text;

comment on column agent_bindings.mcp_servers is
  'What this agent ASKS to reach. The project''s own list is a ceiling, not a
   default: an agent gets what it asked for, and a request outside the ceiling
   refuses the launch rather than being trimmed (agentSpec.ts, ADR-0034).';

-- The branch that was left empty on purpose, filled for the reason it named.
create or replace function apply_created_agents(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if e.type <> 'agent.registered@1' then return; end if;

  insert into agent_bindings (
    id, estate_id, project_id, role, provider_ref, status,
    instructions, mcp_servers, permission_mode, created_by, created_at)
  values (
    (e.payload->>'id')::uuid, e.estate_id, (e.payload->>'project_id')::uuid,
    e.payload->>'name', e.payload->>'runner_id', 'active',
    e.payload->>'instructions',
    coalesce((select array_agg(value::text order by ordinality)
                from jsonb_array_elements_text(e.payload->'mcp_servers')
                     with ordinality as t(value, ordinality)), '{}'),
    e.payload->>'permission_mode', e.actor->>'id', e.occurred_at)
  -- Replay-safe: rebuilding the estate must not double an agent, and the id
  -- comes from the event rather than from the row's default for that reason.
  on conflict (id) do nothing;
end;
$$;

create or replace function apply_projections(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform apply_projections_legacy(e);
  perform apply_operating_surfaces(e);
  perform apply_move_provenance(e);
  perform apply_project_servers(e);
  perform apply_created_agents(e);
end;
$$;

-- P12, every time.
revoke execute on function apply_projections(journal) from public;
revoke execute on function apply_projections(journal) from anon, authenticated, service_role;
revoke execute on function apply_created_agents(journal) from public;
revoke execute on function apply_created_agents(journal) from anon, authenticated, service_role;
