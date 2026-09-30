-- Who moved this task, and why the same column means two things (M124).
--
-- The board renders a column position and says nothing about who put the card
-- there. For `review` that is not a cosmetic gap: an AGENT moving work to review
-- is saying "I believe this is done", and an OPERATOR moving it there is saying
-- "come back and look at this". Same cell, opposite meanings, and the product's
-- whole thesis is that an agent's account of its work is a claim rather than an
-- outcome. A status with no provenance is a claim with no owner.
--
-- The actor was in the journal from the first day and the projection dropped it.
-- It is materialised here rather than derived per card because that is what this
-- projection is FOR: the board must render without walking the journal once per
-- task. The task page has its own receipts and could derive it; two derivations
-- of one fact is how they start disagreeing, so both read these columns.
--
-- `moved_by_kind` is the load-bearing half. The id is who; the KIND is whether
-- the sentence beside the card is a claim or a decision.

alter table project_tasks
  add column if not exists moved_by      text,
  add column if not exists moved_by_kind text,
  add column if not exists moved_at      timestamptz;

comment on column project_tasks.moved_by_kind is
  'person or agent. An agent cannot reach done or cancelled (ladder.ts); if this
   column ever says otherwise for a terminal status the surface SHOWS it rather
   than normalising it — the journal is the record and a projection may not
   quietly disagree with it (operating-surfaces.md 4.1).';

-- Backfill, so existing cards are not blank about their own history. The last
-- move wins: `seq` is the journal's order and there is no other.
with last_move as (
  select distinct on (e.payload->>'task_id')
         (e.payload->>'task_id')::uuid as task_id,
         e.actor->>'id'                as actor_id,
         e.actor->>'kind'              as actor_kind,
         e.occurred_at
    from journal e
   where e.type in ('task.moved@1', 'task.closed@1')
     and e.payload->>'task_id' is not null
   order by e.payload->>'task_id', e.seq desc
)
update project_tasks t
   set moved_by = l.actor_id, moved_by_kind = l.actor_kind, moved_at = l.occurred_at
  from last_move l
 where t.id = l.task_id;

-- The projector clause, added as its own function rather than by rewriting
-- `apply_operating_surfaces` whole. Copying that body into this file to change
-- three lines would put two versions of a hundred-line CASE in the repository,
-- and the older one would be the one somebody reads.
--
-- THE GUARD IS THE DESIGN. Provenance is written only where the status is
-- ALREADY the one the event asked for — that is, where the move actually
-- landed. A projection clause can refuse (the status guards above), and
-- recording "moved by an agent at 11:04" beside a state that never changed
-- would be a receipt for something that did not happen.
create or replace function apply_move_provenance(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if e.payload->>'task_id' is null then return; end if;

  if e.type = 'task.moved@1' then
    update project_tasks
       set moved_by      = e.actor->>'id',
           moved_by_kind = e.actor->>'kind',
           moved_at      = e.occurred_at
     where id = (e.payload->>'task_id')::uuid
       and status = e.payload->>'to';

  elsif e.type = 'task.closed@1' then
    update project_tasks
       set moved_by      = e.actor->>'id',
           moved_by_kind = e.actor->>'kind',
           moved_at      = e.occurred_at
     where id = (e.payload->>'task_id')::uuid
       and status in ('done', 'cancelled');
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
end;
$$;

-- P12 again, and it will be true of every migration that replaces a function:
-- CREATE OR REPLACE resets EXECUTE to PUBLIC, reopening the door migration 6
-- closed. The probe in `packages/schema` runs on every migration for this
-- reason; the revokes are not optional tidying.
revoke execute on function apply_projections(journal) from public;
revoke execute on function apply_projections(journal) from anon, authenticated, service_role;
revoke execute on function apply_move_provenance(journal) from public;
revoke execute on function apply_move_provenance(journal) from anon, authenticated, service_role;
