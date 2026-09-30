-- One task hands the next a named thing (slice 3).
--
-- The links already said WHICH task comes after which. What none of them said is
-- WHAT travels: a follower started with the same blank brief whether its
-- predecessor produced a report, a refusal, or nothing.
--
-- TWO SHAPES, and the split is the design. `task_links.needs` is what the
-- follower DECLARES it requires — part of the plan, written when the chain is
-- drawn. `task_handoffs` is what a predecessor actually PRODUCED — part of the
-- record, written when the work happens. Keeping them in one place would make a
-- plan and a result indistinguishable, and the whole question at a chain
-- boundary is whether what was promised arrived.

alter table task_links
  add column if not exists needs text[] not null default '{}';

comment on column task_links.needs is
  'Named inputs the FOLLOWER requires, for a `follows` link. A step whose input
   is missing does not run and says which — an empty value under the right name
   is missing too, because that is the shape a well-meaning agent produces.';

create table if not exists task_handoffs (
  estate_id  uuid not null,
  project_id uuid not null,
  task_id    uuid not null,
  name       text not null,
  value      text not null,
  produced_by text,
  created_at timestamptz not null default now(),
  primary key (task_id, name)
);

alter table task_handoffs enable row level security;

create policy member_handoffs_read on task_handoffs
  for select to authenticated
  using (estate_id in (select member_estates()));

grant select on task_handoffs to authenticated;
grant select, insert, update, delete on task_handoffs to service_role;

insert into event_types (type, projects, note) values
  ('task.handoff@1', true, 'a task produced a named value for whatever follows it (slice 3)')
on conflict (type) do nothing;

create or replace function apply_handoffs(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if e.type <> 'task.handoff@1' then return; end if;
  insert into task_handoffs (estate_id, project_id, task_id, name, value, produced_by, created_at)
  values (e.estate_id, e.project_id, (e.payload->>'task_id')::uuid,
          e.payload->>'name', e.payload->>'value', e.actor->>'id', e.occurred_at)
  -- Handing the same name twice REPLACES it. A step that corrects itself before
  -- finishing is ordinary; two values under one name would make the follower's
  -- input depend on which row a query happened to read first.
  on conflict (task_id, name) do update
    set value = excluded.value, produced_by = excluded.produced_by, created_at = excluded.created_at;
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
  perform apply_routines(e);
  perform apply_proposals(e);
  perform apply_handoffs(e);
end;
$$;

revoke execute on function apply_projections(journal) from public;
revoke execute on function apply_projections(journal) from anon, authenticated, service_role;
revoke execute on function apply_handoffs(journal) from public;
revoke execute on function apply_handoffs(journal) from anon, authenticated, service_role;

-- THE COLUMN WITHOUT ITS WRITER. The clause above adds `needs` to `task_links`,
-- and the projector that fills that table was written before the column existed:
-- it lists its columns explicitly, so a new one arrives at its default and the
-- names the event carried are dropped on the way in. Caught by a probe whose
-- three failures all had this one cause — the rules were right and the wiring
-- lost the data, which is the shape a fixture cannot see.
--
-- Handled here rather than by rewriting `apply_operating_surfaces` whole: that
-- body is a hundred-line CASE and copying it to change one statement would put
-- two versions of it in the repository.
create or replace function apply_link_needs(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if e.type <> 'task.linked@1' or e.payload->'needs' is null then return; end if;
  update task_links
     set needs = coalesce(
           (select array_agg(value::text order by ordinality)
              from jsonb_array_elements_text(e.payload->'needs')
                   with ordinality as t(value, ordinality)),
           '{}')
   where task_id    = (e.payload->>'task_id')::uuid
     and rel         = e.payload->>'rel'
     and target_kind = e.payload->>'target_kind'
     and target_id   = (e.payload->>'target_id')::uuid;
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
  perform apply_routines(e);
  perform apply_proposals(e);
  perform apply_handoffs(e);
  perform apply_link_needs(e);
end;
$$;

revoke execute on function apply_projections(journal) from public;
revoke execute on function apply_projections(journal) from anon, authenticated, service_role;
revoke execute on function apply_link_needs(journal) from public;
revoke execute on function apply_link_needs(journal) from anon, authenticated, service_role;
