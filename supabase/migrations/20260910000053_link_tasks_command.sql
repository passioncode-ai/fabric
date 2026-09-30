-- Linking two tasks is ONE act, not a question followed by a write (FA-04).
--
-- MEASURED 2026-09-09 against the live stack, at `fabric_task_link`:
--
--   const { data: closes } = await db.rpc('would_close_cycle', {...})
--   if (closes === true) return json({ linked: false, ... })
--   await this.appendRedacted({ type: 'task.linked@1', ... })
--
-- THREE failures, and the third is the one nobody would have looked for.
--
--  1. FAIL-OPEN. `error` is destructured away. A failing check returns
--     `data: null`; `null === true` is false; the append happens anyway.
--     Measured: "check unavailable -> data = null, error present = true; the
--     guard evaluates to false -> it APPENDS." The guard is present exactly
--     when the database is healthy and gone the moment it is not.
--
--  2. CHECK-THEN-APPEND. The answer is computed in one round trip and spent in
--     another. Measured with two clients asking together: BOTH saw
--     `closes = false`, and both wrote.
--
--  3. AND THE JOURNAL AND THE BOARD THEN DISAGREED. That race appended TWO
--     `task.linked@1` events and the board held ONE edge, because the projector
--     drops a cyclic edge with a WARNING rather than aborting a replay. So the
--     estate's history recorded something its projection does not contain, and
--     the only record of the divergence was a Postgres warning. An event that
--     produces no row is invisible to every surface in the product.
--
-- THE LOCK ALREADY EXISTED and the check stood outside it. `append_event` takes
-- `pg_advisory_xact_lock` on the estate and runs the projector in the same
-- transaction. Everything needed to make this atomic was there; the check was
-- simply in the client, one round trip too early. This command takes that same
-- lock BEFORE it asks, so asking and writing are one indivisible act.
--
-- AND A FOURTH, from the vocabulary rather than the concurrency. `spawned` is
-- PROVENANCE — this task came out of that one, a fact about the past that
-- cannot be false about the future. `blocks` and `follows` are DEPENDENCY —
-- claims about what may run next, and only those can form a queue nobody can
-- act on. `would_close_cycle` walked all three as one graph, so measured: a
-- parent that blocks its child made "this child was spawned by that parent"
-- report as a cycle. A true statement about history, refused for the topology
-- of a different graph. ADR-0053 records the split.

-- ── which edges can close a queue at all ────────────────────────────────────
create or replace function link_is_dependency(p_rel text)
returns boolean
language sql
immutable
as $$ select p_rel in ('blocks', 'follows') $$;

comment on function link_is_dependency(text) is
  'ADR-0053. blocks/follows are dependency edges and form the DAG; spawned is provenance and is never refused for topology.';

-- ── the cycle question, asked of the dependency graph only ──────────────────
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
  -- `link_is_dependency` on BOTH arms. A provenance edge is not a step in a
  -- queue, so it cannot be part of a loop in one, and walking through it made
  -- history contribute to a topology it says nothing about.
  with recursive walk(task_id, path) as (
    select l.target_id, array[p_target_id, l.target_id]
      from task_links l
     where l.task_id = p_target_id and l.target_kind = 'task'
       and link_is_dependency(l.rel)
    union all
    select l.target_id, w.path || l.target_id
      from task_links l
      join walk w on w.task_id = l.task_id
     where l.target_kind = 'task'
       and link_is_dependency(l.rel)
       and not l.target_id = any(w.path)
  )
  select task_id into v_hit from walk where task_id = p_task_id limit 1;
  return v_hit is not null;
end;
$$;

-- ── the trigger protects direct writes, and knows the same split ────────────
create or replace function task_links_refuse_cycle()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.target_kind <> 'task' then
    return new; -- a goal cannot point back at a task; no cycle is possible
  end if;
  if not link_is_dependency(new.rel) then
    return new; -- provenance: a record of what happened, never a claim about what may run
  end if;
  if would_close_cycle(new.task_id, new.target_id) then
    raise exception 'edge % -> % would close a cycle', new.task_id, new.target_id;
  end if;
  return new;
end;
$$;

