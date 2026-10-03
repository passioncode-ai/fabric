-- 72 — an id belongs to one estate at the write boundary, for EVERY create;
-- hand-offs and heartbeats stop overwriting across estates; the new journal
-- lookups get their indexes; one agent per name is decided under the lock.
-- Release review 2026-10-03, iteration 2: data findings 1, 5, 6 and 8.
--
-- MIGRATION 70'S HEADER IS WRONG IN TWO SENTENCES, AND THIS IS THE CORRECTION.
-- Migration 70 is executed and dated, so its claims are not rewritten; the
-- truth is stated here instead. It says the seven upserts it changed were
-- "every `do update` keyed on a global id", and that `apply_heartbeats`
-- "already carried the predicate". Neither was true:
--
--   * `apply_handoffs` (migration 27) upserts `task_handoffs` on
--     `(task_id, name)` — a task id is global — and asks nothing about the
--     estate. MEASURED by the reviewer on an owned cluster with 71 migrations:
--     estate B's `task.handoff@1` naming A's task was ACCEPTED and A's row read
--     "WRITTEN BY B". `chainAdvance.ts` passes hand-off values into
--     `fillBrief`, so B's text reached the brief of an unattended agent in A.
--   * `apply_heartbeats` (migration 40) checks only `beat_seq` and then SETS
--     `estate_id = excluded.estate_id`. B's `agent.heartbeat@1` naming A's
--     session moved the row into estate B.
--
-- The same two halves as migration 70, for the same reason (ADR-0014):
--
-- 1. THE DOOR REFUSES. `refuse_foreign_identity` now refuses a hand-off whose
--    task belongs to another estate, and a heartbeat whose session another
--    estate already holds — in `session_heartbeats`, or as the session of one
--    of its tasks (`project_tasks.session_id`), because a first beat from B for
--    a session A launched but has not yet heard from would otherwise take the
--    row, and the predicate below would then drop every beat A sends.
--
--    AND EVERY OTHER CREATE KEYED ON A GLOBAL ID (data finding 6). Eleven
--    projector arms end `on conflict (id) do nothing`: agents, goals, routines,
--    proposals, questions, releases, tasks, task notes, task runs, deliveries
--    and retrievals. They never overwrote A — they journalled a fact in B that
--    no projection of B will ever show, which migration 70 already named as the
--    reason to refuse rather than skip. The door now refuses each of them the
--    same way, by one primary-key lookup per create. The id is compared through
--    `identity_uuid`, which answers null for a malformed id, so the door never
--    changes which error a malformed payload raises: the projector's own cast
--    still refuses it, in the same transaction, exactly as before.
--
-- 2. THE PROJECTOR SKIPS. Both upserts gain `where <table>.estate_id =
--    excluded.estate_id`, and the heartbeat no longer writes `estate_id` at
--    all, so a journal written before this migration replays without moving a
--    row between estates. The `do nothing` arms need no predicate: they never
--    wrote across estates.
--
-- INDEXES FOR LOOKUPS THAT SCANNED THE JOURNAL (finding 5), in migration 63's
-- style — one partial expression index per (type, payload key):
--   * `chainAdvance.ts#launchesExhausted` counts `chain.dispatch@1` and
--     `routine.paused@1` rows by `payload->>'id'`, twice per waiting follower
--     per pass; the scoped store adds the estate.
--   * `admit_task_launch` finds a session's first `task.admitted@1` by
--     `payload->>'session_id'` across every estate (session identity is global)
--     and then asks `task_runs` for the session, which had no index on it.
--   `contextPack.ts#contextDemandFor` asked the same `task.admitted@1` question
--   and no longer reads the journal at all: the launch passes the trigger.
--
-- ONE AGENT PER NAME, ATOMICALLY (finding 8). `agents:create` read the
-- project's agents, checked the name, then appended: two creates could both
-- pass the read. Two alternatives were considered and refused:
--   * a unique index on the name — rows written before it may already hold two
--     agents of one name, so creating it could fail this migration on the
--     operator's database, and a journal holding such a pair could never be
--     replayed into an empty projection again;
--   * a dedicated RPC that appends — it would bypass the main process's
--     prepared journal (text sanitation, the identity guard) that every other
--     write goes through.
-- So the rule is a guard at the write boundary, AFTER the estate lock:
-- `append_event` calls `refuse_taken_agent_name` once it holds the estate's
-- advisory lock, which every append of the estate takes, so the name it reads is
-- still true when the event lands. A taken name raises `unique_violation` with
-- the sentence the form already shows, and nothing is journalled. Replay and
-- restore do not pass through `append_event`, so a pair recorded before this
-- still replays.
--
-- Additive: no table, no event type and no table grant changes. The redefined
-- functions keep their signatures, so their grants stand; `append_event` is
-- re-granted exactly as migration 71 granted it. The two new helpers are
-- revoked from every API role.

