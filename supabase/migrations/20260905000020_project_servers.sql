-- Which MCP servers this project's sessions may reach (M127).
--
-- A session sees Fabric's tools and nothing else today: the bundle writes one
-- server and launches with `--strict-mcp-config`. That is a good default and a
-- dead end, because an agent that needs Linear or Sentry cannot have it.
--
-- The declaration lives on the PROJECT rather than on the agent descriptor,
-- because it is an authority decision and the operator owns it: the same agent
-- is trusted with different things in different projects. When M125 lets an
-- agent be created from a prompt, what it ASKS for is checked against this list
-- rather than replacing it.
--
-- Names only. No credential is stored here or anywhere in Fabric: a granted
-- server is reached through the machine's gateway, which holds the upstream key
-- at mode 600 and applies a role key per hop. Writing a key into a session
-- bundle is the superset `agent-composition.md` §4 forbids, and `servers.ts`
-- refuses it by design rather than leaving it unimplemented.

alter table projects
  add column if not exists mcp_servers text[] not null default '{}';

comment on column projects.mcp_servers is
  'Server names this project may reach through the machine gateway. Names only —
   never a credential. An empty array is the default and means Fabric only.';

-- The projector clause. `project.settings.updated@1` already carries the other
-- two settings; this joins them by the same rule — an absent key leaves the
-- value alone, so a settings write that mentions one field does not blank the
-- rest.
create or replace function apply_project_servers(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if e.type = 'project.settings.updated@1' and e.payload ? 'mcp_servers' then
    update projects
       set mcp_servers = coalesce(
             (select array_agg(value::text order by ordinality)
                from jsonb_array_elements_text(e.payload->'mcp_servers')
                     with ordinality as t(value, ordinality)),
             '{}')
     where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
  end if;
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
end;
$$;

-- P12: CREATE OR REPLACE resets EXECUTE to PUBLIC every single time.
revoke execute on function apply_projections(journal) from public;
revoke execute on function apply_projections(journal) from anon, authenticated, service_role;
revoke execute on function apply_project_servers(journal) from public;
revoke execute on function apply_project_servers(journal) from anon, authenticated, service_role;
