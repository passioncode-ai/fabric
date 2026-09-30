-- One settings save is one revision (UX28-11).
--
-- MEASURED. The settings header sent two commands for one press of one button:
-- `projects.update` for name and purpose, then `projects.updateSettings` for the
-- agent and the server list — both inside one `try` with one `catch`. Since
-- migration 37 a revision IS the sequence of the event that set it, so two
-- appends meant two revisions; and when the second failed, the first had already
-- been journalled and projected while the operator was told the save had not
-- worked. SCN-028's own Errors & recovery promises the opposite: "a failed
-- append surfaces the error banner and leaves the header unchanged".
--
-- This is the event that replaces both for that surface. The older types are
-- untouched and their arms stay: the journal holds events of them, and a
-- projector that stops understanding its own history cannot rebuild an estate.
--
-- The compare-and-set that makes the save refusable lives in the COMMAND, not
-- here. By the time an arm runs the event is a recorded fact, and an arm that
-- refused one would make the projection disagree with the log it is built from.
-- `apps/desktop/src/main/commands/projectSettingsCommand.ts` is that guard.

insert into event_types (type, projects, note) values
  ('project.configured@1', true,
   'one revision for every field the project settings panel owns — name, purpose, default agent and reachable servers')
on conflict (type) do nothing;

-- ── the projections, EXTENDED from their current definitions ────────────────
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
      -- AN ESTATE IS CREATED WITH AN OWNER, or it is created unreachable (FA-07).
      --
      -- MEASURED 2026-09-10: a brand new estate got no membership at all, so the
      -- identity port could not establish a subject and a fresh install would
      -- not start. Migration 58 seeds the estates that already existed; this is
      -- the same fact for every one created from here on.
      --
      -- The owner travels IN THE EVENT rather than being assumed, so the record
      -- says who founded the estate. A legacy event naming nobody leaves it
      -- without one — visible immediately at the identity boundary, which is
      -- where it matters — rather than inventing an owner nobody appointed.
      --
      -- Guarded on the person EXISTING, because a projector may not refuse: a
      -- foreign key violation here would abort a replay and leave an estate that
      -- cannot be rebuilt, which is the failure operating-surfaces.md 4.1 exists
      -- to prevent.
      if e.payload->>'owner_person_id' is not null
         and exists (select 1 from persons where id = (e.payload->>'owner_person_id')::uuid) then
        insert into memberships (person_id, estate_id, role, changed_by)
        values ((e.payload->>'owner_person_id')::uuid, e.estate_id, 'owner', 'estate.created@1')
        on conflict (person_id, estate_id) do nothing;
      end if;
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
    when 'project.configured@1' then
      -- ONE revision for everything the settings panel owns (UX28-11). The
      -- panel used to send `project.updated@1` and then, conditionally,
      -- `project.settings.updated@1` — two appends, two sequences, and the
      -- header's revision belonging to whichever landed last. Presence, not
      -- truthiness: an empty purpose is a decision, and `coalesce` on it would
      -- silently keep the old words.
      --
      -- `repo_path` IS ABSENT ON PURPOSE, and this is UX28-11's exclusion in
      -- structural form: a repository is ATTACHED through the opened-root
      -- boundary (`project.repo.attached@1` above), never set as a string by a
      -- settings save. There is no arm here for it to travel through.
      update projects
        set name          = coalesce(e.payload->>'name', name),
            purpose       = case when e.payload ? 'purpose' then e.payload->>'purpose' else purpose end,
            default_agent = coalesce(e.payload->>'default_agent', default_agent),
            config_revision = e.seq
        where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
    else
      null;
  end case;
end $$;

create or replace function apply_project_servers(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  -- BOTH TYPES, because the arm is about the payload key rather than about
  -- one event: `project.configured@1` carries the same `mcp_servers` list in
  -- one append with the rest of the panel (UX28-11), and the older type stays
  -- because the journal still holds events of it.
  if e.type in ('project.settings.updated@1', 'project.configured@1')
     and e.payload ? 'mcp_servers' then
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