-- #region estate-owned-identity — docs: docs/adr/0103-an-id-belongs-to-one-estate-at-the-write-boundary.md#decision

create function identity_uuid(p text) returns uuid
language sql immutable
set search_path = public
as $$
  select case when p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p::uuid end
$$;
revoke execute on function identity_uuid(text) from public;
revoke execute on function identity_uuid(text) from anon, authenticated, service_role;

create or replace function refuse_foreign_identity(
  p_estate_id  uuid,
  p_type       text,
  p_payload    jsonb,
  p_project_id uuid
) returns void
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_table text;
  v_id    uuid;
  v_found boolean := false;
begin
  -- Every project-scoped event, whatever its type. One primary-key lookup.
  if p_project_id is not null
     and exists (select 1 from projects where id = p_project_id and estate_id <> p_estate_id) then
    raise exception using
      errcode = 'check_violation',
      message = format('%s names a project that belongs to another estate. A project id is global; '
                       'appending this event here would write into that estate. Mint a new id.', p_type);
  end if;

  -- A heartbeat for a session another estate's task holds (migration 72). Asked before the generic arms,
  -- so the sentence says what was found: no heartbeat row yet, and still not this estate's session.
  if p_type = 'agent.heartbeat@1' then
    v_id := identity_uuid(p_payload->>'session_id');
    if exists (select 1 from project_tasks where session_id = v_id and estate_id <> p_estate_id) then
      raise exception using
        errcode = 'check_violation',
        message = format('%s names a session that belongs to another estate. A session id is global; '
                         'appending this event here would take over that estate''s liveness. Mint a new id.', p_type);
    end if;
  end if;

  -- The entity the event creates or writes, keyed on a global id. Migration 70's seven first, then
  -- migration 72's: the hand-off's task, the heartbeat's session, and every create that does nothing
  -- on conflict.
  case p_type
    when 'project.created@1' then
      v_table := 'projects';
      v_id := identity_uuid(p_payload->>'id');
      v_found := exists (select 1 from projects where id = v_id and estate_id <> p_estate_id);
    when 'project.repo.attached@1' then
      v_table := 'project_repos';
      v_id := identity_uuid(p_payload->>'id');
      v_found := exists (select 1 from project_repos where id = v_id and estate_id <> p_estate_id);
    when 'memory.project.recorded@1' then
      v_table := 'memory_facts';
      v_id := identity_uuid(p_payload->>'id');
      v_found := exists (select 1 from memory_facts where id = v_id and estate_id <> p_estate_id);
    when 'task.started@1' then
      v_table := 'project_tasks';
      v_id := identity_uuid(p_payload->>'id');
      v_found := exists (select 1 from project_tasks where id = v_id and estate_id <> p_estate_id);
    when 'agent.stage.reported@1' then
      v_table := 'agent_stages';
      v_id := identity_uuid(p_payload->>'session_id');
      v_found := exists (select 1 from agent_stages where session_id = v_id and estate_id <> p_estate_id);
    when 'transcript.captured@1' then
      v_table := 'session_transcripts';
      v_id := identity_uuid(p_payload->>'session_id');
      v_found := exists (select 1 from session_transcripts where session_id = v_id and estate_id <> p_estate_id);
    when 'context.compiled@1' then
      v_table := 'session_context_packs';
      v_id := identity_uuid(p_payload->>'session_id');
      v_found := exists (select 1 from session_context_packs where session_id = v_id and estate_id <> p_estate_id);
    -- migration 72: the two upserts migration 70's header wrongly called covered
    when 'task.handoff@1' then
      v_table := 'project_tasks';
      v_id := identity_uuid(p_payload->>'task_id');
      v_found := exists (select 1 from project_tasks where id = v_id and estate_id <> p_estate_id)
              or exists (select 1 from task_handoffs where task_id = v_id and estate_id <> p_estate_id);
    when 'agent.heartbeat@1' then
      v_table := 'session_heartbeats';
      v_id := identity_uuid(p_payload->>'session_id');
      v_found := exists (select 1 from session_heartbeats where session_id = v_id and estate_id <> p_estate_id);
    -- migration 72: every create whose arm ends `on conflict (id) do nothing` (data finding 6)
    when 'agent.registered@1' then
      v_table := 'agent_bindings';
      v_id := identity_uuid(p_payload->>'id');
      v_found := exists (select 1 from agent_bindings where id = v_id and estate_id <> p_estate_id);
    when 'goal.defined@1' then
      v_table := 'goals';
      v_id := identity_uuid(p_payload->>'id');
      v_found := exists (select 1 from goals where id = v_id and estate_id <> p_estate_id);
    when 'routine.defined@1' then
      v_table := 'routines';
      v_id := identity_uuid(p_payload->>'id');
      v_found := exists (select 1 from routines where id = v_id and estate_id <> p_estate_id);
    when 'proposal.filed@1' then
      v_table := 'proposals';
      v_id := identity_uuid(p_payload->>'id');
      v_found := exists (select 1 from proposals where id = v_id and estate_id <> p_estate_id);
    when 'question.asked@1' then
      v_table := 'questions';
      v_id := identity_uuid(p_payload->>'id');
      v_found := exists (select 1 from questions where id = v_id and estate_id <> p_estate_id);
    when 'release.recorded@1' then
      v_table := 'releases';
      v_id := identity_uuid(p_payload->>'id');
      v_found := exists (select 1 from releases where id = v_id and estate_id <> p_estate_id);
    when 'task.created@1' then
      v_table := 'project_tasks';
      v_id := identity_uuid(p_payload->>'id');
      v_found := exists (select 1 from project_tasks where id = v_id and estate_id <> p_estate_id);
    when 'task.note.added@1' then
      v_table := 'task_notes';
      v_id := identity_uuid(p_payload->>'note_id');
      v_found := exists (select 1 from task_notes where id = v_id and estate_id <> p_estate_id);
    when 'run.started@1' then
      v_table := 'task_runs';
      v_id := identity_uuid(p_payload->>'task_run_id');
      v_found := exists (select 1 from task_runs where task_run_id = v_id and estate_id <> p_estate_id);
    when 'delivery.queued@1' then
      v_table := 'deliveries';
      v_id := identity_uuid(p_payload->>'delivery_id');
      v_found := exists (select 1 from deliveries where delivery_id = v_id and estate_id <> p_estate_id);
    when 'memory.retrieved@1' then
      v_table := 'memory_retrievals';
      v_id := identity_uuid(p_payload->>'id');
      v_found := exists (select 1 from memory_retrievals where id = v_id and estate_id <> p_estate_id);
    else
      return;
  end case;

  if v_found then
    raise exception using
      errcode = 'check_violation',
      message = format('%s carries a %s id that belongs to another estate. The id is global; '
                       'appending this event here would rewrite that estate''s row. Mint a new id.',
                       p_type, v_table);
  end if;
