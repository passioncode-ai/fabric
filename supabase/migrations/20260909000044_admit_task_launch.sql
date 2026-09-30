-- Starting an existing task, and admission as its own act (S04).
--
-- MEASURED BEFORE THIS, and it explains why S04 blocks half the queue: NOTHING
-- COULD START A TASK THAT ALREADY EXISTS. Every launch path called `startTask`,
-- which appends a fresh `task.started@1` — a new task, every time. So:
--
--   · a task sitting on the Board at `backlog` could never be run at all;
--   · the blocking set S06 computes was consulted NOWHERE before a launch,
--     because the only launch made a brand-new task, which by definition has
--     no blockers. Two open questions on a task did not stop anything;
--   · `leases` existed and nothing claimed one, so two launches of the same
--     task would both proceed;
--   · `idea.research` did not launch the idea's task — it created a SECOND
--     task carrying a brief.
--
-- ADMISSION IS SEPARATE FROM CREATION, and that is the shape the card asks for.
-- Creating work and admitting it to run are different decisions made by
-- different people at different times, and collapsing them is why the first
-- could only ever happen at the moment of the second.
--
-- THE RECEIPT IS THE POINT. A refusal names WHY in a code a surface can act on,
-- and is recorded — "why did this not start" is answerable after the window is
-- closed.

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

insert into event_types (type, projects, note) values
  ('task.admitted@1', true,
   'an existing task was admitted to run: nonterminal, unblocked, and holding the only launch lease')
on conflict (type) do nothing;

revoke execute on function admit_task_launch(uuid, uuid, jsonb, uuid, text) from public;
revoke execute on function admit_task_launch(uuid, uuid, jsonb, uuid, text) from anon;
grant execute on function admit_task_launch(uuid, uuid, jsonb, uuid, text) to service_role;
