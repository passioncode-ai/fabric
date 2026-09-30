-- A heartbeat is a positive signal, and the server times it (M178, ADR-0040).
--
-- MEASURED BEFORE THIS: liveness was one subtraction in `pty.ts#stateOf` — no
-- output for sixty seconds is `idle`. An agent thinking through a long tool
-- call, an agent blocked on a question nobody answered, and an agent whose
-- process is wedged all read the same, and the operator had no way to tell
-- which. ADR-0040 records why shortening that timer is not the fix.
--
-- THE RECEIVE TIME IS THE DATABASE'S. A client clock a year out must not be
-- able to make an agent look alive, or dead. The client's own `sent_at` is
-- kept as a diagnostic and never used for ordering.
--
-- THE SEQUENCE IS MONOTONIC PER SESSION. A duplicate beat returns without
-- refreshing anything — a retry must not make a stalled agent look alive — and
-- a lower sequence is a late message from a delivery nobody can order, which is
-- refused rather than allowed to revive an old state.

create table if not exists session_heartbeats (
  session_id       uuid primary key,
  estate_id        uuid not null,
  project_id       uuid,
  beat_seq         bigint not null,
  -- The DATABASE's clock, taken at append. This is the authority.
  last_received_at timestamptz not null,
  phase            text not null check (phase in ('reading', 'working', 'waiting', 'verifying', 'blocked')),
  waiting_kind     text check (waiting_kind in ('question', 'grant', 'continuation')),
  waiting_id       uuid,
  note_safe        text,
  receipt_seq      bigint not null,
  -- Only a waiting or blocked agent may name a blocker. A `working` beat
  -- carrying one is describing a wish, and storing it would let a surface
  -- explain a silence with something the agent never claimed.
  constraint only_a_waiting_agent_names_a_blocker
    check (waiting_kind is null or phase in ('waiting', 'blocked')),
  constraint a_named_blocker_has_an_id
    check ((waiting_kind is null) = (waiting_id is null))
);

create index if not exists session_heartbeats_by_estate on session_heartbeats (estate_id, last_received_at desc);

alter table session_heartbeats enable row level security;

insert into event_types (type, projects, note) values
  ('agent.heartbeat@1', true,
   'an agent said what it is doing; the receive time is the databases and the sequence is monotonic per session')
on conflict (type) do nothing;

create or replace function apply_heartbeats(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_session uuid := nullif(e.payload->>'session_id', '')::uuid;
  v_seq     bigint := coalesce((e.payload->>'beat_seq')::bigint, 0);
begin
  if e.type <> 'agent.heartbeat@1' or v_session is null then return; end if;

  insert into session_heartbeats (session_id, estate_id, project_id, beat_seq, last_received_at,
                                  phase, waiting_kind, waiting_id, note_safe, receipt_seq)
  values (v_session, e.estate_id, e.project_id, v_seq, e.occurred_at,
          e.payload->>'phase',
          nullif(e.payload->>'waiting_kind', ''),
          nullif(e.payload->>'waiting_id', '')::uuid,
          nullif(e.payload->>'note', ''), e.seq)
  on conflict (session_id) do update
     set beat_seq = excluded.beat_seq,
         last_received_at = excluded.last_received_at,
         phase = excluded.phase,
         waiting_kind = excluded.waiting_kind,
         waiting_id = excluded.waiting_id,
         note_safe = excluded.note_safe,
         receipt_seq = excluded.receipt_seq,
         estate_id = excluded.estate_id,
         project_id = excluded.project_id
   -- A STALE OR DUPLICATE BEAT CHANGES NOTHING. A retry must not refresh
   -- `last_received_at`, or an agent that stopped beating stays alive as long
   -- as its transport keeps retrying the last message it managed to send.
   where excluded.beat_seq > session_heartbeats.beat_seq;
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
end;
$$;

-- P21: a missing grant looks exactly like an empty table.
grant select on session_heartbeats to authenticated, service_role;
revoke insert, update, delete on session_heartbeats from anon, authenticated;
revoke all on session_heartbeats from anon;

drop policy if exists session_heartbeats_read on session_heartbeats;
create policy session_heartbeats_read on session_heartbeats for select
  using (estate_id in (select estate_id from memberships where person_id = auth.uid()));

revoke execute on function apply_heartbeats(journal) from public;
revoke execute on function apply_heartbeats(journal) from anon, authenticated, service_role;
