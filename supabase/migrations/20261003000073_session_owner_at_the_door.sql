-- 73 — a session belongs to the estate that holds it ANYWHERE; two estates cannot race one new id
-- past the door; a declared import keeps its case-duplicate agents; moved heartbeats come home; the
-- name rule folds case the way the form does.
-- Release review 2026-10-03, iteration 3: data findings 1, 2, 3 and 7, and the coordinator's race.
--
-- MIGRATION 72'S HEADER IS WRONG IN TWO SENTENCES, AND THIS IS THE CORRECTION.
-- Migration 72 is executed and dated, so its text is not rewritten; the truth is stated here.
--
--   * It says a heartbeat is refused for "a session another estate already holds — in
--     `session_heartbeats`, or as the session of one of its tasks (`project_tasks.session_id`)".
--     A MANAGED launch records its session in `task_runs.session_id` (migration 62), not in
--     `project_tasks`. MEASURED by the reviewer on an owned cluster with 72 migrations: after
--     `admit_task_launch(A, T, …, S)` estate B's `agent.heartbeat@1 {session_id: S}` was ACCEPTED, the
--     row became B's, and A's next beat was refused. `agent.stage.reported@1`, `transcript.captured@1`
--     and `context.compiled@1` the same: each arm looked only at its own table.
--   * It says "Replay and restore do not pass through `append_event`, so a pair recorded before this
--     still replays." True of replay and restore, and silent about the THIRD path: the declared import
--     (`import_declared_snapshot`, migration 39) appends every agent through `append_event`. A
--     workspace whose mirror held "Reviewer" and "reviewer" — legal before 72 — was refused whole with
--     "this project already has an agent called reviewer", and the new estate ended with nothing.
--
-- 1. A SESSION IS OWNED WHEREVER IT IS HELD. `refuse_foreign_identity` now refuses EVERY event whose
--    payload names a `session_id` that another estate holds in any of the six places a session lives:
--    `task_runs`, `project_tasks`, `session_heartbeats`, `agent_stages`, `session_transcripts`,
--    `session_context_packs` (`session_held_elsewhere`). Generic by payload key rather than a list of
--    types, so the heartbeat, the stage, both transcript captures, the context pack, `run.started`,
--    `run.bound`, `task.started`, `task.session.attached`, `task.admitted`, the run-stop events,
--    `chain.dispatch`, `delivery.queued` and `memory.retrieved` are all covered, and a new event type
--    that carries a session is covered the day it is registered. The table-specific arms run first, so
--    their sentences ("… carries a session_heartbeats id …") are unchanged.
--
-- 2. TWO ESTATES CANNOT RACE ONE NEW ID (coordinator, iteration 3). The estate's advisory lock
--    serialises the appends of ONE estate; the door read before it, so estate A and estate B creating
--    the same new project id — or the first heartbeat of one new session — both found nothing, and the
--    second committed in its journal a fact no projection of its estate shows. The door now takes a
--    transaction-scoped advisory lock on each global id it is about to judge (key 7373: the event's
--    project, the created entity, the named session) BEFORE it reads, and `append_event` calls it
--    AFTER the estate lock instead of before. Lock order is therefore always estate (4242) → id (7373),
--    the order `admit_task_launch` already uses for its session lock (4242 → 6061), so the door
--    introduces no lock cycle with it. A refused append now costs the estate lock; migration 71's
--    "a refusal costs no lock" still holds for the registry check, which stays first.
--    The cost: one advisory lock per distinct id per transaction, held to commit. A declared import
--    of N projects and M agents holds about N + M of them; PostgreSQL's shared lock table is
--    `max_locks_per_transaction × max_connections` (64 × 100 on the stack's defaults), so an import
--    of several thousand ids in one transaction is the point where this would need revisiting.
--
-- 3. A DECLARED IMPORT KEEPS BOTH NAMES (finding 2). Two ways were open: rename the duplicate in the
--    import plan (`workspace.ts`) and say so, or exempt the import's own appends from the name rule.
--    The exemption is taken, because it is the one that loses nothing: the mirror is the declared
--    state of a workspace that already held both agents legally, the projection already tolerates
--    such a pair (migration 72 kept it replayable on purpose), and a rename would change a name the
--    operator picks the agent by — and would write the renamed one back into the folder on the next
--    mirror, so the import would not round-trip. The exemption is transaction-local, in the pattern
--    of `ceo_write_authorizations` and `transcript_recovery_authorizations`: `import_declared_snapshot`
--    writes a row keyed on `txid_current()` and the estate, `refuse_taken_agent_name` reads it, and the
--    row is deleted before the import returns (a failed import rolls it back). No API role can write
--    the table. The import already requires an empty estate, so the only duplicates it can let through
--    are the ones its own mirror declares.
--
-- 4. HEARTBEATS THE OLD PROJECTOR MOVED COME HOME (finding 3). Before migration 72, B's beat set
--    `estate_id = excluded.estate_id`, and 72's predicate then made the move permanent: the row is B's,
--    A's beats skip it, and a rebuild of B — which replays B's beat into a row no longer there —
--    recreated it as B's. Two halves:
--      * `apply_heartbeats` no longer inserts a row for a session another estate's launch holds
--        (`task_runs` / `project_tasks`), so a rebuild of B cannot take the row again;
--      * `repair_foreign_heartbeats()` finds every row whose estate disagrees with the ONE estate that
--        launched its session, deletes it, and re-projects the owner's own beats from the owner's
--        journal in order. Idempotent: a second run finds nothing. Run once below; kept as a function
--        so it can be run again after restoring an old backup. A session two estates' launches both
--        claim is ambiguous and left alone.
--
-- 5. THE NAME RULE FOLDS CASE BEYOND ASCII (finding 7). `lower()` follows the database's collation;
--    MEASURED on an owned cluster (`initdb --no-locale`, PostgreSQL 17.11): `lower('ÄRZT') = 'Ärzt'`,
--    so "ÄRZT" and "ärzt" were two names to the database and one to the form. PostgreSQL 17's builtin
--    `pg_c_utf8` collation applies Unicode simple case mapping whatever the database locale:
--    `lower('ÄRZT' collate pg_c_utf8) = 'ärzt'`, `lower('ΟΔΟΣ' collate pg_c_utf8) = 'οδοσ'`,
--    `lower('İ' collate pg_c_utf8) = 'i'` (same cluster). The rule compares under it, and
--    `shared/agentSpec.ts#nameKey` applies the same simple mapping per code point, so neither side
--    uses context-sensitive folding (JS `toLowerCase` folds a final Σ to ς and İ to two code points).
--    The disposable stack's Supabase image was measured too: the full-tier suite
--    `apps/desktop/test/gateway-reads.test.mjs` asserts the same three values there.
--
-- Additive: one table (revoked from every API role, RLS on), five functions redefined with their
-- signatures, three helpers added and revoked. `append_event` is re-granted as 71 and 72 granted it.

-- #region session-owner-at-the-door — docs: docs/adr/0103-an-id-belongs-to-one-estate-at-the-write-boundary.md#decision

-- The id lock. One key space (7373) for every global id the door judges; a uuid is unique across tables.
create function lock_global_identity(p_id uuid) returns void
language plpgsql
volatile
set search_path = public
as $$
begin
  if p_id is not null then perform pg_advisory_xact_lock(hashtextextended(p_id::text, 7373)); end if;
end $$;
revoke execute on function lock_global_identity(uuid) from public;
revoke execute on function lock_global_identity(uuid) from anon, authenticated, service_role;

-- Where a session lives. Every one of these columns is indexed on session_id (primary keys, migration
-- 4's project_tasks_session, migration 72's task_runs_by_session).
create function session_held_elsewhere(p_estate_id uuid, p_session uuid) returns boolean
language sql
stable
security definer set search_path = public
as $$
  select p_session is not null and (
       exists (select 1 from task_runs             where session_id = p_session and estate_id <> p_estate_id)
    or exists (select 1 from project_tasks         where session_id = p_session and estate_id <> p_estate_id)
    or exists (select 1 from session_heartbeats    where session_id = p_session and estate_id <> p_estate_id)
    or exists (select 1 from agent_stages          where session_id = p_session and estate_id <> p_estate_id)
    or exists (select 1 from session_transcripts   where session_id = p_session and estate_id <> p_estate_id)
    or exists (select 1 from session_context_packs where session_id = p_session and estate_id <> p_estate_id))
$$;
revoke execute on function session_held_elsewhere(uuid, uuid) from public;
revoke execute on function session_held_elsewhere(uuid, uuid) from anon, authenticated, service_role;

-- refuse_foreign_identity: migration 72's arms, unchanged in what they check and say, now (a) locking
-- each id before reading it and (b) followed by the generic session rule. VOLATILE, because it locks.
create or replace function refuse_foreign_identity(
  p_estate_id  uuid,
  p_type       text,
  p_payload    jsonb,
  p_project_id uuid
) returns void
language plpgsql
volatile
security definer set search_path = public
as $$
declare
  v_table   text;
  v_id      uuid;
  v_found   boolean := false;
  v_session uuid := identity_uuid(p_payload->>'session_id');
begin
  -- Every project-scoped event, whatever its type. Locked first: project, then entity, then session.
  if p_project_id is not null then
    perform lock_global_identity(p_project_id);
    if exists (select 1 from projects where id = p_project_id and estate_id <> p_estate_id) then
      raise exception using
        errcode = 'check_violation',
        message = format('%s names a project that belongs to another estate. A project id is global; '
                         'appending this event here would write into that estate. Mint a new id.', p_type);
    end if;
  end if;

  -- The entity the event creates or writes, keyed on a global id (migrations 70 and 72).
  case p_type
    when 'project.created@1'         then v_table := 'projects';              v_id := identity_uuid(p_payload->>'id');
    when 'project.repo.attached@1'   then v_table := 'project_repos';         v_id := identity_uuid(p_payload->>'id');
    when 'memory.project.recorded@1' then v_table := 'memory_facts';          v_id := identity_uuid(p_payload->>'id');
    when 'task.started@1'            then v_table := 'project_tasks';         v_id := identity_uuid(p_payload->>'id');
    when 'agent.stage.reported@1'    then v_table := 'agent_stages';          v_id := v_session;
    when 'transcript.captured@1'     then v_table := 'session_transcripts';   v_id := v_session;
    when 'context.compiled@1'        then v_table := 'session_context_packs'; v_id := v_session;
    when 'task.handoff@1'            then v_table := 'project_tasks';         v_id := identity_uuid(p_payload->>'task_id');
    when 'agent.heartbeat@1'         then v_table := 'session_heartbeats';    v_id := v_session;
    when 'agent.registered@1'        then v_table := 'agent_bindings';        v_id := identity_uuid(p_payload->>'id');
    when 'goal.defined@1'            then v_table := 'goals';                 v_id := identity_uuid(p_payload->>'id');
    when 'routine.defined@1'         then v_table := 'routines';              v_id := identity_uuid(p_payload->>'id');
    when 'proposal.filed@1'          then v_table := 'proposals';             v_id := identity_uuid(p_payload->>'id');
    when 'question.asked@1'          then v_table := 'questions';             v_id := identity_uuid(p_payload->>'id');
    when 'release.recorded@1'        then v_table := 'releases';              v_id := identity_uuid(p_payload->>'id');
    when 'task.created@1'            then v_table := 'project_tasks';         v_id := identity_uuid(p_payload->>'id');
    when 'task.note.added@1'         then v_table := 'task_notes';            v_id := identity_uuid(p_payload->>'note_id');
    when 'run.started@1'             then v_table := 'task_runs';             v_id := identity_uuid(p_payload->>'task_run_id');
    when 'delivery.queued@1'         then v_table := 'deliveries';            v_id := identity_uuid(p_payload->>'delivery_id');
    when 'memory.retrieved@1'        then v_table := 'memory_retrievals';     v_id := identity_uuid(p_payload->>'id');
    else null;
  end case;

  if v_id is not null then
    perform lock_global_identity(v_id);
    v_found := case v_table
      when 'projects'              then exists (select 1 from projects              where id = v_id and estate_id <> p_estate_id)
      when 'project_repos'         then exists (select 1 from project_repos         where id = v_id and estate_id <> p_estate_id)
      when 'memory_facts'          then exists (select 1 from memory_facts          where id = v_id and estate_id <> p_estate_id)
      when 'project_tasks'         then exists (select 1 from project_tasks         where id = v_id and estate_id <> p_estate_id)
                                        or (p_type = 'task.handoff@1'
                                            and exists (select 1 from task_handoffs where task_id = v_id and estate_id <> p_estate_id))
      when 'agent_stages'          then exists (select 1 from agent_stages          where session_id = v_id and estate_id <> p_estate_id)
      when 'session_transcripts'   then exists (select 1 from session_transcripts   where session_id = v_id and estate_id <> p_estate_id)
      when 'session_context_packs' then exists (select 1 from session_context_packs where session_id = v_id and estate_id <> p_estate_id)
      when 'session_heartbeats'    then exists (select 1 from session_heartbeats    where session_id = v_id and estate_id <> p_estate_id)
      when 'agent_bindings'        then exists (select 1 from agent_bindings        where id = v_id and estate_id <> p_estate_id)
      when 'goals'                 then exists (select 1 from goals                 where id = v_id and estate_id <> p_estate_id)
      when 'routines'              then exists (select 1 from routines              where id = v_id and estate_id <> p_estate_id)
      when 'proposals'             then exists (select 1 from proposals             where id = v_id and estate_id <> p_estate_id)
      when 'questions'             then exists (select 1 from questions             where id = v_id and estate_id <> p_estate_id)
      when 'releases'              then exists (select 1 from releases              where id = v_id and estate_id <> p_estate_id)
      when 'task_notes'            then exists (select 1 from task_notes            where id = v_id and estate_id <> p_estate_id)
      when 'task_runs'             then exists (select 1 from task_runs             where task_run_id = v_id and estate_id <> p_estate_id)
      when 'deliveries'            then exists (select 1 from deliveries            where delivery_id = v_id and estate_id <> p_estate_id)
      when 'memory_retrievals'     then exists (select 1 from memory_retrievals     where id = v_id and estate_id <> p_estate_id)
      else false
    end;
    if v_found then
      raise exception using
        errcode = 'check_violation',
        message = format('%s carries a %s id that belongs to another estate. The id is global; '
                         'appending this event here would rewrite that estate''s row. Mint a new id.',
                         p_type, v_table);
    end if;
  end if;

  -- Migration 73: ANY event naming a session another estate holds, wherever it holds it.
  if v_session is not null then
    perform lock_global_identity(v_session);   -- re-entrant when the arm above already locked it
    if session_held_elsewhere(p_estate_id, v_session) then
      raise exception using
        errcode = 'check_violation',
        message = format('%s names a session that belongs to another estate. A session id is global; '
                         'appending this event here would take over that estate''s session. Mint a new id.', p_type);
    end if;
  end if;
end $$;

comment on function refuse_foreign_identity(uuid, text, jsonb, uuid) is
  'Write-boundary guard for append_event, called under the estate lock: locks and then refuses an event whose project, created or written entity id, or named session belongs to another estate (session ownership read from task_runs, project_tasks, session_heartbeats, agent_stages, session_transcripts and session_context_packs since migration 73). The upsert arms carry the matching estate predicate for events journalled before it existed.';

-- ── the declared import's own exemption from the name rule ──────────────────────
create table declared_import_authorizations (
  transaction_id bigint not null,
  estate_id      uuid   not null,
  primary key (transaction_id, estate_id)
);
revoke all on declared_import_authorizations from public, anon, authenticated, service_role;
alter table declared_import_authorizations enable row level security;

create or replace function refuse_taken_agent_name(
  p_estate_id uuid,
  p_type      text,
  p_payload   jsonb
) returns void
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_payload->>'name', ''));
begin
  if p_type <> 'agent.registered@1' or p_payload->>'instructions' is null or v_name = '' then return; end if;
  -- Migration 73: the declared import of a workspace that already held both names lands both.
  if exists (select 1 from declared_import_authorizations a
              where a.transaction_id = txid_current() and a.estate_id = p_estate_id) then return; end if;
  if exists (select 1 from agent_bindings b
              where b.estate_id = p_estate_id
                and b.project_id = identity_uuid(p_payload->>'project_id')
                and b.id is distinct from identity_uuid(p_payload->>'id')
                and b.instructions is not null
                -- Migration 73: Unicode simple case mapping whatever the database locale
                -- (`agentSpec.ts#nameKey` applies the same mapping).
                and lower(btrim(b.role) collate pg_c_utf8) = lower(v_name collate pg_c_utf8)) then
    raise exception using
      errcode = 'unique_violation',
      message = format('this project already has an agent called %s', v_name);
  end if;
