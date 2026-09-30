-- One admitted invocation of one task (M188, ADR-0045).
--
-- MEASURED: `run_id` has been on the journal and in `append_event` since
-- migration one, and across 2 260 events in this estate it is set on ZERO. The
-- only writer passes `e.runId ?? null` and no caller ever supplies one. A
-- column that exists, is projected, is on the wire, and has never held a value
-- — so "what happened during that run" has never had an answer. Four earlier
-- iterations (M178, M103, S04, S15) each named the missing run table as their
-- own deferral; this is it.
--
-- BORN AT ADMISSION, and only there. A denied admission is NO RUN: refusing to
-- start is not a run that failed, and counting it as one makes every refusal
-- look like an attempt the operator authorised.
--
-- FRESH PER ADMISSION. A retry is a new run with a new id rather than a mutated
-- one, because a run that can be re-entered has no answer to "how long did it
-- take" — the second attempt overwrites the first's account of itself.

create table if not exists task_runs (
  task_run_id  uuid primary key default gen_random_uuid(),
  estate_id    uuid not null,
  project_id   uuid,
  task_id      uuid not null,
  -- Which attempt at this task. DERIVED under the admission lock rather than
  -- chosen, so two concurrent admissions cannot both be "attempt 2".
  run_ordinal  int  not null,
  state        text not null default 'admitted'
                 check (state in ('admitted', 'launching', 'active', 'ending', 'ended')),
  outcome      text check (outcome in ('completed', 'failed_known', 'cancelled', 'outcome_unknown')),
  session_id   uuid,
  admitted_seq bigint not null,
  ended_seq    bigint,
  created_at   timestamptz not null default now(),
  -- An outcome exists exactly when the run has ended, and never before: a run
  -- carrying an outcome while still active is claiming a result for work that
  -- is still happening.
  constraint outcome_only_when_ended
    check ((outcome is null) = (state <> 'ended')),
  constraint ended_has_a_receipt
    check (state <> 'ended' or ended_seq is not null),
  constraint one_ordinal_per_task unique (estate_id, task_id, run_ordinal)
);

create index if not exists task_runs_by_task on task_runs (estate_id, task_id, run_ordinal desc);

alter table task_runs enable row level security;

-- AN ENDED RUN IS IMMUTABLE. Verification arriving later LINKS to it; it never
-- rewrites it. An assessment that edits the thing it assesses leaves nothing to
-- compare against.
create or replace function task_run_is_terminal()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.state = 'ended' and new.state <> 'ended' then
    raise exception 'this run ended, and an ended run does not reopen. A retry is a NEW run with its own id — the second attempt must not overwrite the first attempt''s account of itself.'
      using errcode = 'check_violation';
  end if;
  if old.state = 'ended' and (new.outcome is distinct from old.outcome or new.ended_seq is distinct from old.ended_seq) then
    raise exception 'the runtime receipt of an ended run is immutable; later verification links to it rather than editing it'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists task_run_is_terminal on task_runs;
create trigger task_run_is_terminal
  before update on task_runs
  for each row execute function task_run_is_terminal();

insert into event_types (type, projects, note) values
  ('run.started@1', true,
   'a task run began: one admitted invocation, with its ordinal — a retry is a new run rather than a reopened one'),
  ('run.ended@1', true,
   'a task run ended, with how the RUNTIME ended — kept apart from whether the work succeeded')
on conflict (type) do nothing;

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

  elsif e.type = 'run.ended@1' then
    update task_runs
       set state = 'ended',
           outcome = coalesce(e.payload->>'outcome', 'outcome_unknown'),
           ended_seq = e.seq
     where estate_id = e.estate_id and task_run_id = v_run and state <> 'ended';
  end if;
end;
$$;

create or replace function apply_projections(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform apply_estate_and_projects(e);
  perform apply_task_lifecycle_base(e);
  perform apply_memory_facts(e);
  perform apply_operating_surfaces(e);
  perform apply_goals(e);
  perform apply_move_provenance(e);
  perform apply_project_servers(e);
  perform apply_created_agents(e);
  perform apply_routines(e);
  perform apply_proposals(e);
  perform apply_handoffs(e);
  perform apply_link_needs(e);
  perform apply_questions(e);
  perform apply_priority(e);
  perform apply_effect_lifecycle(e);
  perform apply_heartbeats(e);
  perform apply_deliveries(e);
  perform apply_task_runs(e);
end;
$$;

grant select on task_runs to authenticated, service_role;
revoke insert, update, delete on task_runs from anon, authenticated;
revoke all on task_runs from anon;

drop policy if exists task_runs_read on task_runs;
create policy task_runs_read on task_runs for select
  using (estate_id in (select estate_id from memberships where person_id = auth.uid()));

revoke execute on function apply_task_runs(journal) from public;
revoke execute on function apply_task_runs(journal) from anon, authenticated, service_role;
revoke execute on function task_run_is_terminal() from public;
revoke execute on function task_run_is_terminal() from anon, authenticated, service_role;
