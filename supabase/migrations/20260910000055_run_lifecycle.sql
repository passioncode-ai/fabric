-- A run that was admitted ends, and it ends once (AX-01).
--
-- MEASURED at d28c321, and the table was the only part that existed:
--
--   · `task_runs` has five states, an outcome vocabulary, an
--     `outcome_only_when_ended` constraint, an `ended_has_a_receipt`
--     constraint, and a trigger refusing to reopen an ended run;
--   · `run.ended@1` is a registered event type with a projector arm, an
--     immutability rule and a sentence in both string registries;
--   · and NOTHING IN THE RUNTIME HAS EVER APPENDED ONE. Zero producers in
--     `apps/desktop/src/main` and `apps/desktop/src/preload`. Every admitted run
--     stays `admitted` for ever, and the estate's account of what it did is a
--     list of things that started.
--
-- THE SESSION ON THE RUN IS NOT THE SESSION THAT RAN. `admit_task_launch` mints
-- a session id BEFORE the spawn, because admission has to happen before anything
-- runs, and the projector writes that id onto the run. The pty then mints its
-- own. The operator's Run path re-points the LEASE at the real session and
-- nothing re-points the RUN, so `task_runs.session_id` names a session that
-- never existed — and every later question asked by session id (deliveries,
-- acknowledgements, an exit) misses.
--
-- AND THE UPGRADE TRAP, which is the reason the first statement below exists.
-- Commit `242eeb8` added the run's birth to migration 44 — a migration that was
-- ALREADY DEPLOYED. Supabase records 44 as applied and never re-runs it, so an
-- estate created before that commit has an `admit_task_launch` that admits a
-- task and creates no run at all, for ever, while a fresh bootstrap gets one.
-- The two databases disagree and neither reports anything wrong. Re-declaring
-- the function here is append-only and idempotent: a fresh database gets the
-- same text twice, an upgraded one gets it for the first time.

