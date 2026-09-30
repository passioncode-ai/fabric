-- The operating surfaces get their data layer (docs/architecture/operating-surfaces.md).
--
-- Two decisions here were forced by working the plan, not by taste, and both are
-- stated so the next reader does not "simplify" them back into defects:
--
--   1. ZERO-COPY PROJECTOR. apply_projections has been rewritten whole in ten
--      migrations (M97); adding ten branches would grow the monolith at its
--      worst moment. Instead the deployed body is RENAMED to
--      apply_projections_legacy — its text never moves — and the new
--      apply_projections calls it, then apply_operating_surfaces for the new
--      vocabulary. The status ladder is normalised by a post-fix in the SAME
--      transaction, because a CHECK cannot be deferred and the legacy branches
--      still write the old three values transiently. A probe asserts no row at
--      rest ever holds them. M97's real split retires the legacy vocabulary.
--
--   2. DETERMINISTIC LEASE REPLAY. An expired-lease takeover compares against
--      e.occurred_at, never now(): a claim that succeeded live must succeed
--      identically when rebuild_estate_projections replays the journal.
--      A claim is a COMMAND, not a fact: `coordination.schema.json` is titled
--      "command or event", and this is why. The tool refuses the obvious case
--      before appending, which is what an agent meets almost every time; but
--      two agents that read "free" in the same instant both append, and THIS
--      projection is the arbiter — the second one's update is refused because
--      the first lease is live. The tool then reads the lease back and tells
--      the loser the truth. Deciding it in the tool alone would be a check
--      with no lock behind it.

-- ── vocabulary ───────────────────────────────────────────────────────────────
insert into event_types (type, projects, note) values
  ('task.created@1',       true, 'a task exists before anything runs (M79); origin is REQUIRED — a card with no evidence is refused at the tool'),
  ('task.assigned@1',      true, 'who put it there and on whom — provenance as fields, not convention (M130)'),
  ('task.moved@1',         true, 'one state transition on the board; the board renders ONLY what the journal accepted'),
  ('task.closed@1',        true, 'done or cancelled; cancelling REQUIRES a reason — a task that vanished without one is a lost decision'),
  ('task.linked@1',        true, 'blocks / follows / spawned, task-to-task or task-to-goal; the DAG trigger refuses a cycle at write time (M91)'),
  ('task.note.added@1',    true, 'append-only working context of one task; never knowledge — that is what promotion is for'),
  ('task.note.promoted@1', true, 'the note LEFT for project memory; the task keeps a link, never a copy'),
  ('task.brief.edited@1',  true, 'operator override of an agent-drafted brief section; the draft stays readable'),
  ('work.claimed@1',       true, 'the contract''s coordination claim, journalled: work, owner, idempotency key, expiry, write scopes'),
  ('work.renewed@1',       true, 'the lease holder extends its expiry'),
  ('work.released@1',      true, 'released with an outcome: succeeded / failed / cancelled / expired / abandoned'),
  ('goal.defined@1',       true, 'a goal with its autonomy level (fills the goals table that shipped empty in migration 1)'),
  ('task.prioritised@1',   true, 'order within a goal is a FIELD on the task, not a screen''s opinion'),
  ('agent.registered@1',   true, 'an agent descriptor joins the registry (M116/M17)')
on conflict (type) do nothing;

-- ── project_tasks grows into the board ──────────────────────────────────────
alter table project_tasks
  add column if not exists title         text,
  add column if not exists task_type     text,
  add column if not exists section       text,
  add column if not exists goal_id       uuid references goals(id),
  add column if not exists position      integer,
  add column if not exists origin_kind   text,
  add column if not exists origin_ref    text,
  add column if not exists assigned_by   text,
  add column if not exists assigned_to   text,
  add column if not exists brief_what    text,
  add column if not exists brief_why     text,
  add column if not exists brief_expected text,
  add column if not exists brief_author  text,
  add column if not exists brief_draft   jsonb,
  add column if not exists closed_reason text;

-- the ladder: existing rows are mapped, THEN the check widens.
-- 'open'/'finished'/'abandoned' remain legal only because the legacy projector
-- writes them transiently inside a transaction; the post-fix in
-- apply_operating_surfaces normalises before commit, and a probe holds the
-- at-rest count of the legacy three to zero.
alter table project_tasks drop constraint project_tasks_status_check;
update project_tasks set status = 'running'   where status = 'open';
update project_tasks set status = 'done'      where status = 'finished';
update project_tasks set status = 'cancelled',
                         closed_reason = coalesce(abandoned_reason, 'unknown')
                         where status = 'abandoned';
