-- The estate a person walks (UX28-14 step 1).
--
-- `supabase/seed.sql` creates the estate and the operator and nothing else, so
-- a walk of onboarding, the task page, a board transition, search and agent
-- selection had nothing to walk: every screen answered with its empty state,
-- which is one state of five and the one least likely to break.
--
-- This journals a known estate through `append_event`, exactly as the product
-- does — no direct table writes, so every row a screen reads was produced by
-- the projector rather than by this file. That matters for the walk: a fixture
-- written straight into `project_tasks` would exercise a projection nobody
-- built.
--
-- IDEMPOTENT ON FIXED IDS. Re-running it appends nothing new — every event is
-- guarded on the row it would produce — so a walk can be repeated after a
-- crash without a second copy of everything, and the working database is never
-- reset to get a clean fixture.
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -f scripts/fixtures/walk-estate.sql
--
-- What it makes, chosen so each scoped screen has something in every state the
-- walk is supposed to observe:
--
-- THE EVENT NAMES COME FROM `event_types`, NOT FROM MEMORY. The first version
-- of this file used `task.filed@1` and `memory.fact.recorded@1`, and the write
-- boundary refused both by name — "unregistered event type … add it to
-- event_types in a migration, together with its projector branch". That refusal
-- is the closed set doing its job, and it is why a fixture is written against
-- the register rather than against what the names ought to be.
--
--   one project with a purpose and no repository — onboarding's alt path;
--   four tasks, one per board column, so a board transition has a card to drag
--     AND a keyboard path to take instead;
--   a task in `review`, which is the state that puts a row in the attention
--     queue, so the CEO panel is not empty;
--   two memory facts and one decision, so search returns hits in more than one
--     store and its per-store headings are all exercised.

-- One task in one state, however many times this file runs.
create or replace function ensure_task(
  p_estate uuid, p_actor jsonb, p_project uuid, p_task uuid,
  p_title text, p_instruction text, p_state text
) returns void
language plpgsql
as $fn$
begin
  if not exists (select 1 from project_tasks where id = p_task) then
    perform append_event(p_estate, 'task.created@1', p_actor,
      jsonb_build_object('id', p_task, 'project_id', p_project,
        'title', p_title, 'instruction', p_instruction), '1', p_project);
  end if;
  -- The ladder is walked one step at a time, because `mayMove` is what the
  -- product enforces and a fixture that jumps states would seed a history the
  -- product cannot produce.
  if p_state <> 'backlog' and (select status from project_tasks where id = p_task) = 'backlog' then
    perform append_event(p_estate, 'task.moved@1', p_actor,
      jsonb_build_object('task_id', p_task, 'project_id', p_project, 'to', 'running'), '1', p_project);
  end if;
  if p_state in ('review', 'done') and (select status from project_tasks where id = p_task) = 'running' then
    perform append_event(p_estate, 'task.moved@1', p_actor,
      jsonb_build_object('task_id', p_task, 'project_id', p_project, 'to', p_state), '1', p_project);
  end if;
end $fn$;

do $$
declare
  org1     constant uuid := '00000000-0000-0000-0000-000000000001';
  -- The person the app runs as (`identity.ts#LOCAL_OPERATOR_PERSON`), whom the seed makes org #1's owner since 0.3.4.
  operator constant jsonb := jsonb_build_object('kind', 'person', 'id', '00000000-0000-0000-0000-00000000000a');
  proj     constant uuid := 'a1000000-0000-0000-0000-000000000001';
  t_backlog constant uuid := 'a2000000-0000-0000-0000-000000000001';
  t_running constant uuid := 'a2000000-0000-0000-0000-000000000002';
  t_review  constant uuid := 'a2000000-0000-0000-0000-000000000003';
  t_done    constant uuid := 'a2000000-0000-0000-0000-000000000004';
  f_one     constant uuid := 'a3000000-0000-0000-0000-000000000001';
  f_two     constant uuid := 'a3000000-0000-0000-0000-000000000002';
  d_one     constant uuid := 'a3000000-0000-0000-0000-000000000003';
begin
  if not exists (select 1 from projects where id = proj) then
    perform append_event(org1, 'project.created@1', operator,
      jsonb_build_object('id', proj, 'name', 'Walk fixture',
        'purpose', 'the estate a person walks for UX28-14'));
  end if;

  -- One task per board column. Created then MOVED, because a task that appears
  -- already in `review` has no history and the walk reads history too.
  --
  -- THE MOVES ARE GUARDED ON THE STATUS, not on the task's existence. The first
  -- version guarded both on `where id = …`, so a task created by an earlier run
  -- was never moved again — and since the move payload also named the task with
  -- `id` instead of `task_id` (the key the projector reads), the update matched
  -- nothing and all four tasks sat in `backlog` while the receipt happily
  -- reported four tasks. Counting rows is not checking them.
  perform ensure_task(org1, operator, proj, t_backlog, 'Waiting in the backlog',
    'nothing has started here', 'backlog');
  perform ensure_task(org1, operator, proj, t_running, 'Being worked on',
    'this one is running', 'running');
  perform ensure_task(org1, operator, proj, t_review, 'Says it is finished',
    'an agent moved this to review and cannot say it is done', 'review');
  perform ensure_task(org1, operator, proj, t_done, 'Finished earlier',
    'this one is closed', 'done');

  -- Two facts and a decision, so search has hits in more than one store.
  if not exists (select 1 from memory_facts where id = f_one) then
    perform append_event(org1, 'memory.project.recorded@1', operator,
      jsonb_build_object('id', f_one, 'project_id', proj, 'kind', 'fact',
        'claim', 'the walk fixture keeps a ledger of what it created'), '1', proj);
  end if;
  if not exists (select 1 from memory_facts where id = f_two) then
    perform append_event(org1, 'memory.project.recorded@1', operator,
      jsonb_build_object('id', f_two, 'project_id', proj, 'kind', 'fact',
        'claim', 'a narrow viewport is a state, not an accident'), '1', proj);
  end if;
  if not exists (select 1 from memory_facts where id = d_one) then
    perform append_event(org1, 'memory.project.recorded@1', operator,
      jsonb_build_object('id', d_one, 'project_id', proj, 'kind', 'decision',
        'claim', 'the walk is recorded by a person, because no static check can stand in for one'), '1', proj);
  end if;
end $$;

-- The receipt. A walk that cannot say which fixture it saw is a walk nobody can
-- repeat, so this prints what a recorder pastes into the record.
--
-- IT COUNTS THIS FIXTURE'S OWN EVENTS. The first version printed
-- `max(seq) from journal`, which is 123537 on this machine and belongs to
-- ANOTHER estate — `seq` is not global. The number looked like a fixture
-- receipt, stayed identical across a run that appended eight events, and would
-- have gone into the record as the head of a journal nobody walked.
select 'walk-fixture' as what,
       (select count(*) from projects where id = 'a1000000-0000-0000-0000-000000000001') as project,
       (select count(*) from project_tasks where project_id = 'a1000000-0000-0000-0000-000000000001') as tasks,
       (select string_agg(status, ',' order by status)
          from project_tasks where project_id = 'a1000000-0000-0000-0000-000000000001') as columns,
       (select count(*) from memory_facts where project_id = 'a1000000-0000-0000-0000-000000000001') as facts,
       (select count(*) from journal where project_id = 'a1000000-0000-0000-0000-000000000001') as own_events,
       (select max(seq) from journal where project_id = 'a1000000-0000-0000-0000-000000000001') as own_head;
