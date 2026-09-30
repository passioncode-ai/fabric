-- A revision is the event that set it, not a counter (M198).
--
-- FILED BY THE PROBE THAT FOUND IT. P24 rebuilds both estates and compares every
-- projection by hash; `projects.config_revision` had to be EXCLUDED, because the
-- projector did
--
--     config_revision = config_revision + 1
--
-- and replaying an event increments again. A rebuilt estate reported a different
-- revision than the one it had — so the strongest guarantee the projector has,
-- that a rebuild reproduces the state exactly, could not be asserted on that
-- column. The exclusion was recorded as a finding rather than as a convenience,
-- and this is that finding closed.
--
-- WHY `e.seq` AND NOT A COUNT. Three reasons, and the first is decisive:
--
--   it is deterministic BY CONSTRUCTION. Counting the config events up to this
--   one would also be deterministic, and it would need the projector to hold a
--   list of which event types count as configuration — a list that drifts away
--   from the arms that actually change the row.
--
--   the system contract already says what a Revision is: an opaque equality
--   token, compared and never arithmetic. A sequence number is exactly that.
--
--   it answers "which event changed this" for free. A counter says the row moved
--   twice; a seq says which append did it.
--
-- WHAT CHANGES FOR A READER: the number is large rather than small. Nothing
-- compares two revisions for distance — the two consumers use it as a cache key
-- and the third displays it — so the only cost is the label, which is corrected
-- in the same change to say what the number is.

create or replace function apply_estate_and_projects(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_next_primary uuid;
begin
  case e.type
    when 'estate.created@1' then
      insert into estates (id, name, created_at)
      values (e.estate_id, coalesce(e.payload->>'name', 'unnamed estate'), e.occurred_at)
      on conflict (id) do update set name = excluded.name;
    when 'project.created@1' then
      insert into projects (id, estate_id, name, purpose, repo_path, created_at,
                            memory_backend, default_agent)
      values ((e.payload->>'id')::uuid, e.estate_id,
              e.payload->>'name', e.payload->>'purpose', e.payload->>'repo_path',
              e.occurred_at,
              coalesce(e.payload->>'memory_backend', 'local'),
              coalesce(e.payload->>'default_agent', 'claude-code'))
      on conflict (id) do update
        set name = excluded.name, purpose = excluded.purpose,
            repo_path = excluded.repo_path,
            memory_backend = excluded.memory_backend,
            default_agent = excluded.default_agent;
    when 'project.updated@1' then
      update projects
        set name      = coalesce(e.payload->>'name', name),
            purpose   = case when e.payload ? 'purpose'   then e.payload->>'purpose'   else purpose end,
            repo_path = case when e.payload ? 'repo_path' then e.payload->>'repo_path' else repo_path end,
            config_revision = e.seq
        where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
    when 'project.settings.updated@1' then
      update projects
        set memory_backend = coalesce(e.payload->>'memory_backend', memory_backend),
            default_agent  = coalesce(e.payload->>'default_agent', default_agent),
            config_revision = e.seq
        where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
    when 'project.archived@1' then
      update projects
        set status = 'archived', archived_at = e.occurred_at
        where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
    when 'project.repo.attached@1' then
      insert into project_repos (id, estate_id, project_id, path, label, is_primary, attached_at)
      values ((e.payload->>'id')::uuid, e.estate_id, e.project_id,
              e.payload->>'path', e.payload->>'label',
              coalesce((e.payload->>'is_primary')::boolean, false), e.occurred_at)
      on conflict (id) do update set path = excluded.path, label = excluded.label;
      if not exists (select 1 from project_repos where project_id = e.project_id and is_primary) then
        update project_repos set is_primary = true where id = (e.payload->>'id')::uuid
               and estate_id = e.estate_id;
      end if;
      update projects
        set repo_path = (select path from project_repos
                          where project_id = e.project_id and is_primary limit 1)
        where id = e.project_id
             and estate_id = e.estate_id;
    when 'project.repo.detached@1' then
      delete from project_repos where id = (e.payload->>'id')::uuid and project_id = e.project_id
             and estate_id = e.estate_id;
      if not exists (select 1 from project_repos where project_id = e.project_id and is_primary) then
        select id into v_next_primary from project_repos
          where project_id = e.project_id order by attached_at limit 1;
        if v_next_primary is not null then
          update project_repos set is_primary = true where id = v_next_primary
                 and estate_id = e.estate_id;
        end if;
      end if;
      update projects
        set repo_path = (select path from project_repos
                          where project_id = e.project_id and is_primary limit 1)
        where id = e.project_id
             and estate_id = e.estate_id;
    else
      null;
  end case;
end $$;
revoke execute on function apply_estate_and_projects(journal) from public;
revoke execute on function apply_estate_and_projects(journal) from anon, authenticated, service_role;