create or replace function admit_task_launch(
  p_estate_id  uuid,
  p_task_id    uuid,
  p_actor      jsonb,
  p_session_id uuid,
  p_trigger    text default 'operator'
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  t         project_tasks;
  blockers  int;
  held      leases;
  receipt   journal;
  v_run     uuid;
  v_ordinal int;
begin
  select * into t from project_tasks
   where estate_id = p_estate_id and id = p_task_id
   for update;
  if not found then
    return jsonb_build_object('admitted', false, 'reason_code', 'not_found',
      'says', 'no such task in this estate');
  end if;

  -- A closed task does not reopen (ADR ladder). Work that resumes is new work
  -- with its own origin.
  if t.status in ('done', 'cancelled', 'finished', 'abandoned') then
    return jsonb_build_object('admitted', false, 'reason_code', 'terminal',
      'says', format('that task is %s, and a closed task does not reopen', t.status),
      'remedy', 'File the follow-up as new work, so what happened here stays whole.');
  end if;

  if t.status = 'running' then
    return jsonb_build_object('admitted', false, 'reason_code', 'already_running',
      'says', 'that task is already running',
      'remedy', 'Open its session rather than starting a second one.');
  end if;

  -- THE BLOCKING SET, asked at the seam that matters. S06 computed it and
  -- nothing consulted it: a task with two unanswered questions could be
  -- launched, and the agent would arrive at the same wall the questions were
  -- asked about.
  perform recompute_task_blockers(p_estate_id, p_task_id);
  select count(*) into blockers
    from question_blocks qb
    join questions q on q.estate_id = qb.estate_id and q.id = qb.question_id
   where qb.estate_id = p_estate_id and qb.task_id = p_task_id
     and q.answered_at is null;
  if blockers > 0 then
    return jsonb_build_object('admitted', false, 'reason_code', 'blocked',
      'says', format('that task is waiting on %s unanswered question(s)', blockers),
      'remedy', 'Answer them on the board. Starting it now sends an agent to the wall the question is about.',
      'open_blockers', blockers);
  end if;

  -- ONE LAUNCH AT A TIME, by a lease rather than by hoping. Two windows, or a
  -- window and the routine tick, could otherwise both start the same task.
  select * into held from leases
   where estate_id = p_estate_id and work_id = p_task_id and expires_at > now();
  if found then
    return jsonb_build_object('admitted', false, 'reason_code', 'lease_held',
      'says', 'another launch of this task is already in flight',
      'remedy', 'Wait for it, or cancel it. Two launches of one task produce two agents editing the same files.');
  end if;

  delete from leases where estate_id = p_estate_id and work_id = p_task_id;
  insert into leases (estate_id, project_id, work_id, owner_session, idempotency_key,
                      expires_at, write_scopes, claimed_seq)
  values (p_estate_id, t.project_id, p_task_id, p_session_id, p_session_id,
          now() + interval '10 minutes', array['task'], coalesce(t.seq, 0));

  -- M188 — THE RUN IS BORN HERE, and only here. A denied admission is no run:
  -- refusing to start is not a run that failed, and counting it as one makes
  -- every refusal look like an attempt the operator authorised.
  --
  -- The ordinal is DERIVED under the lock taken above rather than chosen, so
  -- two concurrent admissions cannot both be "attempt 2".
  select coalesce(max(run_ordinal), 0) + 1 into v_ordinal
    from task_runs where estate_id = p_estate_id and task_id = p_task_id;
  v_run := gen_random_uuid();

  perform append_event(
    p_estate_id, 'run.started@1', p_actor,
    jsonb_build_object('task_run_id', v_run, 'task_id', p_task_id,
                       'run_ordinal', v_ordinal, 'session_id', p_session_id),
    '1', t.project_id
  );

  select * into receipt from append_event(
    p_estate_id, 'task.admitted@1', p_actor,
    jsonb_build_object('task_id', p_task_id, 'session_id', p_session_id,
                       'trigger', p_trigger, 'task_run_id', v_run),
    '1', t.project_id, v_run
  );

  return jsonb_build_object('admitted', true, 'task_id', p_task_id,
    'project_id', t.project_id, 'instruction', t.instruction,
    'option_id', t.option_id, 'receipt_seq', receipt.seq,
    'task_run_id', v_run, 'run_ordinal', v_ordinal);
end;
$$;
-- ── the run is attached to the session that actually ran ────────────────────
insert into event_types (type, projects, note) values
  ('run.bound@1', true,
   'a run was attached to the session that actually ran it, replacing the id minted before the spawn')
on conflict (type) do nothing;

create or replace function bind_task_run(
  p_estate_id  uuid,
  p_run_id     uuid,
  p_session_id uuid,
  p_actor      jsonb
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare r task_runs;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text, 4242));

  select * into r from task_runs
   where estate_id = p_estate_id and task_run_id = p_run_id;
  if not found then
    return jsonb_build_object('bound', false, 'reason_code', 'not_found',
      'says', 'no such run in this estate');
  end if;

  -- An ENDED run does not gain a session. Its account of itself is closed, and
  -- a late binding would be a fact about the past arriving after the record was
  -- sealed.
  if r.state = 'ended' then
    return jsonb_build_object('bound', false, 'reason_code', 'ended',
      'says', 'that run has ended, and an ended run does not take a new session');
  end if;

  -- THE OLD GENERATION GUARD. A run already bound to a different live session is
  -- a second spawn for one admission; binding again would move the run onto a
  -- process nobody authorised and leave the first one running unattached.
  if r.session_id is not null and r.session_id <> p_session_id and r.state = 'active' then
    return jsonb_build_object('bound', false, 'reason_code', 'already_bound',
      'says', 'that run is already attached to another session',
      'remedy', 'End it before attaching a second process to one admission.');
  end if;

  perform append_event(
    p_estate_id, 'run.bound@1', p_actor,
    jsonb_build_object('task_run_id', p_run_id, 'task_id', r.task_id,
                       'session_id', p_session_id),
    '1', r.project_id, p_run_id
  );
  return jsonb_build_object('bound', true, 'task_run_id', p_run_id,
    'task_id', r.task_id, 'session_id', p_session_id);
end;
$$;

comment on function bind_task_run(uuid, uuid, uuid, jsonb) is
  'AX-01. Attaches an admitted run to the session that actually ran it and moves it to active. Refuses an ended run and a second generation.';