-- ── the projector's arm, as its own concern ─────────────────────────────────
--
-- The projector NEVER refuses: a replay that aborts leaves an estate that
-- cannot be rebuilt, which is a worse failure than a dropped edge. What changed
-- is that it can now see the rel, so a provenance edge is written rather than
-- warned away.
create or replace function apply_task_link(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if e.payload->>'target_kind' <> 'task'
     or not link_is_dependency(e.payload->>'rel')
     or not would_close_cycle((e.payload->>'task_id')::uuid, (e.payload->>'target_id')::uuid) then
    insert into task_links (estate_id, project_id, task_id, rel, target_kind, target_id, seq)
    values (e.estate_id, e.project_id, (e.payload->>'task_id')::uuid,
            e.payload->>'rel', e.payload->>'target_kind', (e.payload->>'target_id')::uuid, e.seq)
    on conflict do nothing;
  else
    -- Reachable ONLY by writing to the journal around `link_tasks`. Through the
    -- command this cannot happen: the check and the append are under one lock.
    raise warning 'task.linked@1 at seq %: edge % -> % dropped, it closes a cycle',
      e.seq, e.payload->>'task_id', e.payload->>'target_id';
  end if;
end;
$$;

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
      update project_tasks set status = 'running' where id = (e.payload->>'id')::uuid and status = 'open'
             and estate_id = e.estate_id;
    when 'task.finished@1' then
      update project_tasks set status = 'done' where id = (e.payload->>'id')::uuid and status = 'finished'
             and estate_id = e.estate_id;
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
          and status in ('abandoned','backlog','running','review')
             and estate_id = e.estate_id;

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
        where id = (e.payload->>'task_id')::uuid
             and estate_id = e.estate_id;
    when 'task.moved@1' then
      update project_tasks set status = e.payload->>'to'
        where id = (e.payload->>'task_id')::uuid
          and status in ('backlog','running','review','done','cancelled')
             and estate_id = e.estate_id;
    when 'task.closed@1' then
      update project_tasks
        set status = case when e.payload->>'outcome' = 'done' then 'done' else 'cancelled' end,
            closed_reason = e.payload->>'reason',
            finished_at = e.occurred_at
        where id = (e.payload->>'task_id')::uuid
             and estate_id = e.estate_id;
    when 'task.linked@1' then
      -- One concern, one function (CLAUDE.md). The arm used to hold the DAG
      -- rule inline and could not see the REL, so a provenance edge was tested
      -- against a dependency graph.
      perform apply_task_link(e);
    when 'task.note.added@1' then
      insert into task_notes (id, estate_id, project_id, task_id, author_kind, author_id, body_md, seq, created_at)
      values ((e.payload->>'note_id')::uuid, e.estate_id, e.project_id,
              (e.payload->>'task_id')::uuid, e.actor->>'kind', e.actor->>'id',
              e.payload->>'body_md', e.seq, e.occurred_at)
      on conflict (id) do nothing;
    when 'task.note.promoted@1' then
      update task_notes set promoted_fact_id = (e.payload->>'fact_id')::uuid
        where id = (e.payload->>'note_id')::uuid and promoted_fact_id is null
             and estate_id = e.estate_id;
    when 'task.brief.edited@1' then
      update project_tasks
        set brief_what     = case when e.payload->>'section' = 'what'     then e.payload->>'body_md' else brief_what end,
            brief_why      = case when e.payload->>'section' = 'why'      then e.payload->>'body_md' else brief_why end,
            brief_expected = case when e.payload->>'section' = 'expected' then e.payload->>'body_md' else brief_expected end,
            brief_author   = (e.actor->>'kind') || ':' || (e.actor->>'id'),
            brief_draft    = case when brief_draft is null and e.actor->>'kind' = 'agent'
                                  then jsonb_build_object('section', e.payload->>'section', 'body_md', e.payload->>'body_md')
                                  else brief_draft end
        where id = (e.payload->>'task_id')::uuid
             and estate_id = e.estate_id;

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
          and owner_session = (e.payload->>'owner')::uuid
             and estate_id = e.estate_id;
    when 'work.released@1' then
      delete from leases
        where work_id = (e.payload->>'work')::uuid
          and owner_session = (e.payload->>'owner')::uuid
             and estate_id = e.estate_id;

    when 'task.prioritised@1' then
      update project_tasks
        set goal_id = (e.payload->>'goal_id')::uuid,
            position = (e.payload->>'position')::integer
        where id = (e.payload->>'task_id')::uuid
             and estate_id = e.estate_id;

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

-- ── the command ─────────────────────────────────────────────────────────────
--
-- Scope, topology and the append under ONE lock. Every writer calls this; none
-- of them appends `task.linked@1` itself any more, because a second door is a
-- second set of rules that will diverge from these on the day somebody is in a
-- hurry.
--
-- THE PAYLOAD IS BUILT HERE, from typed parameters. Nothing an agent wrote
-- travels into the event, so there is no free text to redact — a stronger
-- guarantee than scrubbing one, and the reason these callers may stop going
-- through the redaction door without losing anything.
create or replace function link_tasks(
  p_estate_id  uuid,
  p_task_id    uuid,
  p_rel        text,
  p_target_id  uuid,
  p_actor      jsonb,
  p_project_id uuid default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  src project_tasks;
  dst project_tasks;
  ev  journal;
begin
  if p_rel is null or p_rel not in ('blocks', 'follows', 'spawned') then
    return jsonb_build_object('linked', false, 'reason_code', 'unknown_rel',
      'says', format('%s is not a kind of link', coalesce(p_rel, 'null')),
      'remedy', 'Use blocks, follows or spawned.');
  end if;

  if p_task_id = p_target_id then
    return jsonb_build_object('linked', false, 'reason_code', 'self',
      'says', 'a task cannot be linked to itself',
      'remedy', 'Name the other task.');
  end if;

  -- THE LOCK, taken before the first question. `append_event` takes this same
  -- lock, and an advisory transaction lock is re-entrant, so from here to the
  -- commit nothing else in this estate can insert a link between these answers
  -- and this write. This single line is the whole of FA-04's concurrency fix.
  perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text, 4242));

  select * into src from project_tasks where estate_id = p_estate_id and id = p_task_id;
  if not found then
    return jsonb_build_object('linked', false, 'reason_code', 'not_found',
      'says', 'no such task in this estate');
  end if;

  -- The SAME answer for "there is no such task" and "that task belongs to
  -- another estate", deliberately. A distinct refusal would let anyone holding
  -- one estate discover which ids exist in another, one guess at a time.
  select * into dst from project_tasks where estate_id = p_estate_id and id = p_target_id;
  if not found then
    return jsonb_build_object('linked', false, 'reason_code', 'not_found',
      'says', 'no such task in this estate');
  end if;

  if src.project_id <> dst.project_id then
    return jsonb_build_object('linked', false, 'reason_code', 'cross_project',
      'says', 'those two tasks are in different projects',
      'remedy', 'A link orders work inside one project; move the task first if that is what you mean.');
  end if;

  -- THE CALLER'S OWN SCOPE, when it has one. An agent working inside a project
  -- may order that project's work and nothing else; without this an agent
  -- scoped to one project could reorder another's queue in the same estate,
  -- which is the scope floor S02 puts on every read and which a write must not
  -- be looser about than a read.
  if p_project_id is not null and src.project_id <> p_project_id then
    return jsonb_build_object('linked', false, 'reason_code', 'out_of_scope',
      'says', 'those tasks are not in the project you are working in');
  end if;

  -- Idempotent by the edge itself rather than by a key nobody keeps. Saying the
  -- same true thing twice is not an error and must not become a second event:
  -- the journal is what happened, and this did not happen twice.
  if exists (
    select 1 from task_links
     where estate_id = p_estate_id and task_id = p_task_id
       and rel = p_rel and target_kind = 'task' and target_id = p_target_id
  ) then
    return jsonb_build_object('linked', true, 'already', true, 'reason_code', 'exists',
      'says', 'that link is already recorded');
  end if;

  if link_is_dependency(p_rel) and would_close_cycle(p_task_id, p_target_id) then
    return jsonb_build_object('linked', false, 'reason_code', 'cycle',
      'says', format('that link would close a cycle: %s already leads back to %s', p_target_id, p_task_id),
      'remedy', 'A board where A waits for B waits for A is one nobody can act on. Break the other edge first.');
  end if;

  ev := append_event(
    p_estate_id, 'task.linked@1', p_actor,
    jsonb_build_object('task_id', p_task_id, 'rel', p_rel,
                       'target_kind', 'task', 'target_id', p_target_id),
    '1', coalesce(p_project_id, src.project_id)
  );

  return jsonb_build_object('linked', true, 'seq', ev.seq, 'reason_code', 'linked');
end;
$$;

comment on function link_tasks(uuid, uuid, text, uuid, jsonb, uuid) is
  'FA-04. The only writer of task.linked@1: scope, topology and append under one estate lock; every refusal is a typed reason_code.';

revoke execute on function link_tasks(uuid, uuid, text, uuid, jsonb, uuid) from public;
revoke execute on function link_tasks(uuid, uuid, text, uuid, jsonb, uuid) from anon, authenticated;
grant  execute on function link_tasks(uuid, uuid, text, uuid, jsonb, uuid) to service_role;

revoke execute on function apply_task_link(journal) from public;
revoke execute on function apply_task_link(journal) from anon, authenticated;
grant  execute on function apply_task_link(journal) to service_role;