end $$;

-- import_declared_snapshot: migration 39's body; the only change is the authorisation row around the loop.
create or replace function import_declared_snapshot(
  p_estate_id   uuid,
  p_command_id  uuid,
  p_input_digest text,
  p_actor       jsonb,
  p_events      jsonb
)
returns journal
language plpgsql
security definer set search_path = public
as $$
declare
  ev      jsonb;
  receipt journal;
  n       int := 0;
begin
  if jsonb_typeof(p_events) <> 'array' then
    raise exception 'an import takes an array of events' using errcode = 'invalid_parameter_value';
  end if;

  select * into receipt from journal
   where estate_id = p_estate_id
     and type = 'estate.imported@1'
     and payload->>'command_id' = p_command_id::text
   limit 1;
  if found then return receipt; end if;

  perform 1 from estates where id = p_estate_id for update;

  if exists (select 1 from projects where estate_id = p_estate_id) then
    raise exception 'this estate already holds projects. Importing over them would be a merge nobody has specified — which id wins, and what happens to the work hanging off a project in both. Import into an empty estate.'
      using errcode = 'check_violation';
  end if;

  -- Migration 73: the mirror is the declared state of a workspace, which may legally hold two agents whose
  -- names differ only by case (they were legal before migration 72). Exempt from the name rule for THIS
  -- transaction and estate only; every other guard of the door still applies to every event.
  insert into declared_import_authorizations (transaction_id, estate_id) values (txid_current(), p_estate_id)
  on conflict do nothing;

  for ev in select * from jsonb_array_elements(p_events)
  loop
    perform append_event(
      p_estate_id,
      ev->>'type',
      p_actor,
      coalesce(ev->'payload', '{}'::jsonb),
      '1',
      nullif(ev->>'project_id', '')::uuid
    );
    n := n + 1;
  end loop;

  delete from declared_import_authorizations where transaction_id = txid_current() and estate_id = p_estate_id;

  select * into receipt from append_event(
    p_estate_id,
    'estate.imported@1',
    p_actor,
    jsonb_build_object(
      'command_id', p_command_id,
      'input_digest', p_input_digest,
      'events', n,
      'coverage_note', 'the declared mirror carries projects and agent bindings only'
    )
  );
  return receipt;