end $$;

comment on function refuse_foreign_identity(uuid, text, jsonb, uuid) is
  'Write-boundary guard for append_event: refuses an event whose project, or whose created or written entity id (every create keyed on a global id; hand-offs and heartbeats since migration 72), belongs to another estate. The upsert arms carry the matching estate predicate for events journalled before it existed.';

-- apply_handoffs: migration 27's body, with the estate predicate on the upsert.
create or replace function apply_handoffs(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if e.type <> 'task.handoff@1' then return; end if;
  insert into task_handoffs (estate_id, project_id, task_id, name, value, produced_by, created_at)
  values (e.estate_id, e.project_id, (e.payload->>'task_id')::uuid,
          e.payload->>'name', e.payload->>'value', e.actor->>'id', e.occurred_at)
  -- Handing the same name twice REPLACES it. A step that corrects itself before
  -- finishing is ordinary; two values under one name would make the follower's
  -- input depend on which row a query happened to read first.
  on conflict (task_id, name) do update
    set value = excluded.value, produced_by = excluded.produced_by, created_at = excluded.created_at
  -- Migration 72: only the estate that owns the row replaces it. On replay of an
  -- older journal the foreign row is left exactly as its owner wrote it.
  where task_handoffs.estate_id = excluded.estate_id;
end;
$$;

-- apply_heartbeats: migration 40's body. The estate is never rewritten, and only
-- the owning estate's beat may advance the row.
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
         project_id = excluded.project_id
   -- A STALE OR DUPLICATE BEAT CHANGES NOTHING. A retry must not refresh
   -- `last_received_at`, or an agent that stopped beating stays alive as long
   -- as its transport keeps retrying the last message it managed to send.
   where excluded.beat_seq > session_heartbeats.beat_seq
     -- Migration 72: and a beat from another estate changes nothing either.
     and session_heartbeats.estate_id = excluded.estate_id;
end;
$$;

-- #endregion estate-owned-identity

-- #region journal-lookup-indexes — docs: docs/adr/0103-an-id-belongs-to-one-estate-at-the-write-boundary.md#decision
create index chain_dispatch_by_follower on journal(estate_id,(payload->>'id')) where type='chain.dispatch@1';
create index routine_paused_by_subject on journal(estate_id,(payload->>'id')) where type='routine.paused@1';
create index task_admitted_session on journal((payload->>'session_id')) where type='task.admitted@1';
create index task_runs_by_session on task_runs(session_id) where session_id is not null;
-- #endregion journal-lookup-indexes

-- #region one-agent-per-name — docs: docs/ux/scenarios.md#scn-130-start-a-new-agent-inside-a-project
create function refuse_taken_agent_name(
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
  -- Only a CREATED agent carries instructions, and only those share one name space per project
  -- (`agentSpec.ts#nameTaken`, the rule the form shows before the click: trimmed, case-insensitive).
  if p_type <> 'agent.registered@1' or p_payload->>'instructions' is null or v_name = '' then return; end if;
  if exists (select 1 from agent_bindings b
              where b.estate_id = p_estate_id
                and b.project_id = identity_uuid(p_payload->>'project_id')
                and b.id is distinct from identity_uuid(p_payload->>'id')
                and b.instructions is not null
                and lower(btrim(b.role)) = lower(v_name)) then
    raise exception using
      errcode = 'unique_violation',
      message = format('this project already has an agent called %s', v_name);
  end if;
end $$;

revoke execute on function refuse_taken_agent_name(uuid, text, jsonb) from public;
revoke execute on function refuse_taken_agent_name(uuid, text, jsonb) from anon, authenticated, service_role;

-- append_event: migration 71's body, unchanged except for the one call marked below. It sits AFTER the
-- estate lock on purpose: before it, two creates of one name would both read "free".
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
  perform refuse_foreign_identity(p_estate_id, p_type, p_payload, p_project_id);
  perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text, 4242));
  perform refuse_taken_agent_name(p_estate_id, p_type, p_payload);   -- migration 72: under the lock
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

-- #endregion one-agent-per-name

-- ── schema 72 as a private-archive source ───────────────────────────────────
--
-- ADR-0079 decision 5, as migrations 67–71 did for their own numbers. Migration 72 changes no archived
-- table and registers no event type, so a schema-72 journal has the shape of a schema-71 one; left
-- unqualified, an export taken at 72 would say `source_schema_version: 71`. An export now names 72;
-- import accepts 66 to 72. The bodies are migration 71's, changed only at those two points.
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb,'71'::jsonb,'72'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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

  v_archive:=jsonb_build_object('schema','CeoPrivateArchive@1','archive_id',gen_random_uuid(),'source_schema_version',72,'owner_person_id',p_person_id,
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
