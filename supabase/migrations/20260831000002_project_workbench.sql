-- Migration 2 — the project workbench.
--   project.updated@1        the project card is editable (name, purpose, repo_path)
--   memory.project.recorded@1  project memory v0: facts with a source, FTS-searchable
-- Both are journal event types with synchronous upsert projectors (ADR-0027 §3);
-- memory_facts is a projection, never a hand-edited store (federation.md §5).

create table memory_facts (
  id         uuid primary key,
  estate_id  uuid not null,
  project_id uuid not null,
  claim      text not null,
  source_ref text,
  kind       text not null default 'note',
  recorded_at timestamptz not null default now(),
  seq        bigint not null,
  search     tsvector generated always as (to_tsvector('english', claim)) stored
);
create index memory_facts_project on memory_facts(project_id);
create index memory_facts_estate  on memory_facts(estate_id);
create index memory_facts_search  on memory_facts using gin(search);

alter table memory_facts enable row level security;

create policy member_memory_read on memory_facts
  for select to authenticated
  using (estate_id in (select member_estates()));

grant select on memory_facts to authenticated;
grant select, insert, update, delete on memory_facts to service_role;

-- Extend the projector with the two new types. Replacing the function keeps one
-- projection home; the case list is the register of what projects what.
create or replace function apply_projections(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  case e.type
    when 'estate.created@1' then
      insert into estates (id, name, created_at)
      values (e.estate_id, coalesce(e.payload->>'name', 'unnamed estate'), e.occurred_at)
      on conflict (id) do update set name = excluded.name;
    when 'project.created@1' then
      insert into projects (id, estate_id, name, purpose, repo_path, created_at)
      values ((e.payload->>'id')::uuid, e.estate_id,
              e.payload->>'name', e.payload->>'purpose', e.payload->>'repo_path',
              e.occurred_at)
      on conflict (id) do update
        set name = excluded.name, purpose = excluded.purpose,
            repo_path = excluded.repo_path;
    when 'project.updated@1' then
      -- Partial update: only the keys present in the payload move. coalesce on the
      -- jsonb key (not on the value) so clearing a field to null stays possible.
      update projects
        set name      = coalesce(e.payload->>'name', name),
            purpose   = case when e.payload ? 'purpose'   then e.payload->>'purpose'   else purpose end,
            repo_path = case when e.payload ? 'repo_path' then e.payload->>'repo_path' else repo_path end,
            config_revision = config_revision + 1
        where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
    when 'project.archived@1' then
      update projects
        set status = 'archived', archived_at = e.occurred_at
        where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
    when 'memory.project.recorded@1' then
      insert into memory_facts (id, estate_id, project_id, claim, source_ref, kind, recorded_at, seq)
      values ((e.payload->>'id')::uuid, e.estate_id, e.project_id,
              e.payload->>'claim', e.payload->>'source_ref',
              coalesce(e.payload->>'kind', 'note'), e.occurred_at, e.seq)
      on conflict (id) do update
        set claim = excluded.claim, source_ref = excluded.source_ref, kind = excluded.kind;
    else
      -- terminal.opened@1 / terminal.closed@1 project nothing yet; the feed reads
      -- the journal directly (ADR-0027 §2).
      null;
  end case;
end $$;

-- Rebuild covers the new projection too (upsert-replay, no deletes: FKs).
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