-- ── every admitted run ends, and ends once ──────────────────────────────────
create or replace function end_task_run(
  p_estate_id uuid,
  p_run_id    uuid,
  p_outcome   text,
  p_actor     jsonb,
  p_says      text default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare r task_runs;
begin
  if p_outcome is null or p_outcome not in ('completed', 'failed_known', 'cancelled', 'outcome_unknown') then
    return jsonb_build_object('ended', false, 'reason_code', 'unknown_outcome',
      'says', format('%s is not an outcome a run can end with', coalesce(p_outcome, 'null')));
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text, 4242));

  select * into r from task_runs
   where estate_id = p_estate_id and task_run_id = p_run_id;
  if not found then
    return jsonb_build_object('ended', false, 'reason_code', 'not_found',
      'says', 'no such run in this estate');
  end if;

  -- IDEMPOTENT, and it returns what the run actually ended with rather than
  -- what this caller wanted. Two observers of one ending — an exit handler and
  -- a restart reconciliation — must not turn one run into two accounts of
  -- itself, and the FIRST account is the one that saw it happen.
  if r.state = 'ended' then
    return jsonb_build_object('ended', true, 'already', true,
      'reason_code', 'already_ended', 'outcome', r.outcome,
      'says', format('that run already ended as %s', r.outcome));
  end if;

  perform append_event(
    p_estate_id, 'run.ended@1', p_actor,
    jsonb_build_object('task_run_id', p_run_id, 'task_id', r.task_id,
                       'outcome', p_outcome,
                       'says', coalesce(p_says, '')),
    '1', r.project_id, p_run_id
  );
  return jsonb_build_object('ended', true, 'outcome', p_outcome, 'task_run_id', p_run_id);
end;
$$;

comment on function end_task_run(uuid, uuid, text, jsonb, text) is
  'AX-01. Ends an admitted run exactly once. A second ending returns the first outcome rather than overwriting it.';

-- ── a restart finds the runs whose process nobody can see any more ──────────
--
-- `outcome_unknown` is its own answer and not a failure: the process may have
-- finished perfectly and taken its exit code with it. Recording that honestly is
-- the difference between an estate that says "we do not know" and one that says
-- nothing at all, which is what a run stuck at `admitted` for ever says.
create or replace function reconcile_task_runs(
  p_estate_id uuid,
  p_live      uuid[],
  p_actor     jsonb
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  r       task_runs;
  n       int := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text, 4242));
  for r in
    select * from task_runs
     where estate_id = p_estate_id
       and state <> 'ended'
       and (session_id is null or not (session_id = any(coalesce(p_live, array[]::uuid[]))))
     order by admitted_seq
  loop
    perform append_event(
      p_estate_id, 'run.ended@1', p_actor,
      jsonb_build_object('task_run_id', r.task_run_id, 'task_id', r.task_id,
                         'outcome', 'outcome_unknown',
                         'says', 'the process that held this run is not running here any more'),
      '1', r.project_id, r.task_run_id
    );
    n := n + 1;
  end loop;
  return jsonb_build_object('ended', n);
end;
$$;

comment on function reconcile_task_runs(uuid, uuid[], jsonb) is
  'AX-01. On start, ends every non-ended run whose session this process cannot see, as outcome_unknown.';

revoke execute on function bind_task_run(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function end_task_run(uuid, uuid, text, jsonb, text) from public, anon, authenticated;
revoke execute on function reconcile_task_runs(uuid, uuid[], jsonb) from public, anon, authenticated;
grant execute on function bind_task_run(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function end_task_run(uuid, uuid, text, jsonb, text) to service_role;
grant execute on function reconcile_task_runs(uuid, uuid[], jsonb) to service_role;

-- ── the projector learns the binding ────────────────────────────────────────
--
-- Extended rather than rewritten: the two arms migration 49 wrote are unchanged
-- and a third is added beside them (CLAUDE.md — extend the projector by adding,
-- never by replacing what already projects).
create or replace function apply_task_runs(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_run uuid := nullif(e.payload->>'task_run_id', '')::uuid;
begin
  if v_run is null then return; end if;

  if e.type = 'run.started@1' then
    insert into task_runs (task_run_id, estate_id, project_id, task_id, run_ordinal,
                           state, session_id, admitted_seq)
    values (v_run, e.estate_id, e.project_id, (e.payload->>'task_id')::uuid,
            coalesce((e.payload->>'run_ordinal')::int, 1), 'admitted',
            nullif(e.payload->>'session_id', '')::uuid, e.seq)
    on conflict (task_run_id) do nothing;

  elsif e.type = 'run.bound@1' then
    -- `state <> 'ended'` on the predicate rather than in a branch: the trigger
    -- on this table refuses to reopen an ended run by raising, and a replay must
    -- never abort. A binding that arrives after the ending is DROPPED, which is
    -- the same shape the link projector uses for an edge it cannot accept.
    update task_runs
       set session_id = nullif(e.payload->>'session_id', '')::uuid,
           state = 'active'
     where estate_id = e.estate_id and task_run_id = v_run and state <> 'ended';

  elsif e.type = 'run.ended@1' then
    update task_runs
       set state = 'ended',
           outcome = coalesce(e.payload->>'outcome', 'outcome_unknown'),
           ended_seq = e.seq
     where estate_id = e.estate_id and task_run_id = v_run and state <> 'ended';
  end if;
end;
$$;