end;
$$;

revoke execute on function import_declared_snapshot(uuid, uuid, text, jsonb, jsonb) from public;
revoke execute on function import_declared_snapshot(uuid, uuid, text, jsonb, jsonb) from anon;
grant execute on function import_declared_snapshot(uuid, uuid, text, jsonb, jsonb) to service_role;

-- append_event: migration 72's body; the door moves AFTER the estate lock, so the id locks it takes
-- always follow the estate lock (see 2 above).
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
set lock_timeout = '3s'
as $$
declare
  v_seq bigint;
  v_event journal;
begin
  if not exists (select 1 from event_types where type = p_type) then
    raise exception 'unregistered event type %', p_type
      using errcode = '22023',   -- invalid_parameter_value
            hint = 'Add it to event_types in a migration, together with its projector branch.';
  end if;
  if p_type in ('ceo.conversation.opened@1','ceo.message.accepted@1') and not exists (
    select 1 from ceo_write_authorizations a where a.transaction_id=txid_current()
     and a.estate_id=p_estate_id and a.type=p_type and a.actor=p_actor and a.payload=p_payload
     and p_project_id is null and p_run_id is null and p_node_id is null and p_schema_rev='1'
  ) then raise exception 'Use CEO private commands' using errcode='insufficient_privilege'; end if;
  if p_type='transcript.captured@2' and not exists (
    select 1 from transcript_recovery_authorizations a where a.transaction_id=txid_current()
      and a.estate_id=p_estate_id and a.project_id=p_project_id and a.payload=p_payload
      and p_actor=jsonb_build_object('kind','system','id','transcript-recovery')
      and p_run_id is null and p_node_id is null and p_schema_rev='2'
  ) then raise exception 'Use recover_transcript for recovered captures' using errcode='insufficient_privilege'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text, 4242));
  perform refuse_foreign_identity(p_estate_id, p_type, p_payload, p_project_id);   -- migration 73: under the lock
  perform refuse_taken_agent_name(p_estate_id, p_type, p_payload);
  select coalesce(max(seq), 0) + 1 into v_seq from journal where estate_id = p_estate_id;
  insert into journal (estate_id, seq, type, schema_rev, actor, project_id, run_id, node_id, payload)
  values (p_estate_id, v_seq, p_type, p_schema_rev, p_actor, p_project_id, p_run_id, p_node_id, p_payload)
  returning * into v_event;
  perform apply_projections(v_event);
  return v_event;
