-- Migration 4 — tasks: what the operator asked for, and what it opened.
--   task.started@1   an instruction the operator wrote, the agent chosen, the session it opened
--   task.finished@1  recorded when that session ends, carrying the exit code
-- A task in v1 is deliberately thin: it is the text plus the session it produced,
-- not a tracked work item with steps. Steps arrive with the agent runtime (slice 3),
-- when a task becomes a Run over a graph (ADR-0030) — this table is its ancestor and
-- keeps the same identity so the history survives that upgrade.

create table project_tasks (
  id           uuid primary key,
  estate_id    uuid not null,
  project_id   uuid not null,
  instruction  text not null,
  option_id    text not null,
  session_id   uuid,
  preset       text,
  status       text not null default 'open' check (status in ('open', 'finished')),
  exit_code    integer,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  seq          bigint not null
);
create index project_tasks_project on project_tasks(project_id, started_at desc);
create index project_tasks_estate  on project_tasks(estate_id);
create index project_tasks_session on project_tasks(session_id);

alter table project_tasks enable row level security;

create policy member_tasks_read on project_tasks
  for select to authenticated
  using (estate_id in (select member_estates()));

grant select on project_tasks to authenticated;
grant select, insert, update, delete on project_tasks to service_role;

create or replace function apply_projections(e journal)
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
            config_revision = config_revision + 1
        where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
    when 'project.settings.updated@1' then
      update projects
        set memory_backend = coalesce(e.payload->>'memory_backend', memory_backend),
            default_agent  = coalesce(e.payload->>'default_agent', default_agent),
            config_revision = config_revision + 1
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
        update project_repos set is_primary = true where id = (e.payload->>'id')::uuid;
      end if;
      update projects
        set repo_path = (select path from project_repos
                          where project_id = e.project_id and is_primary limit 1)
        where id = e.project_id;
    when 'project.repo.detached@1' then
      delete from project_repos where id = (e.payload->>'id')::uuid and project_id = e.project_id;
      if not exists (select 1 from project_repos where project_id = e.project_id and is_primary) then
        select id into v_next_primary from project_repos
          where project_id = e.project_id order by attached_at limit 1;
        if v_next_primary is not null then
          update project_repos set is_primary = true where id = v_next_primary;
        end if;
      end if;
      update projects
        set repo_path = (select path from project_repos
                          where project_id = e.project_id and is_primary limit 1)
        where id = e.project_id;
    when 'task.started@1' then
      insert into project_tasks (id, estate_id, project_id, instruction, option_id,
                                 session_id, preset, started_at, seq)
      values ((e.payload->>'id')::uuid, e.estate_id, e.project_id,
              e.payload->>'instruction', e.payload->>'option_id',
              nullif(e.payload->>'session_id', '')::uuid,
              e.payload->>'preset', e.occurred_at, e.seq)
      on conflict (id) do update
        set instruction = excluded.instruction, option_id = excluded.option_id,
            session_id = excluded.session_id, preset = excluded.preset;
    when 'task.session.attached@1' then
      update project_tasks
        set session_id = (e.payload->>'session_id')::uuid
        where id = (e.payload->>'id')::uuid;
    when 'task.finished@1' then
      update project_tasks
        set status = 'finished',
            exit_code = nullif(e.payload->>'exit_code', '')::integer,
            -- a spawn that never started carries no code, and that is the record
            finished_at = e.occurred_at
        where id = (e.payload->>'id')::uuid;
    when 'memory.project.recorded@1' then
      insert into memory_facts (id, estate_id, project_id, claim, source_ref, kind, recorded_at, seq)
      values ((e.payload->>'id')::uuid, e.estate_id, e.project_id,
              e.payload->>'claim', e.payload->>'source_ref',
              coalesce(e.payload->>'kind', 'note'), e.occurred_at, e.seq)
      on conflict (id) do update
        set claim = excluded.claim, source_ref = excluded.source_ref, kind = excluded.kind;
    else
      -- terminal.* and project.kickoff@1 project nothing; the feed reads the journal
      -- directly (ADR-0027 §2).
      null;
  end case;
end $$;

create or replace function rebuild_estate_projections(p_estate_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare e journal;
begin
  for e in select * from journal where estate_id = p_estate_id order by seq loop
    perform apply_projections(e);
  end loop;
end $$;
