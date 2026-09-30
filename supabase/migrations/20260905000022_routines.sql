-- Work that starts without anybody asking, and the gate in front of it
-- (M13, M94, and M132's spine).
--
-- THE GATE IS BUILT FIRST AND ON PURPOSE. M132's own row says a daily unattended
-- agent without a quota gate and a loop bound "is exactly the shape that burns an
-- account overnight". So the schedule lands with the gate already in front of it
-- rather than after an incident.
--
-- A REFUSAL IS AN EVENT. M94's wording is that automations "pause and SAY SO
-- rather than failing one by one" — so `routine.paused@1` carries the reason.
-- A routine that did not run and left no trace is indistinguishable from one
-- that ran and did nothing, and the operator finds out days later from the
-- absence of a report.

create table if not exists routines (
  id             uuid primary key,
  estate_id      uuid not null,
  project_id     uuid not null,
  instruction    text not null,
  option_id      text not null,
  every_minutes  int  not null check (every_minutes >= 5),
  enabled        boolean not null default true,
  last_run_at    timestamptz,
  last_task_id   uuid,
  created_by     text,
  created_at     timestamptz not null default now()
);

comment on column routines.every_minutes is
  'Minutes between runs. The five-minute floor is not a preference: below it the
   tick that starts runs cannot keep up, and a routine that is always due is a
   loop wearing a schedule.';

create index if not exists routines_project on routines (project_id) where enabled;

insert into event_types (type, projects, note) values
  ('routine.defined@1', true,  'a routine exists: what to run, in which project, how often (M13)'),
  ('routine.ran@1',     true,  'a routine started a task; the task carries the work and this carries the reason'),
  ('routine.paused@1',  false, 'a routine was due and did NOT start, with why — M94 asks automations to pause and say so rather than fail one by one'),
  ('routine.updated@1', true,  'enabled, disabled, or its interval changed')
on conflict (type) do nothing;

create or replace function apply_routines(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  case e.type
    when 'routine.defined@1' then
      insert into routines (id, estate_id, project_id, instruction, option_id,
                            every_minutes, created_by, created_at)
      values ((e.payload->>'id')::uuid, e.estate_id, (e.payload->>'project_id')::uuid,
              e.payload->>'instruction', e.payload->>'option_id',
              (e.payload->>'every_minutes')::int, e.actor->>'id', e.occurred_at)
      on conflict (id) do nothing;

    when 'routine.ran@1' then
      update routines
         set last_run_at = e.occurred_at, last_task_id = (e.payload->>'task_id')::uuid
       where id = (e.payload->>'id')::uuid;

    when 'routine.updated@1' then
      update routines
         set enabled = coalesce((e.payload->>'enabled')::boolean, enabled),
             every_minutes = coalesce((e.payload->>'every_minutes')::int, every_minutes)
       where id = (e.payload->>'id')::uuid;

    -- routine.paused@1 projects NOTHING, and that is the decision rather than an
    -- omission: a pause is a fact about one moment, not a state. Held as state
    -- it would need clearing, and a stale "paused" is worse than reading the
    -- journal, which already answers "why did it not run last night".
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
end;
$$;

revoke execute on function apply_projections(journal) from public;
revoke execute on function apply_projections(journal) from anon, authenticated, service_role;
revoke execute on function apply_routines(journal) from public;
revoke execute on function apply_routines(journal) from anon, authenticated, service_role;
