-- Where a hand-off stops and a person starts (M68).
--
-- The runaway M68 names is not a bug in any step: developer finishes → validator
-- runs → validator files fixes → developer. Every hand-off is one an agent is
-- allowed to make, and the whole thing never stops. Discovered in production, it
-- costs money for as long as nobody looks.
--
-- At the bound the next result becomes a PROPOSAL rather than another task —
-- ADR-0029's route, with the operator as the only person there is yet. These
-- rows are that proposal. They are deliberately NOT tasks: a proposal on the
-- board would be a task by another name, and the bound would have done nothing
-- except rename the thing it was supposed to stop.

create table if not exists proposals (
  id           uuid primary key,
  estate_id    uuid not null,
  project_id   uuid not null,
  /** What the agent wanted to file. */
  title        text not null,
  origin_kind  text,
  origin_ref   text,
  /** The chain that produced it, so the operator can see how far it travelled. */
  from_task_id uuid,
  depth        int  not null,
  bound        int  not null,
  proposed_by  text not null,
  /** null while it is waiting. Accepting creates the task and records its id. */
  decided_at   timestamptz,
  decision     text check (decision in ('accepted', 'declined')),
  task_id      uuid,
  created_at   timestamptz not null default now()
);

create index if not exists proposals_open on proposals (project_id) where decided_at is null;

insert into event_types (type, projects, note) values
  ('proposal.filed@1',    true, 'a hand-off reached the loop bound and became a proposal instead of a task (M68)'),
  ('proposal.decided@1',  true, 'the operator accepted or declined a proposal; accepting creates the task')
on conflict (type) do nothing;

create or replace function apply_proposals(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  case e.type
    when 'proposal.filed@1' then
      insert into proposals (id, estate_id, project_id, title, origin_kind, origin_ref,
                             from_task_id, depth, bound, proposed_by, created_at)
      values ((e.payload->>'id')::uuid, e.estate_id, (e.payload->>'project_id')::uuid,
              e.payload->>'title', e.payload->'origin'->>'kind', e.payload->'origin'->>'ref',
              nullif(e.payload->>'from_task_id','')::uuid,
              (e.payload->>'depth')::int, (e.payload->>'bound')::int,
              e.actor->>'id', e.occurred_at)
      on conflict (id) do nothing;

    when 'proposal.decided@1' then
      update proposals
         set decided_at = e.occurred_at,
             decision   = e.payload->>'decision',
             task_id    = nullif(e.payload->>'task_id','')::uuid
       where id = (e.payload->>'id')::uuid and decided_at is null;

    else
      null;
  end case;
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
end;
$$;

revoke execute on function apply_projections(journal) from public;
revoke execute on function apply_projections(journal) from anon, authenticated, service_role;
revoke execute on function apply_proposals(journal) from public;
revoke execute on function apply_proposals(journal) from anon, authenticated, service_role;