alter table project_tasks add constraint project_tasks_status_check
  check (status in ('backlog','running','review','done','cancelled',
                    'open','finished','abandoned'));
alter table project_tasks alter column status set default 'running';

-- ── task notes: append-only by construction ─────────────────────────────────
create table task_notes (
  id               uuid primary key,
  estate_id        uuid not null,
  project_id       uuid not null,
  task_id          uuid not null references project_tasks(id),
  author_kind      text not null check (author_kind in ('person','agent','system')),
  author_id        text not null,
  body_md          text not null,
  promoted_fact_id uuid,
  seq              bigint not null,
  created_at       timestamptz not null default now()
);
create index task_notes_task on task_notes (task_id, created_at);
alter table task_notes enable row level security;
-- Append-only for every ROLE; the security-definer projector is the only writer
-- of promoted_fact_id, exactly as the journal's own write boundary works.
--
-- THIS PAIR WAS NOT ENOUGH, and migration 17 says so: TRUNCATE is a privilege
-- of its own that `revoke update, delete` never touches, and a newly created
-- table inherits it by default — so anon could empty this table while the
-- comment above called it append-only. Append-only means no UPDATE, no DELETE
-- and no TRUNCATE, or it means nothing.
grant select, insert on task_notes to service_role;
revoke update, delete on task_notes from service_role, authenticated, anon;

-- ── task links: a DAG, refused at write time ────────────────────────────────
create table task_links (
  estate_id   uuid not null,
  project_id  uuid not null,
  task_id     uuid not null references project_tasks(id),
  rel         text not null check (rel in ('blocks','follows','spawned')),
  target_kind text not null check (target_kind in ('task','goal')),
  target_id   uuid not null,
  seq         bigint not null,
  primary key (task_id, rel, target_kind, target_id)
);
create index task_links_target on task_links (target_kind, target_id);
alter table task_links enable row level security;
grant select, insert, delete on task_links to service_role;

-- The cycle check is a FUNCTION first and a trigger second, because the two
-- callers need different answers to the same question.
--
-- Learned the hard way in this migration's own probe: when the check lived only
-- in a trigger, a cyclic edge that reached the journal made
-- `rebuild_estate_projections` abort — permanently. The estate could never be
-- rebuilt again, because replay re-attempted an event the journal had already
-- accepted and the trigger refused it every time. A PROJECTION MAY NOT REFUSE
-- WHAT THE JOURNAL ACCEPTED (ADR-0014): the journal is the truth and the
-- projection is derived from it, so a guard belongs at the write boundary.
--
-- So: the tool asks this function BEFORE appending and refuses to the caller
-- (build step 3); the trigger protects direct table writes; and the projector
-- asks it too, dropping the edge with a WARNING rather than aborting the
-- replay. That drop is reachable only by writing to the journal around the
-- tool — and it is loud rather than silent, because a no-op that reports
-- success is indistinguishable from work.
create or replace function would_close_cycle(p_task_id uuid, p_target_id uuid)
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
declare v_hit uuid;
begin
  if p_task_id = p_target_id then
    return true;
  end if;
  -- can the TARGET already reach the SOURCE? then this edge closes a cycle.
  with recursive walk(task_id, path) as (
    select l.target_id, array[p_target_id, l.target_id]
      from task_links l
     where l.task_id = p_target_id and l.target_kind = 'task'
    union all
    select l.target_id, w.path || l.target_id
      from task_links l
      join walk w on w.task_id = l.task_id
     where l.target_kind = 'task'
       and not l.target_id = any(w.path)
  )
  select task_id into v_hit from walk where task_id = p_task_id limit 1;
  return v_hit is not null;
end;
$$;

create or replace function task_links_refuse_cycle()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.target_kind <> 'task' then
    return new; -- a goal cannot point back at a task; no cycle is possible
  end if;
  if would_close_cycle(new.task_id, new.target_id) then
    raise exception 'edge % -> % would close a cycle', new.task_id, new.target_id;
  end if;
  return new;
end;
$$;

create trigger task_links_dag before insert on task_links
  for each row execute function task_links_refuse_cycle();

-- ── leases: current holders only; history is the journal ────────────────────
create table leases (
  work_id         uuid primary key references project_tasks(id),
  estate_id       uuid not null,
  project_id      uuid not null,
  owner_session   uuid not null,
  idempotency_key text not null,
  expires_at      timestamptz not null,
  write_scopes    text[] not null default '{}',
  claimed_seq     bigint not null
);
create index leases_project on leases (project_id);
alter table leases enable row level security;
grant select, insert, update, delete on leases to service_role;