end $$;

revoke execute on function append_event(uuid, text, jsonb, jsonb, text, uuid, uuid, uuid) from public;
revoke execute on function append_event(uuid, text, jsonb, jsonb, text, uuid, uuid, uuid) from anon, authenticated;
grant  execute on function append_event(uuid, text, jsonb, jsonb, text, uuid, uuid, uuid) to service_role;

-- apply_heartbeats: migration 72's body, and a beat for a session another estate LAUNCHED never creates
-- the row — so a rebuild of the estate that wrote it before migration 72 cannot take the row back.
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
  if exists (select 1 from task_runs where session_id = v_session and estate_id <> e.estate_id)
     or exists (select 1 from project_tasks where session_id = v_session and estate_id <> e.estate_id) then
    return;
  end if;

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
         project_id = excluded.project_id
   where excluded.beat_seq > session_heartbeats.beat_seq
     and session_heartbeats.estate_id = excluded.estate_id;
end;
$$;

-- The repair. Owner = the ONE estate whose launch (task_runs / project_tasks) holds the session.
create function repair_foreign_heartbeats() returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  r record;
  e journal;
  n integer := 0;
begin
  for r in
    select h.session_id, min(o.estate_id::text)::uuid as owner
      from session_heartbeats h
      join (select session_id, estate_id from task_runs where session_id is not null
            union
            select session_id, estate_id from project_tasks where session_id is not null) o
        on o.session_id = h.session_id
     group by h.session_id, h.estate_id
    having count(distinct o.estate_id) = 1 and min(o.estate_id::text)::uuid <> h.estate_id
  loop
    delete from session_heartbeats where session_id = r.session_id;
    for e in
      select * from journal
       where estate_id = r.owner and type = 'agent.heartbeat@1'
         and lower(payload->>'session_id') = r.session_id::text
       order by seq
    loop
      perform apply_heartbeats(e);
    end loop;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function repair_foreign_heartbeats() from public;
