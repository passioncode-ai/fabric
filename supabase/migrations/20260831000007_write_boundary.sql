-- Migration 7 — the write boundary learns to say no, and learns to give up.
--
-- Two holes measured against the running stack on 2026-08-31, both in the one
-- function ADR-0027 calls the single writer.
--
--   1. AN UNKNOWN TYPE WAS ACCEPTED SILENTLY. `append_event` took any text as a
--      type; `apply_projections` ended in `else null`. A typo — `porject.created@1`
--      — was journalled, given a gapless seq, projected nothing, and left no error
--      anywhere. Measured: `totally.unknown@9` returned a seq and produced no row.
--      The journal is the spine (ADR-0014); a spine that accepts anything is not a
--      contract, and `else null` is the right behaviour for a PROJECTOR (not every
--      type projects) and the wrong behaviour for a DOOR.
--
--   2. A CONTENDED APPEND WAITED FOREVER. `pg_advisory_xact_lock` blocks with no
--      bound and the writing role runs with `lock_timeout = 0`. Measured: a second
--      writer was still blocked after 6 000 ms and only died to an unrelated
--      tripwire. One agent in a report loop starves the operator's own window, and
--      the failure looks like a frozen UI rather than an error.
--
-- The fix for (2) is deliberately split. The database's job is to FAIL FAST — it
-- cannot know whether waiting is worth it. Deciding to try again belongs to the
-- caller, which can release the connection between attempts; a retry loop inside
-- the transaction would hold the very resource it is waiting on. The client half
-- is `packages/journal` (retry on 55P03 with bounded backoff).
--
-- Probes: P13 and P14 in packages/schema/test/planted.test.mjs, both watched
-- failing against migration 6 before this file existed.

-- ————————————————————————————————————————————— the registry

create table event_types (
  type         text primary key,
  projects     boolean not null,   -- does apply_projections have a branch for it?
  note         text not null,
  registered_at timestamptz not null default now()
);

comment on table event_types is
  'The closed set of event types append_event will accept. Adding a type is a '
  'migration on purpose: a type that can be introduced by a typo is a type whose '
  'absence from every projector nobody will notice.';

insert into event_types (type, projects, note) values
  ('estate.created@1',           true,  'an estate comes into existence'),
  ('project.created@1',          true,  'a project is created inside an estate'),
  ('project.updated@1',          true,  'name / purpose / repo_path change, partial'),
  ('project.settings.updated@1', true,  'memory backend and default agent change'),
  ('project.archived@1',         true,  'a project leaves the active set'),
  ('project.kickoff@1',          false, 'the operator chose a kickoff path; the feed reads it directly'),
  ('project.repo.attached@1',    true,  'a repository folder is attached, primary derived'),
  ('project.repo.detached@1',    true,  'a repository is detached, primary promoted'),
  ('task.started@1',             true,  'an instruction was given and a session asked for'),
  ('task.session.attached@1',    true,  'the session that will carry the task is known'),
  ('task.finished@1',            true,  'the session carrying the task exited'),
  ('terminal.opened@1',          false, 'a session was spawned; observed state lives in the runner'),
  ('terminal.closed@1',          false, 'a session ended; observed state lives in the runner'),
  ('agent.stage.reported@1',     true,  'AN AGENT CLAIM about its own stage (ADR-0008)'),
  ('memory.project.recorded@1',  true,  'a fact recorded about the project');

alter table event_types enable row level security;

-- Reference data, not estate data: every member may read the vocabulary, nobody
-- writes it outside a migration.
create policy anyone_reads_event_types on event_types
  for select to authenticated using (true);

revoke all on event_types from anon;
grant select on event_types to authenticated;
grant select on event_types to service_role;

-- ————————————————————————————————————————————— the door

create or replace function append_event(
  p_estate_id uuid,
  p_type      text,
  p_actor     jsonb,
  p_payload   jsonb default '{}'::jsonb,
  p_schema_rev text default '1',
  p_project_id uuid default null,
  p_run_id     uuid default null,
  p_node_id    uuid default null
) returns journal
language plpgsql
security definer
set search_path = public
-- Fail fast rather than wait forever. Three seconds is long enough that no
-- honest append loses to a normal write and short enough that a starved caller
-- learns about it while a person is still looking at the screen. Restored
-- automatically when the function returns, so nothing else inherits it.
set lock_timeout = '3s'
as $$
declare
  v_seq bigint;
  v_event journal;
begin
  -- Before the lock, not after: a misspelled type must not even contend.
  if not exists (select 1 from event_types where type = p_type) then
    raise exception 'unregistered event type %', p_type
      using errcode = '22023',   -- invalid_parameter_value
            hint = 'Add it to event_types in a migration, together with its projector branch.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text, 4242));
  select coalesce(max(seq), 0) + 1 into v_seq from journal where estate_id = p_estate_id;
  insert into journal (estate_id, seq, type, schema_rev, actor, project_id, run_id, node_id, payload)
  values (p_estate_id, v_seq, p_type, p_schema_rev, p_actor, p_project_id, p_run_id, p_node_id, p_payload)
  returning * into v_event;
  perform apply_projections(v_event);
  return v_event;
end $$;

-- create or replace resets nothing about privileges, but state them anyway: the
-- one place a reader looks for who may write is next to the writer.
revoke execute on function append_event(uuid, text, jsonb, jsonb, text, uuid, uuid, uuid) from public;
revoke execute on function append_event(uuid, text, jsonb, jsonb, text, uuid, uuid, uuid) from anon, authenticated;
grant  execute on function append_event(uuid, text, jsonb, jsonb, text, uuid, uuid, uuid) to service_role;