-- ── the projector: rename, wrap, extend ─────────────────────────────────────
alter function apply_projections(journal) rename to apply_projections_legacy;

create or replace function apply_operating_surfaces(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  case e.type
    -- the ladder post-fix: the legacy body wrote its old vocabulary a statement
    -- ago in this same transaction; rows never rest with it.
    when 'task.started@1' then
      update project_tasks set status = 'running' where id = (e.payload->>'id')::uuid and status = 'open';
    when 'task.finished@1' then
      update project_tasks set status = 'done' where id = (e.payload->>'id')::uuid and status = 'finished';
    when 'task.abandoned@1' then
      -- Not a mere normalisation: the legacy branch guards on status='open',
      -- which no longer exists at rest, so an orphaned RUNNING task would never
      -- close at all — the reconcile suite caught exactly that. This branch IS
      -- the abandon now; the guard still protects a real outcome from damage.
      update project_tasks
        set status = 'cancelled',
            abandoned_reason = coalesce(abandoned_reason, e.payload->>'reason', 'unknown'),
            closed_reason    = coalesce(closed_reason, abandoned_reason, e.payload->>'reason', 'unknown'),
            finished_at      = coalesce(finished_at, e.occurred_at)
        where id = (e.payload->>'id')::uuid
          and status in ('abandoned','backlog','running','review');

    when 'task.created@1' then
      insert into project_tasks (id, estate_id, project_id, instruction, option_id,
                                 status, title, task_type, section,
                                 origin_kind, origin_ref, started_at, seq)
      values ((e.payload->>'id')::uuid, e.estate_id, e.project_id,
              coalesce(e.payload->>'instruction', e.payload->>'title'),
              coalesce(e.payload->>'option_id', ''),
              'backlog',
              e.payload->>'title', e.payload->>'task_type', e.payload->>'section',
              e.payload->'origin'->>'kind', e.payload->'origin'->>'ref',
              e.occurred_at, e.seq)
      on conflict (id) do nothing;
    when 'task.assigned@1' then
      update project_tasks
        set assigned_by = e.payload->>'assigned_by',
            assigned_to = e.payload->>'assigned_to'
        where id = (e.payload->>'task_id')::uuid;
    when 'task.moved@1' then
      update project_tasks set status = e.payload->>'to'
        where id = (e.payload->>'task_id')::uuid
          and status in ('backlog','running','review','done','cancelled');
    when 'task.closed@1' then
      update project_tasks
        set status = case when e.payload->>'outcome' = 'done' then 'done' else 'cancelled' end,
            closed_reason = e.payload->>'reason',
            finished_at = e.occurred_at
        where id = (e.payload->>'task_id')::uuid;
    when 'task.linked@1' then
      -- The projector never refuses; see would_close_cycle's header.
      if e.payload->>'target_kind' <> 'task'
         or not would_close_cycle((e.payload->>'task_id')::uuid, (e.payload->>'target_id')::uuid) then
        insert into task_links (estate_id, project_id, task_id, rel, target_kind, target_id, seq)
        values (e.estate_id, e.project_id, (e.payload->>'task_id')::uuid,
                e.payload->>'rel', e.payload->>'target_kind', (e.payload->>'target_id')::uuid, e.seq)
        on conflict do nothing;
      else
        raise warning 'task.linked@1 at seq %: edge % -> % dropped, it closes a cycle',
          e.seq, e.payload->>'task_id', e.payload->>'target_id';
      end if;
    when 'task.note.added@1' then
      insert into task_notes (id, estate_id, project_id, task_id, author_kind, author_id, body_md, seq, created_at)
      values ((e.payload->>'note_id')::uuid, e.estate_id, e.project_id,
              (e.payload->>'task_id')::uuid, e.actor->>'kind', e.actor->>'id',
              e.payload->>'body_md', e.seq, e.occurred_at)
      on conflict (id) do nothing;
    when 'task.note.promoted@1' then
      update task_notes set promoted_fact_id = (e.payload->>'fact_id')::uuid
        where id = (e.payload->>'note_id')::uuid and promoted_fact_id is null;
    when 'task.brief.edited@1' then
      update project_tasks
        set brief_what     = case when e.payload->>'section' = 'what'     then e.payload->>'body_md' else brief_what end,
            brief_why      = case when e.payload->>'section' = 'why'      then e.payload->>'body_md' else brief_why end,
            brief_expected = case when e.payload->>'section' = 'expected' then e.payload->>'body_md' else brief_expected end,
            brief_author   = (e.actor->>'kind') || ':' || (e.actor->>'id'),
            brief_draft    = case when brief_draft is null and e.actor->>'kind' = 'agent'
                                  then jsonb_build_object('section', e.payload->>'section', 'body_md', e.payload->>'body_md')
                                  else brief_draft end
        where id = (e.payload->>'task_id')::uuid;

    when 'work.claimed@1' then
      insert into leases (work_id, estate_id, project_id, owner_session,
                          idempotency_key, expires_at, write_scopes, claimed_seq)
      values ((e.payload->>'work')::uuid, e.estate_id, e.project_id,
              (e.payload->>'owner')::uuid, e.payload->>'idempotency_key',
              (e.payload->>'expires_at')::timestamptz,
              coalesce(array(select jsonb_array_elements_text(e.payload->'write_scopes')), '{}'),
              e.seq)
      on conflict (work_id) do update
        set owner_session = excluded.owner_session,
            idempotency_key = excluded.idempotency_key,
            expires_at = excluded.expires_at,
            write_scopes = excluded.write_scopes,
            claimed_seq = excluded.claimed_seq
        -- deterministic on replay: the takeover is judged against the event's
        -- own clock, never the wall clock.
        where leases.expires_at <= e.occurred_at;
    when 'work.renewed@1' then
      update leases set expires_at = (e.payload->>'expires_at')::timestamptz
        where work_id = (e.payload->>'work')::uuid
          and owner_session = (e.payload->>'owner')::uuid;
    when 'work.released@1' then
      delete from leases
        where work_id = (e.payload->>'work')::uuid
          and owner_session = (e.payload->>'owner')::uuid;

    when 'goal.defined@1' then
      insert into goals (id, project_id, title, autonomy)
      values ((e.payload->>'id')::uuid, e.project_id, e.payload->>'title',
              coalesce(e.payload->>'autonomy', 'safe'))
      on conflict (id) do nothing;
    when 'task.prioritised@1' then
      update project_tasks
        set goal_id = (e.payload->>'goal_id')::uuid,
            position = (e.payload->>'position')::integer
        where id = (e.payload->>'task_id')::uuid;

    when 'agent.registered@1' then
      -- Still nothing, and step 6 decided so ON PURPOSE rather than deferring
      -- again. The registry is `apps/desktop/src/shared/agents.ts`: code, not
      -- rows, because a row would let an agent be added at runtime and that is
      -- M17's job, which is not scheduled. A table nobody writes to is a schema
      -- pretending to be a feature. Return trigger: the first agent that must
      -- exist without a release.

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
end;
$$;

-- CREATE OR REPLACE RESETS PRIVILEGES TO THE DEFAULT, and the default is
-- EXECUTE to PUBLIC. Migration 6 closed this door deliberately — "a projection
-- can be written with no event" is the whole failure it prevents — and
-- replacing the function reopened it. Caught by `packages/schema`'s P12 probe,
-- which exists for exactly this and which is the reason it runs on every
-- migration rather than once.
--
-- Every function this migration creates or replaces is closed here, including
-- the two new ones: `would_close_cycle` is only a read, but a security-definer
-- function reachable by anon is a surface, and surfaces are what get audited.
revoke execute on function apply_projections(journal) from public;
revoke execute on function apply_projections(journal) from anon, authenticated, service_role;
revoke execute on function apply_projections_legacy(journal) from public;
revoke execute on function apply_projections_legacy(journal) from anon, authenticated, service_role;
revoke execute on function apply_operating_surfaces(journal) from public;
revoke execute on function apply_operating_surfaces(journal) from anon, authenticated, service_role;
revoke execute on function would_close_cycle(uuid, uuid) from public;
revoke execute on function would_close_cycle(uuid, uuid) from anon, authenticated;
-- ...and handed back to service_role explicitly, because this one has a REAL
-- caller: `fabric_task_link` asks it before appending, which is the write
-- boundary §4.1 puts the guard at. Revoking from PUBLIC removes the implicit
-- grant service_role inherits through it, so the grant must be restated. The
-- first version of this block did not, and the probe answered `null` from the
-- RPC within a minute — an over-broad revoke caught by the thing it broke.
grant execute on function would_close_cycle(uuid, uuid) to service_role;
revoke execute on function task_links_refuse_cycle() from public;
revoke execute on function task_links_refuse_cycle() from anon, authenticated, service_role;