revoke execute on function repair_foreign_heartbeats() from anon, authenticated, service_role;

select repair_foreign_heartbeats();

-- #endregion session-owner-at-the-door

-- ── schema 73 as a private-archive source ───────────────────────────────────
--
-- ADR-0079 decision 5, as migrations 67–72 did for their own numbers. Migration 73 changes no archived
-- table and registers no event type, so a schema-73 journal has the shape of a schema-72 one; left
-- unqualified, an export taken at 73 would say `source_schema_version: 72`. An export now names 73;
-- import accepts 66 to 73. The bodies are migration 72's, changed only at those two points.
-- #region private-archive-source-schema — docs: docs/adr/0079-private-conversation-archives-preserve-history-not-authority.md#decision
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb,'71'::jsonb,'72'::jsonb,'73'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
 if not ceo_uuid(a->'archive_id') or not ceo_uuid(a->'owner_person_id') or a->>'retention' is distinct from 'no-deletion-v1'
  or jsonb_typeof(a->'archive_digest') is distinct from 'string' or not coalesce(a->>'archive_digest' ~ '^[0-9a-f]{64}$',false) then perform ceo_archive_fail('invalid_archive'); end if;
 perform ceo_archive_manifest(m);
 perform ceo_archive_array(a->'conversations',256);perform ceo_archive_array(a->'messages',4096);perform ceo_archive_array(a->'operations',8192);
 if jsonb_typeof(a->'tombstones') is distinct from 'array' or jsonb_array_length(a->'tombstones')<>0 then perform ceo_archive_fail('invalid_archive'); end if;
 vals:=array[a->>'schema',a->>'archive_id',ceo_archive_int(a->'source_schema_version')::text,a->>'owner_person_id',
  m->>'schema',m->>'sourceEstateId',m->>'takenAtUtc',ceo_archive_int(m->'watermarkSeq')::text,ceo_archive_int(m->'eventCount')::text,m->>'digest',
  a->>'retention',jsonb_array_length(a->'conversations')::text];
 foreach v in array vals loop result:=result||ceo_frame(v);end loop;
 for x in select value from jsonb_array_elements(a->'conversations') loop
  if not ceo_archive_keys(x,array['id','subject_kind','subject_id','owner_project_id','created_seq','revision'])
   or not ceo_uuid(x->'id') or x->>'subject_kind' not in ('global','project','question') or not ceo_uuid(x->'subject_id')
   or (x->'owner_project_id'<>'null'::jsonb and not ceo_uuid(x->'owner_project_id')) then perform ceo_archive_fail('invalid_archive'); end if;
  foreach v in array array[x->>'id',x->>'subject_kind',x->>'subject_id',x->>'owner_project_id',ceo_archive_int(x->'created_seq',1)::text,ceo_archive_int(x->'revision')::text] loop result:=result||ceo_frame(v);end loop;
 end loop;
 result:=result||ceo_frame(jsonb_array_length(a->'messages')::text);
 for x in select value from jsonb_array_elements(a->'messages') loop
  if not ceo_archive_keys(x,array['id','conversation_id','ordinal','content_id','request_id','accepted_seq','envelope','source_digest','origin'])
   or not ceo_archive_keys(x->'origin',array['estate_id','canonical_digest'])
   or not ceo_uuid(x->'id') or not ceo_uuid(x->'conversation_id') or not ceo_uuid(x->'content_id') or not ceo_uuid(x->'request_id')
   or not ceo_uuid(x->'origin'->'estate_id') or not coalesce(x->>'source_digest' ~ '^[0-9a-f]{64}$',false)
   or not coalesce(x->'origin'->>'canonical_digest' ~ '^[0-9a-f]{64}$',false) then perform ceo_archive_fail('invalid_archive'); end if;
  if x->'envelope'->>'schema' is distinct from 'CeoSend@1' or x->'envelope'->>'preparation_version' is distinct from 'har06-ceo-v1' then
   perform ceo_archive_fail('unsupported_schema'); end if;
  begin
   envelope:=ceo_send_canonical((m->>'sourceEstateId')::uuid,(a->>'owner_person_id')::uuid,x->'envelope');
  exception when check_violation then perform ceo_archive_fail('invalid_archive');  -- not silence: migration 64 refused the envelope, which is this archive's refusal
  end;
  foreach v in array array[x->>'id',x->>'conversation_id',ceo_archive_int(x->'ordinal',1)::text,x->>'content_id',x->>'request_id',
   ceo_archive_int(x->'accepted_seq',1)::text,envelope,x->>'source_digest',x->'origin'->>'estate_id',x->'origin'->>'canonical_digest'] loop result:=result||ceo_frame(v);end loop;
 end loop;
 result:=result||ceo_frame(jsonb_array_length(a->'operations')::text);
 for x in select value from jsonb_array_elements(a->'operations') loop
  if x->>'kind'='send' then
   if not ceo_archive_keys(x,array['operation_id','kind','message_id']) or not ceo_uuid(x->'operation_id') or not ceo_uuid(x->'message_id') then perform ceo_archive_fail('invalid_archive'); end if;
   foreach v in array array[x->>'operation_id','send',x->>'message_id'] loop result:=result||ceo_frame(v);end loop;
  elsif x->>'kind'='open' then
   r:=x->'receipt';
   if not ceo_archive_keys(x,array['operation_id','kind','requested_conversation_id','subject_kind','subject_id','receipt'])
    or not ceo_archive_keys(r,array['conversation_id','revision','receipt_seq'])
    or not ceo_uuid(x->'operation_id') or not ceo_uuid(x->'requested_conversation_id') or x->>'subject_kind' not in ('global','project','question')
    or not ceo_uuid(x->'subject_id') or not ceo_uuid(r->'conversation_id') then perform ceo_archive_fail('invalid_archive'); end if;
   foreach v in array array[x->>'operation_id','open',x->>'requested_conversation_id',x->>'subject_kind',x->>'subject_id',r->>'conversation_id',
    ceo_archive_int(r->'revision')::text,ceo_archive_int(r->'receipt_seq',1)::text] loop result:=result||ceo_frame(v);end loop;
  else perform ceo_archive_fail('invalid_archive');
  end if;
 end loop;
 return result||ceo_frame(jsonb_array_length(a->'tombstones')::text);
