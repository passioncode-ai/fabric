-- Migration 3 — onboarding, project settings, and repositories as a set.
--   project.settings.updated@1   memory backend + default agent, per project
--   project.repo.attached@1      a project may hold several repositories
--   project.repo.detached@1
--   project.kickoff@1            which path the operator took out of onboarding
-- Everything is journal-first with synchronous upsert projectors (ADR-0027 §3);
-- `projects.repo_path` stays as the derived primary repository so nothing that
-- reads it breaks (the desktop launches sessions there).

alter table projects
  add column memory_backend text not null default 'local'
    check (memory_backend in ('local', 'cloud')),
  add column default_agent text not null default 'claude-code';

create table project_repos (
  id          uuid primary key,
  estate_id   uuid not null,
  project_id  uuid not null,
  path        text not null,
  label       text,
  is_primary  boolean not null default false,
  attached_at timestamptz not null default now()
);
create index project_repos_project on project_repos(project_id);
create index project_repos_estate  on project_repos(estate_id);
create unique index project_repos_unique_path on project_repos(project_id, path);

alter table project_repos enable row level security;

create policy member_repos_read on project_repos
  for select to authenticated
  using (estate_id in (select member_estates()));

grant select on project_repos to authenticated;
grant select, insert, update, delete on project_repos to service_role;

-- One primary per project, and it is the one `projects.repo_path` mirrors.
create unique index project_repos_one_primary
  on project_repos(project_id) where is_primary;

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
      -- The first repository attached becomes primary, and primary is what
      -- projects.repo_path mirrors: one derived value, one source.
      if not exists (select 1 from project_repos where project_id = e.project_id and is_primary) then
        update project_repos set is_primary = true where id = (e.payload->>'id')::uuid;
      end if;
      update projects
        set repo_path = (select path from project_repos
                          where project_id = e.project_id and is_primary limit 1)
        where id = e.project_id;
    when 'project.repo.detached@1' then
      delete from project_repos where id = (e.payload->>'id')::uuid and project_id = e.project_id;
      -- Detaching the primary promotes the oldest remaining repository rather
      -- than leaving the project pointing at nothing it still holds.
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
    when 'memory.project.recorded@1' then
      insert into memory_facts (id, estate_id, project_id, claim, source_ref, kind, recorded_at, seq)
      values ((e.payload->>'id')::uuid, e.estate_id, e.project_id,
              e.payload->>'claim', e.payload->>'source_ref',
              coalesce(e.payload->>'kind', 'note'), e.occurred_at, e.seq)
      on conflict (id) do update
        set claim = excluded.claim, source_ref = excluded.source_ref, kind = excluded.kind;
    else
      -- terminal.opened@1 / terminal.closed@1 / project.kickoff@1 project nothing;
      -- the feed reads the journal directly (ADR-0027 §2).
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