end $$;

create or replace function ceo_export_private_archive(p_estate_id uuid,p_person_id uuid,p_revision bigint,p_estate_manifest jsonb,p_journal_ndjson text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_events jsonb;v_conversations jsonb;v_messages jsonb;v_operations jsonb;v_archive jsonb;v_count bigint;v_max bigint;
begin
 if not ceo_authorized(p_estate_id,p_person_id,p_revision) then return jsonb_build_object('ok',false,'reason_code','unavailable'); end if;
 begin
  v_events:=ceo_archive_estate_rows(p_estate_manifest,p_journal_ndjson);
  if (p_estate_manifest->>'sourceEstateId')::uuid<>p_estate_id then perform ceo_archive_fail('invalid_archive'); end if;
  select count(*),coalesce(max(seq),0) into v_count,v_max from journal where estate_id=p_estate_id;
  if v_count<>(p_estate_manifest->>'eventCount')::bigint or v_max<>(p_estate_manifest->>'watermarkSeq')::bigint then perform ceo_archive_fail('archive_stale'); end if;
  -- Typed row equality; jsonb semantic equality for actor and payload, never property order.
  if exists(select 1 from jsonb_array_elements(v_events) x left join journal j on j.estate_id=p_estate_id and j.seq=ceo_archive_journal_seq(x->'seq')
    where j.seq is null or j.type<>x->>'type' or j.schema_rev<>x->>'schema_rev' or j.actor<>x->'actor' or j.payload<>x->'payload'
     or j.project_id is distinct from (x->>'project_id')::uuid or j.run_id is distinct from (x->>'run_id')::uuid
     or j.node_id is distinct from (x->>'node_id')::uuid or j.occurred_at<>(x->>'occurred_at')::timestamptz) then
   perform ceo_archive_fail('integrity_mismatch'); end if;

  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'subject_kind',c.subject_kind,'subject_id',c.subject_id,'owner_project_id',c.owner_project_id,
    'created_seq',c.created_seq,'revision',c.revision) order by c.id),'[]') into v_conversations
   from ceo_conversations c where c.estate_id=p_estate_id and c.person_id=p_person_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'conversation_id',m.conversation_id,'ordinal',m.ordinal,'content_id',m.content_id,
    'request_id',m.request_id,'accepted_seq',m.accepted_seq,'envelope',b.envelope,'source_digest',b.canonical_digest,
    'origin',case when pv.content_id is null then jsonb_build_object('estate_id',p_estate_id,'canonical_digest',b.canonical_digest)
      else jsonb_build_object('estate_id',pv.origin_estate_id,'canonical_digest',pv.origin_digest) end)
    order by m.conversation_id,m.ordinal),'[]') into v_messages
   from ceo_messages m left join ceo_private_contents b on b.id=m.content_id and b.estate_id=p_estate_id and b.person_id=p_person_id
   left join ceo_content_provenance pv on pv.content_id=b.id
   where m.estate_id=p_estate_id and m.person_id=p_person_id;
  -- Missing content refuses: absence is not an erasure receipt.
  if exists(select 1 from jsonb_array_elements(v_messages) m where m->'envelope' is null or m->'envelope'='null'::jsonb) then perform ceo_archive_fail('invalid_archive'); end if;
  select coalesce(jsonb_agg(case when o.kind='send' then jsonb_build_object('operation_id',o.operation_id,'kind','send','message_id',o.receipt->>'message_id')
    else jsonb_build_object('operation_id',o.operation_id,'kind','open')||ceo_archive_open_intent(o.intent)||jsonb_build_object('receipt',
     jsonb_build_object('conversation_id',o.receipt->>'conversation_id','revision',(o.receipt->>'revision')::bigint,'receipt_seq',(o.receipt->>'receipt_seq')::bigint)) end
    order by o.operation_id),'[]') into v_operations
   from ceo_operations o where o.estate_id=p_estate_id and o.person_id=p_person_id and o.kind in ('open','send');
  if exists(select 1 from ceo_operations o where o.estate_id=p_estate_id and o.person_id=p_person_id and o.kind not in ('open','send')) then
   perform ceo_archive_fail('invalid_archive'); end if;
  if jsonb_array_length(v_conversations)>256 or jsonb_array_length(v_messages)>4096 or jsonb_array_length(v_operations)>8192 then perform ceo_archive_fail('too_large'); end if;
  perform ceo_archive_coverage(p_estate_id,p_person_id,v_conversations,v_messages);

  v_archive:=jsonb_build_object('schema','CeoPrivateArchive@1','archive_id',gen_random_uuid(),'source_schema_version',73,'owner_person_id',p_person_id,
   'estate_archive',p_estate_manifest,'retention','no-deletion-v1','conversations',v_conversations,'messages',v_messages,'operations',v_operations,
   'tombstones','[]'::jsonb,'archive_digest',repeat('0',64));
  v_archive:=jsonb_set(v_archive,'{archive_digest}',to_jsonb(ceo_private_archive_digest(v_archive)));
  -- Everything this export claims is checked by the same rules an import applies.
  perform ceo_private_archive_validate(v_archive);
  if octet_length(v_archive::text)>8388608 then perform ceo_archive_fail('too_large'); end if;
  return jsonb_build_object('ok',true,'archive',v_archive);
 exception when check_violation then
  -- Not silence: a read-only refusal, returned as its code; nothing to roll back.
  return jsonb_build_object('ok',false,'reason_code',case when sqlerrm in
   ('invalid_json','too_large','invalid_archive','integrity_mismatch','unsupported_schema','archive_stale','idempotency_conflict','not_found','unavailable')
   then sqlerrm else 'unavailable' end);
 end;
end $$;
-- #endregion private-archive-source-schema
