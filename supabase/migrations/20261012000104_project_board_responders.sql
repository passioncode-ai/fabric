-- 87 (by count; suffix 104) — the project board's responders, COM-03 of
-- `docs/evidence/plans/2026-10-04-project-communications.md`, decided in ADR-0149 §2–§6 and contract DEC-0073
-- (fabric-agent-contract edc88a6, pinned by the same change).
--
-- NUMBERS. `schema_version()` counts applied migrations, so this file makes the schema 87. Suffixes 105/106 stay the
-- task pipeline's prose reservation (`docs/evidence/plans/task-pipeline-persistence-contract.md`).
--
-- WHAT THIS ADDS:
--   * Responder slots, enrollments and attempts (`board_responder_slots`, `board_enrollments`, `board_attempts`): one
--     slot per (Project, capability) with a generation that only grows, one live enrollment per slot, one live attempt
--     per request (COM03-02, -03).
--   * `board_enroll`, `board_claim`, the fence (`board_fence`) and the responder transitions `board_accept`,
--     `board_renew`, `board_progress`, `board_effect_begin`, `board_complete`, `board_reconcile`,
--     `board_responder_replace` and a responder's `board_reply_fenced` (COM03-04…-08).
--   * Release on session end and on revocation (`board_release_session`, `board_release_grant`; COM03-10): a release
--     is not an operation (DEC-0073 §5) — it moves no request.
--   * `board_join_check` for `fabric.board.join` (COM03-09), `board_responders_json` for com.status (COM03-11),
--     `board_responders_operator` for the operator's screens (COM03-13), and the project directory
--     (`board_directory`, `board_set_listing`; DEC-0073 §8).
--
-- AUTHORITY (ADR-0149 §2–§3). Responding is the standing grant callee `fabric`, capability `board.respond`, resource
-- `board:<project>/<capability>` (`access_grants`). The holder — session, how it came in, its runner, its binding —
-- is built by the host from the authenticated endpoint (`p_holder`), never from the arguments. The grant is read again
-- inside every command, in the statement that commits it: a revoked grant is `authority_changed`.
--
-- THE RESTORE (ADR-0149 §6, COM03-12). A restored board keeps its history and switches authority off — and appends
-- NOTHING to the journal to do so: a verified restore checks, before it commits, that the restored journal is exactly
-- the archive's prefix (`restore_estate_verified`, migration 66), and an owner's later private-history import checks
-- the event count and the watermark again (`archive_stale`). So the settle is a projection rule, migration 77's for
-- the hub (`apply_hub_access`): at or below the target's restore watermark a `claimed` request projects as `queued`, an
-- `in_progress` one as `outcome_unknown` with effect `unknown` (an accepted one is held), an enrollment projects
-- released (cause `restore`) and holds no slot, an attempt projects ended, and an epoch the source opened projects
-- closed, so the next submit opens a fresh one (C6: the receipts did not travel). The slot's generation still projects:
-- it only grows and survives the restore. A rebuild replays the same rule, so it is deterministic.
--
-- LOCK ORDER (ADR-0149 §5): the slot's advisory lock (4245), then the request row `FOR UPDATE`, then the idempotency
-- key's lock (4243, the gate), then `append_event`'s estate lock (4242). Leases are compared with `clock_timestamp()`.
--
-- OPERATIONAL, NOT PROJECTED: `board_responder_slots.lease_until` and `board_attempts.lease_until` are written by
-- commands only (renewals are not journalled, ADR-0149 §5). Everything else here projects from the journal, except
-- `board_progress_notes`, a primary row beside the message it records.

-- #region project-board-responders — docs: docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md#decision

insert into event_types (type, projects, note) values
  ('comms.responder_enrolled@1', true, 'a session took a Project''s responder slot for one capability (enroll, a lapsed holder''s slot, or a replacement), under the operator''s board.respond grant; the generation, the session and the grant, never a body'),
  ('comms.responder_released@1', true, 'a responder enrollment ended: its session ended or its grant was revoked; a release moves no request'),
  ('comms.directory_listing_set@1', true, 'the operator listed or unlisted a Project in the project directory; discovery only, it refuses no message');

-- ── 1 · tables ──────────────────────────────────────────────────────────────────────────────────────────────
create table board_responder_slots (
  estate_id          uuid not null,
  project_id         uuid not null,
  capability         text not null check (capability ~ '^[a-z][a-z0-9._-]{1,127}$'),
  generation         bigint not null default 0 check (generation >= 0),
  holder_enrollment  uuid,
  lease_until        timestamptz,            -- operational
  updated_seq        bigint not null,
  primary key (estate_id, project_id, capability)
);
create table board_enrollments (
  estate_id       uuid not null,
  id              uuid not null,
  project_id      uuid not null,
  capability      text not null,
  generation      bigint not null check (generation >= 1),
  session_id      text not null check (length(session_id) between 1 and 200),
  came_in         text not null check (came_in in ('launched', 'enrolled', 'handed-off', 'hub')),
  agent           text,
  binding_id      uuid,
  grant_id        uuid not null,
  principal       jsonb not null,
  enrolled_seq    bigint not null,
  released_seq    bigint,
  released_cause  text check (released_cause in ('session-ended', 'revoked', 'replaced', 'restore')),
  primary key (estate_id, id),
  check ((released_seq is null) = (released_cause is null))
);
create unique index board_enrollments_one_live on board_enrollments (estate_id, project_id, capability) where released_seq is null;
create index board_enrollments_session on board_enrollments (estate_id, session_id) where released_seq is null;
create index board_enrollments_grant on board_enrollments (estate_id, grant_id) where released_seq is null;
create table board_attempts (
  estate_id      uuid not null,
  id             uuid not null,
  request_id     uuid not null,
  generation     bigint not null check (generation >= 1),
  enrollment_id  uuid not null,
  claimed_seq    bigint not null,
  lease_until    timestamptz,                -- operational
  ended_seq      bigint,
  ended_cause    text check (ended_cause in ('lapsed', 'replaced', 'released', 'completed', 'cancelled', 'expired', 'lost_result', 'restore')),
  primary key (estate_id, id),
  check ((ended_seq is null) = (ended_cause is null))
);
-- One fenced claim per request (COM03-03): at most one live attempt.
create unique index board_attempts_one_live on board_attempts (estate_id, request_id) where ended_seq is null;
create index board_attempts_enrollment on board_attempts (estate_id, enrollment_id) where ended_seq is null;
alter table board_requests add column generation bigint, add column attempt_id uuid;
-- A progress note is posted at most once per attempt and key (DEC-0073 §3): the note's message is its record.
create table board_progress_notes (
  estate_id   uuid not null,
  attempt_id  uuid not null,
  key         text not null check (key ~ '^[A-Za-z0-9._:-]{8,128}$'),
  message_id  uuid not null,
  digest      text not null check (digest ~ '^sha256:[0-9a-f]{64}$'),
  primary key (estate_id, attempt_id, key)
);
create trigger board_progress_note_immutable before update on board_progress_notes for each row execute function board_primary_immutable();
-- The operator's directory listing per Project (DEC-0073 §8): a projection, so it survives a restore.
create table board_directory_listings (
  estate_id    uuid not null,
  project_id   uuid not null,
  unlisted     boolean not null,
  updated_seq  bigint not null,
  primary key (estate_id, project_id)
);

alter table board_responder_slots enable row level security;
alter table board_enrollments enable row level security;
alter table board_attempts enable row level security;
alter table board_progress_notes enable row level security;
alter table board_directory_listings enable row level security;
revoke all on board_responder_slots, board_enrollments, board_attempts, board_progress_notes, board_directory_listings
  from public, anon, authenticated, service_role;

-- ── 2 · helpers ─────────────────────────────────────────────────────────────────────────────────────────────
create function board_lease_seconds() returns integer language sql immutable set search_path = public as $$ select 60 $$;
create function board_lease_until() returns timestamptz language sql volatile set search_path = public as $$
  select clock_timestamp() + make_interval(secs => board_lease_seconds())
$$;

-- The holder the host built from the authenticated endpoint: {session_id, came_in, agent, binding_id, label}.
create function board_holder_valid(h jsonb) returns boolean language sql immutable set search_path = public as $$
  select coalesce(jsonb_typeof(h) = 'object'
    and not exists (select 1 from jsonb_object_keys(h) k where k not in ('session_id', 'came_in', 'agent', 'binding_id', 'label'))
    and jsonb_typeof(h->'session_id') = 'string' and length(h->>'session_id') between 1 and 200
    and h->>'came_in' in ('launched', 'enrolled', 'handed-off', 'hub')
    and (h->'agent' is null or h->'agent' = 'null'::jsonb or (jsonb_typeof(h->'agent') = 'string' and length(h->>'agent') between 1 and 200))
    and (h->'binding_id' is null or h->'binding_id' = 'null'::jsonb or (h->>'binding_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    and (h->'label' is null or h->'label' = 'null'::jsonb or (jsonb_typeof(h->'label') = 'string' and length(h->>'label') <= 80))
    -- An enrolled or board session answers under its own binding's grant; it must name it.
    and (h->>'came_in' not in ('enrolled', 'hub') or (h->>'binding_id') is not null), false)
$$;

-- The principal a responder's messages carry: the session, verified by the endpoint (ADR-0149 §1).
create function board_holder_principal(h jsonb) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_strip_nulls(jsonb_build_object('kind', 'agent', 'id', h->>'session_id', 'label', nullif(h->>'label', ''), 'provenance', 'trusted'))
$$;

create function board_actor(h jsonb) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('kind', 'agent', 'id', h->>'session_id')
$$;

-- ADR-0149 §3: which live board.respond grant a holder answers under. An enrolled or board session: its own binding's.
-- A launched or handed-off session: a live grant of a binding of its runner. Never from a pid, model, origin or label.
create function board_grant_for(p_estate uuid, p_holder jsonb, p_project uuid, p_capability text) returns uuid
language sql stable security definer set search_path = public as $$
  select g.id from access_grants g join access_bindings b on b.estate_id = g.estate_id and b.id = g.binding_id
   where g.estate_id = p_estate and g.callee = 'fabric' and g.capability = 'board.respond'
     and g.resource = 'board:' || p_project::text || '/' || p_capability
     and g.revoked_at is null and g.expires_at > clock_timestamp() and b.revoked_at is null
     and case when p_holder->>'came_in' in ('enrolled', 'hub') then g.binding_id::text = p_holder->>'binding_id'
              else b.agent_id = p_holder->>'agent' end
   order by g.decided_seq desc limit 1
$$;

create function board_grant_live(p_estate uuid, p_grant uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from access_grants g join access_bindings b on b.estate_id = g.estate_id and b.id = g.binding_id
                  where g.estate_id = p_estate and g.id = p_grant and g.revoked_at is null and g.expires_at > clock_timestamp()
                    and b.revoked_at is null)
$$;

create function board_slot_lock(p_estate uuid, p_project uuid, p_capability text) returns void
language sql volatile set search_path = public as $$
  select pg_advisory_xact_lock(hashtextextended(p_estate::text || '/slot/' || p_project::text || '/' || p_capability, 4245))
$$;

create function board_is_uuid(v text) returns boolean language sql immutable set search_path = public as $$
  select coalesce(v ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', false)
$$;

create function board_slot_json(p_estate uuid, p_project uuid, p_capability text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('project', s.project_id, 'capability', s.capability, 'generation', s.generation, 'leaseExpiresAt', board_at(s.lease_until))
    from board_responder_slots s where s.estate_id = p_estate and s.project_id = p_project and s.capability = p_capability
$$;

create function board_attempt_json(p_estate uuid, p_attempt uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', a.id, 'generation', a.generation, 'digest', m.digest, 'leaseExpiresAt', board_at(a.lease_until))
    from board_attempts a join board_messages m on m.estate_id = a.estate_id and m.id = a.request_id
   where a.estate_id = p_estate and a.id = p_attempt
$$;

create function board_request_json(p_estate uuid, p_request uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', r.message_id, 'state', r.state, 'effect', r.effect, 'revision', r.revision)
    from board_requests r where r.estate_id = p_estate and r.message_id = p_request
$$;

-- One transition of a request, as an event, with the responder's facts (generation, attempt, enrollment, outcome).
-- The caller holds the slot lock and the request row and has decided the transition is legal.
create function board_move(p_estate uuid, p_request uuid, p_op text, p_to text, p_effect_to text, p_cause text, p_actor jsonb, p_extra jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r board_requests; v_digest text; j journal;
begin
  select * into r from board_requests where estate_id = p_estate and message_id = p_request;
  select m.digest into v_digest from board_messages m where m.estate_id = p_estate and m.id = p_request;
  j := board_append(p_estate, 'comms.request_transitioned@1', p_actor, jsonb_strip_nulls(jsonb_build_object(
    'request_id', p_request, 'project_id', r.target_project, 'capability', r.capability, 'op', p_op,
    'from', r.state, 'to', p_to, 'effect_from', r.effect, 'effect_to', p_effect_to, 'revision', r.revision + 1,
    'cause', p_cause, 'digest', v_digest) || coalesce(p_extra, '{}'::jsonb)));
  return jsonb_build_object('request', jsonb_build_object('id', p_request, 'state', p_to, 'effect', p_effect_to, 'revision', r.revision + 1),
                            'seq', j.seq, 'at', board_at(j.occurred_at));
end $$;

-- A responder's message on a request's thread: a fenced reply, a progress note, an effect summary, a checkpoint. The
-- payload carries the fence (generation, attempt, enrollment), never the body.
create function board_insert_fenced_message(p_estate uuid, p_project uuid, p_holder jsonb, p_request uuid, p_body text, p_format text,
  p_artifacts jsonb, p_digest text, p_operation text, p_fence jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_message uuid := gen_random_uuid(); v_thread uuid; v_principal jsonb := board_holder_principal(p_holder); j journal;
begin
  select m.thread_id into v_thread from board_messages m where m.estate_id = p_estate and m.id = p_request;
  j := board_append(p_estate, 'comms.message_submitted@1', board_actor(p_holder), jsonb_build_object(
    'message_id', v_message, 'thread_id', v_thread, 'kind', 'reply', 'sender_project_id', p_project,
    'principal', v_principal, 'digest', p_digest, 'reply_to', p_request, 'artifact_count', jsonb_array_length(p_artifacts),
    'thread_new', null, 'request', null, 'operation', p_operation, 'fence', p_fence));
  insert into board_messages values (v_message, p_estate, v_thread, j.seq, p_project, v_principal, 'reply', p_digest, p_request, p_artifacts, j.occurred_at);
  insert into board_bodies values (v_message, p_estate, p_body, p_format);
  return jsonb_build_object('message', v_message, 'thread', v_thread, 'at', board_at(j.occurred_at));
end $$;

-- The shape checks a responder command's arguments share. Null when they pass.
create function board_fence_shape_refusal(f jsonb) returns jsonb language sql immutable set search_path = public as $$
  select case when jsonb_typeof(f) is distinct from 'object'
                or exists (select 1 from jsonb_object_keys(f) k where k not in ('request', 'generation', 'attempt', 'digest', 'expectedRevision', 'idempotency'))
                or not board_is_uuid(f->>'request') or not board_is_uuid(f->>'attempt')
                or jsonb_typeof(f->'generation') is distinct from 'number' or (f->>'generation') !~ '^[1-9][0-9]{0,15}$'
                or coalesce(f->>'digest', '') !~ '^sha256:[0-9a-f]{64}$'
                or (f ? 'expectedRevision' and (jsonb_typeof(f->'expectedRevision') is distinct from 'number' or (f->>'expectedRevision') !~ '^[1-9][0-9]{0,15}$'))
              then board_refusal('invalid_arguments', 'The fence is missing or malformed.')
              else board_idempotency_refusal(f) end
$$;

-- The command's own preamble: the holder, the digest and the active Project. Null when they pass.
create function board_responder_refusal(p_estate uuid, p_holder jsonb, p_project uuid, p_args jsonb, p_digest text, p_keys text[]) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if p_estate is null or p_project is null or not board_holder_valid(p_holder) or jsonb_typeof(p_args) is distinct from 'object'
     or p_digest is null or p_digest !~ '^sha256:[0-9a-f]{64}$' then
    return board_refusal('invalid_arguments', 'The call is not a valid board call.');
  end if;
  if exists (select 1 from jsonb_object_keys(p_args) k where not (k = any (p_keys))) then
    return board_refusal('invalid_arguments', 'The call carries a field the board does not take.');
  end if;
  if not board_is_project(p_estate, p_project) then
    return board_refusal('not_authorized', 'This Project may not write to the board.');
  end if;
  return null;
end $$;

-- What happens to older generations' requests when a new holder takes a slot (DEC-0073 §5, the lifecycle table).
--   'stale' (a lapsed holder replaced, or com.responder_replace): claimed → queued (op replace); in_progress →
--           outcome_unknown (op lost_result); accepted held.
--   'empty' (the slot was left empty by a release): in_progress → outcome_unknown (op lost_result); a released claimed
--           request stays claimed and the next com.claim takes it as a lapsed claim; accepted held.
create function board_replacement_effects(p_estate uuid, p_project uuid, p_capability text, p_generation bigint, p_mode text, p_actor jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare r board_requests; n integer := 0;
begin
  for r in select * from board_requests where estate_id = p_estate and target_project = p_project and capability = p_capability
             and state in ('claimed', 'in_progress') and coalesce(generation, 0) < p_generation order by submitted_seq for update loop
    if r.state = 'in_progress' then
      perform board_move(p_estate, r.message_id, 'lost_result', 'outcome_unknown', 'unknown', 'replaced', p_actor, jsonb_build_object('generation', p_generation));
      n := n + 1;
    elsif p_mode = 'stale' then
      perform board_move(p_estate, r.message_id, 'replace', 'queued', r.effect, 'replaced', p_actor, jsonb_build_object('generation', p_generation));
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- ── 3 · enroll and replace ──────────────────────────────────────────────────────────────────────────────────
-- `com.enroll` (DEC-0073, comms-enroll): take the Project's slot for one capability.
create function board_enroll(p_estate uuid, p_holder jsonb, p_project uuid, p_args jsonb, p_digest text)
returns jsonb language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare s jsonb := p_args; v_refusal jsonb; v_gate jsonb; v_cap text; v_grant uuid; slot board_responder_slots; holder board_enrollments;
        v_gen bigint; v_enrollment uuid := gen_random_uuid(); v_cause text; v_receipt jsonb; v_epoch integer; v_key text;
begin
  v_refusal := board_responder_refusal(p_estate, p_holder, p_project, s, p_digest, array['idempotency', 'capability']);
  if v_refusal is not null then return v_refusal; end if;
  v_refusal := board_idempotency_refusal(s);
  if v_refusal is not null then return v_refusal; end if;
  v_cap := s->>'capability';
  if coalesce(v_cap, '') !~ '^[a-z][a-z0-9._-]{1,127}$' then return board_refusal('invalid_arguments', 'Name the capability whose requests you will answer.'); end if;
  -- The grant first: no grant, no write of any kind — not even a receipt (COM03-01).
  v_grant := board_grant_for(p_estate, p_holder, p_project, v_cap);
  if v_grant is null then
    return board_refusal('not_authorized', format('Ask the operator to let you answer %s requests for this project.', v_cap));
  end if;
  perform board_slot_lock(p_estate, p_project, v_cap);
  v_epoch := (s->'idempotency'->>'epoch')::integer; v_key := s->'idempotency'->>'key';
  v_gate := board_epoch_gate(p_estate, p_project, 'enroll', v_epoch, v_key, p_digest, true);
  if not (v_gate ? 'fresh') then return v_gate; end if;
  select * into slot from board_responder_slots where estate_id = p_estate and project_id = p_project and capability = v_cap for update;
  if slot.holder_enrollment is not null then
    select * into holder from board_enrollments where estate_id = p_estate and id = slot.holder_enrollment;
  end if;
  if holder.id is not null and holder.released_seq is null and holder.session_id = p_holder->>'session_id' then
    -- The caller already holds it: the same slot, its lease renewed (no event; renewals are operational).
    update board_responder_slots set lease_until = board_lease_until() where estate_id = p_estate and project_id = p_project and capability = v_cap;
  elsif holder.id is not null and holder.released_seq is null and slot.lease_until > clock_timestamp() then
    return board_refusal('fenced', 'Another responder holds this slot; use com.responder_replace.');
  else
    v_gen := coalesce(slot.generation, 0) + 1;
    v_cause := case when holder.id is not null and holder.released_seq is null then 'stale' else 'enroll' end;
    perform board_append(p_estate, 'comms.responder_enrolled@1', board_actor(p_holder), jsonb_strip_nulls(jsonb_build_object(
      'enrollment_id', v_enrollment, 'project_id', p_project, 'capability', v_cap, 'generation', v_gen,
      'session_id', p_holder->>'session_id', 'came_in', p_holder->>'came_in', 'agent', p_holder->>'agent', 'binding_id', p_holder->>'binding_id',
      'grant_id', v_grant, 'principal', board_holder_principal(p_holder), 'cause', v_cause,
      'replaced_enrollment_id', case when v_cause = 'stale' then holder.id end)));
    update board_responder_slots set lease_until = board_lease_until() where estate_id = p_estate and project_id = p_project and capability = v_cap;
    -- DEC-0073 R4: a slot left empty by a release is no lighter a takeover than a lapsed holder's for in_progress work.
    perform board_replacement_effects(p_estate, p_project, v_cap, v_gen, case when v_cause = 'stale' then 'stale' else 'empty' end, board_actor(p_holder));
  end if;
  v_receipt := jsonb_build_object('ok', true, 'repeated', false, 'slot', board_slot_json(p_estate, p_project, v_cap));
  perform board_store_receipt(p_estate, p_project, 'enroll', v_epoch, v_key, p_digest, v_receipt);
  return v_receipt;
end $$;

-- `com.responder_replace` (comms-responder-replace): take the slot even from a live holder, at the generation the
-- caller read; accepted requests continue only by an explicit checkpoint transfer.
create function board_responder_replace(p_estate uuid, p_holder jsonb, p_project uuid, p_args jsonb, p_digest text)
returns jsonb language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare s jsonb := p_args; v_refusal jsonb; v_gate jsonb; v_cap text; v_grant uuid; slot board_responder_slots; v_gen bigint; v_old uuid;
        v_enrollment uuid := gen_random_uuid(); v_receipt jsonb; v_epoch integer; v_key text; x text; r board_requests; v_attempt uuid;
        v_transfer uuid[] := '{}'; v_summary text; v_evidence jsonb; v_fence jsonb; v_digest text;
begin
  v_refusal := board_responder_refusal(p_estate, p_holder, p_project, s, p_digest, array['idempotency', 'capability', 'expectedGeneration', 'transfer']);
  if v_refusal is not null then return v_refusal; end if;
  v_refusal := board_idempotency_refusal(s);
  if v_refusal is not null then return v_refusal; end if;
  v_cap := s->>'capability';
  if coalesce(v_cap, '') !~ '^[a-z][a-z0-9._-]{1,127}$' then return board_refusal('invalid_arguments', 'Name the capability whose slot you take.'); end if;
  if jsonb_typeof(s->'expectedGeneration') is distinct from 'number' or (s->>'expectedGeneration') !~ '^[0-9]{1,16}$' then
    return board_refusal('invalid_arguments', 'expectedGeneration is the slot generation com.status showed you.');
  end if;
  if s ? 'transfer' then
    if jsonb_typeof(s->'transfer') is distinct from 'object' or exists (select 1 from jsonb_object_keys(s->'transfer') k where k not in ('requests', 'checkpoint'))
       or jsonb_typeof(s->'transfer'->'requests') is distinct from 'array' or jsonb_array_length(s->'transfer'->'requests') not between 1 and 64
       or (select count(*) <> count(distinct value) from jsonb_array_elements_text(s->'transfer'->'requests'))
       or jsonb_typeof(s->'transfer'->'checkpoint') is distinct from 'object'
       or exists (select 1 from jsonb_object_keys(s->'transfer'->'checkpoint') k where k not in ('summary', 'evidence'))
       or jsonb_typeof(s->'transfer'->'checkpoint'->'summary') is distinct from 'string'
       or length(s->'transfer'->'checkpoint'->>'summary') not between 1 and 2000
       or jsonb_typeof(coalesce(s->'transfer'->'checkpoint'->'evidence', '[]'::jsonb)) is distinct from 'array'
       or jsonb_array_length(coalesce(s->'transfer'->'checkpoint'->'evidence', '[]'::jsonb)) > 8 then
      return board_refusal('invalid_arguments', 'A transfer names 1 to 64 accepted requests and a checkpoint summary.');
    end if;
    for x in select value from jsonb_array_elements_text(s->'transfer'->'requests') loop
      if not board_is_uuid(x) then return board_refusal('invalid_arguments', 'A transferred request must be an accepted request of this Project and capability.'); end if;
      v_transfer := v_transfer || x::uuid;
    end loop;
    v_summary := s->'transfer'->'checkpoint'->>'summary';
    v_evidence := coalesce(s->'transfer'->'checkpoint'->'evidence', '[]'::jsonb);
  end if;
  v_grant := board_grant_for(p_estate, p_holder, p_project, v_cap);
  if v_grant is null then
    return board_refusal('not_authorized', format('Ask the operator to let you answer %s requests for this project.', v_cap));
  end if;
  perform board_slot_lock(p_estate, p_project, v_cap);
  v_epoch := (s->'idempotency'->>'epoch')::integer; v_key := s->'idempotency'->>'key';
  v_gate := board_epoch_gate(p_estate, p_project, 'responder_replace', v_epoch, v_key, p_digest, true);
  if not (v_gate ? 'fresh') then return v_gate; end if;
  select * into slot from board_responder_slots where estate_id = p_estate and project_id = p_project and capability = v_cap for update;
  if coalesce(slot.generation, 0) <> (s->>'expectedGeneration')::bigint then
    return board_refusal('revision_conflict', format('The slot is at generation %s, not %s; read com.status and decide again.', coalesce(slot.generation, 0), s->>'expectedGeneration'));
  end if;
  -- Every transferred request is checked before the first write.
  for r in select * from board_requests where estate_id = p_estate and message_id = any (v_transfer) order by submitted_seq for update loop
    if r.target_project <> p_project or r.capability <> v_cap or r.state <> 'accepted' then
      return board_refusal('invalid_arguments', 'A transferred request must be an accepted request of this Project and capability.');
    end if;
  end loop;
  if (select count(*) from board_requests where estate_id = p_estate and message_id = any (v_transfer)) <> cardinality(v_transfer) then
    return board_refusal('invalid_arguments', 'A transferred request must be an accepted request of this Project and capability.');
  end if;
  v_gen := coalesce(slot.generation, 0) + 1;
  select id into v_old from board_enrollments where estate_id = p_estate and id = slot.holder_enrollment and released_seq is null;
  perform board_append(p_estate, 'comms.responder_enrolled@1', board_actor(p_holder), jsonb_strip_nulls(jsonb_build_object(
    'enrollment_id', v_enrollment, 'project_id', p_project, 'capability', v_cap, 'generation', v_gen,
    'session_id', p_holder->>'session_id', 'came_in', p_holder->>'came_in', 'agent', p_holder->>'agent', 'binding_id', p_holder->>'binding_id',
    'grant_id', v_grant, 'principal', board_holder_principal(p_holder), 'cause', 'replace', 'replaced_enrollment_id', v_old,
    'transfer', case when cardinality(v_transfer) > 0 then to_jsonb(v_transfer) end)));
  update board_responder_slots set lease_until = board_lease_until() where estate_id = p_estate and project_id = p_project and capability = v_cap;
  perform board_replacement_effects(p_estate, p_project, v_cap, v_gen, 'stale', board_actor(p_holder));
  -- The transfer: each accepted request continues under a new attempt of the new generation, and the checkpoint is
  -- posted as a fenced reply on its thread, history its participants read.
  foreach x in array (select array_agg(v::text) from unnest(v_transfer) v) loop
    exit when x is null;
    v_attempt := gen_random_uuid();
    perform board_move(p_estate, x::uuid, 'replace', 'accepted', (select effect from board_requests where estate_id = p_estate and message_id = x::uuid),
      'replaced', board_actor(p_holder), jsonb_build_object('generation', v_gen, 'attempt_id', v_attempt, 'enrollment_id', v_enrollment));
    update board_attempts set lease_until = board_lease_until() where estate_id = p_estate and id = v_attempt;
    v_fence := jsonb_build_object('generation', v_gen, 'attempt_id', v_attempt, 'enrollment_id', v_enrollment);
    perform board_insert_fenced_message(p_estate, p_project, p_holder, x::uuid, v_summary, 'text/plain', v_evidence, p_digest, 'com.responder_replace', v_fence);
  end loop;
  v_receipt := jsonb_build_object('ok', true, 'repeated', false, 'slot', board_slot_json(p_estate, p_project, v_cap));
  perform board_store_receipt(p_estate, p_project, 'responder_replace', v_epoch, v_key, p_digest, v_receipt);
  return v_receipt;
end $$;

-- ── 4 · claim ───────────────────────────────────────────────────────────────────────────────────────────────
-- The caller's live enrollment in a slot, or a refusal: no grant at all → not_authorized; a grant but no slot →
-- fenced; a slot whose grant was revoked → authority_changed.
create function board_holder_enrollment(p_estate uuid, p_holder jsonb, p_project uuid, p_capability text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare e board_enrollments;
begin
  select * into e from board_enrollments where estate_id = p_estate and project_id = p_project and capability = p_capability
     and session_id = p_holder->>'session_id' and released_seq is null;
  if not found then
    if board_grant_for(p_estate, p_holder, p_project, p_capability) is null then
      return board_refusal('not_authorized', format('Ask the operator to let you answer %s requests for this project.', p_capability));
    end if;
    return board_refusal('fenced', format('This session does not hold the responder slot for %s; call com.enroll first.', p_capability));
  end if;
  if not board_grant_live(p_estate, e.grant_id) then
    return board_refusal('authority_changed', 'The operator''s grant for this responder was revoked or expired; nothing was done.');
  end if;
  return jsonb_build_object('enrollment', e.id, 'generation', e.generation);
end $$;

-- `com.claim` (comms-claim): the next claimable request for a capability whose slot the caller holds, or the one named.
create function board_claim(p_estate uuid, p_holder jsonb, p_project uuid, p_args jsonb, p_digest text)
returns jsonb language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare s jsonb := p_args; v_refusal jsonb; v_gate jsonb; v_cap text; v_held jsonb; slot board_responder_slots; r board_requests; a board_attempts;
        v_attempt uuid := gen_random_uuid(); v_done jsonb; v_receipt jsonb; v_epoch integer; v_key text; v_actor jsonb := board_actor(p_holder);
begin
  v_refusal := board_responder_refusal(p_estate, p_holder, p_project, s, p_digest, array['idempotency', 'capability', 'request']);
  if v_refusal is not null then return v_refusal; end if;
  v_refusal := board_idempotency_refusal(s);
  if v_refusal is not null then return v_refusal; end if;
  v_cap := s->>'capability';
  if coalesce(v_cap, '') !~ '^[a-z][a-z0-9._-]{1,127}$' then return board_refusal('invalid_arguments', 'Name the capability whose slot you hold.'); end if;
  if s ? 'request' and not board_is_uuid(s->>'request') then return board_refusal('not_authorized', 'This Project cannot claim that request.'); end if;
  perform board_slot_lock(p_estate, p_project, v_cap);
  v_held := board_holder_enrollment(p_estate, p_holder, p_project, v_cap);
  if v_held ? 'error' then return v_held; end if;
  select * into slot from board_responder_slots where estate_id = p_estate and project_id = p_project and capability = v_cap for update;
  if slot.holder_enrollment is distinct from (v_held->>'enrollment')::uuid then
    return board_refusal('fenced', 'A newer responder holds this slot; this call was not committed.');
  end if;
  if slot.lease_until is null or slot.lease_until <= clock_timestamp() then
    return board_refusal('lease_expired', 'Your responder lease lapsed; call com.enroll again.');
  end if;
  v_epoch := (s->'idempotency'->>'epoch')::integer; v_key := s->'idempotency'->>'key';
  v_gate := board_epoch_gate(p_estate, p_project, 'claim', v_epoch, v_key, p_digest, true);
  if not (v_gate ? 'fresh') then return v_gate; end if;

  if s ? 'request' then
    select * into r from board_requests where estate_id = p_estate and message_id = (s->>'request')::uuid
       and target_project = p_project and capability = v_cap for update;
    if not found then return board_refusal('not_authorized', 'This Project cannot claim that request.'); end if;
    select * into a from board_attempts where estate_id = p_estate and request_id = r.message_id and ended_seq is null;
    if r.state in ('queued', 'claimed') and r.deadline is not null and r.deadline < clock_timestamp() then
      perform board_move(p_estate, r.message_id, 'expire', 'expired', r.effect, 'deadline', jsonb_build_object('kind', 'system', 'id', 'board'), null);
      return board_refusal('invalid_transition', 'This request''s deadline passed; it expired.');
    end if;
    if r.state = 'accepted' and a.id is not null and a.enrollment_id = (v_held->>'enrollment')::uuid then
      -- A request transferred to this holder by com.responder_replace: its attempt, read back (nothing moves, nothing
      -- is stored). Fabric's reading of DEC-0073, which gives the transfer's attempts no other way to reach the holder.
      return jsonb_build_object('ok', true, 'repeated', false, 'message', r.message_id, 'request', board_request_json(p_estate, r.message_id),
        'attempt', board_attempt_json(p_estate, a.id));
    end if;
    if not (r.state = 'queued' or (r.state = 'claimed' and (a.id is null or a.lease_until is null or a.lease_until <= clock_timestamp()))) then
      return board_refusal('invalid_transition', format('This request is %s; it cannot be claimed.', replace(r.state, '_', ' ')));
    end if;
  else
    -- A passed deadline expires here too, lazily, before the pick (the tick does the same every minute).
    for r in select * from board_requests where estate_id = p_estate and target_project = p_project and capability = v_cap
               and state in ('queued', 'claimed') and deadline is not null and deadline < clock_timestamp() order by submitted_seq for update skip locked loop
      perform board_move(p_estate, r.message_id, 'expire', 'expired', r.effect, 'deadline', jsonb_build_object('kind', 'system', 'id', 'board'), null);
    end loop;
    r := null;
    select * into r from board_requests where estate_id = p_estate and target_project = p_project and capability = v_cap and state = 'queued'
       and (deadline is null or deadline >= clock_timestamp()) order by submitted_seq limit 1 for update skip locked;
    if r.message_id is null then
      -- A lapsed claim: its attempt ended (a release) or its lease ran out.
      select q.* into r from board_requests q where q.estate_id = p_estate and q.target_project = p_project and q.capability = v_cap and q.state = 'claimed'
         and (q.deadline is null or q.deadline >= clock_timestamp())
         and not exists (select 1 from board_attempts x where x.estate_id = q.estate_id and x.request_id = q.message_id and x.ended_seq is null
                          and x.lease_until > clock_timestamp())
       order by q.submitted_seq limit 1 for update skip locked;
    end if;
    if r.message_id is null then
      -- Nothing claimable: no receipt is stored, so the same key may poll again (DEC-0073 §3).
      return jsonb_build_object('ok', true, 'repeated', false);
    end if;
  end if;
  v_done := board_move(p_estate, r.message_id, 'claim', 'claimed', r.effect, 'responder', v_actor,
    jsonb_build_object('generation', slot.generation, 'attempt_id', v_attempt, 'enrollment_id', (v_held->>'enrollment')::uuid));
  update board_attempts set lease_until = board_lease_until() where estate_id = p_estate and id = v_attempt;
  update board_responder_slots set lease_until = board_lease_until() where estate_id = p_estate and project_id = p_project and capability = v_cap;
  v_receipt := jsonb_build_object('ok', true, 'repeated', false, 'message', r.message_id, 'request', v_done->'request',
    'attempt', board_attempt_json(p_estate, v_attempt));
  perform board_store_receipt(p_estate, p_project, 'claim', v_epoch, v_key, p_digest, v_receipt);
  return v_receipt;
end $$;

-- ── 5 · the fence and the fenced commands ───────────────────────────────────────────────────────────────────
-- THE FENCE (C4, ADR-0117 §4), checked in the statement that commits, in this order, each item one refusal:
--  1 the request exists and targets the caller's Project (absent and foreign answer alike: not_authorized);
--  2 the slot's lock, then the request row;
--  3 the enrollment the fence names still has a live grant (authority_changed);
--  4 the idempotency gate (renew and progress: shape and epoch only);
--  5 the digest (digest_conflict); 6 the generation and the holder (fenced); 7 the attempt (fenced);
--  8 the slot's and the attempt's leases (lease_expired); 9 the expected revision (revision_conflict).
-- The command decides 10, the transition. Answers {ok, enrollment, generation, attempt, request} or a refusal; a
-- stored receipt comes back marked {repeat}.
create function board_fence(p_estate uuid, p_holder jsonb, p_project uuid, p_fence jsonb, p_op text, p_digest text) returns jsonb
language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare f jsonb := p_fence; r board_requests; e board_enrollments; slot board_responder_slots; a board_attempts; v_gate jsonb; v_digest text;
        v_store boolean := p_op not in ('renew', 'progress');
begin
  v_gate := board_fence_shape_refusal(f);
  if v_gate is not null then return v_gate; end if;
  -- 1
  select * into r from board_requests where estate_id = p_estate and message_id = (f->>'request')::uuid and target_project = p_project;
  if not found then return board_refusal('not_authorized', 'This Project cannot act on that request.'); end if;
  -- 2
  perform board_slot_lock(p_estate, p_project, r.capability);
  select * into r from board_requests where estate_id = p_estate and message_id = r.message_id for update;
  select * into slot from board_responder_slots where estate_id = p_estate and project_id = p_project and capability = r.capability;
  -- 3: the enrollment this session holds at the fence's generation, released or not; its grant must still be live.
  select * into e from board_enrollments where estate_id = p_estate and project_id = p_project and capability = r.capability
     and session_id = p_holder->>'session_id' and generation = (f->>'generation')::bigint order by enrolled_seq desc limit 1;
  if e.id is not null and not board_grant_live(p_estate, e.grant_id) then
    return board_refusal('authority_changed', 'The operator''s grant for this responder was revoked or expired; nothing was done.');
  end if;
  -- 4
  v_gate := board_epoch_gate(p_estate, p_project, p_op, (f->'idempotency'->>'epoch')::integer, f->'idempotency'->>'key', p_digest, v_store);
  if not (v_gate ? 'fresh') then
    return case when v_gate ? 'error' then v_gate else jsonb_build_object('repeat', v_gate) end;
  end if;
  -- 5
  select m.digest into v_digest from board_messages m where m.estate_id = p_estate and m.id = r.message_id;
  if v_digest is distinct from f->>'digest' then
    return board_refusal('digest_conflict', 'The fence names another digest than this request''s; read the request again.');
  end if;
  -- 6
  if e.id is null or e.released_seq is not null or slot.generation is distinct from (f->>'generation')::bigint or slot.holder_enrollment is distinct from e.id then
    return board_refusal('fenced', 'A newer responder holds this slot; this call was not committed.');
  end if;
  -- 7
  select * into a from board_attempts where estate_id = p_estate and id = (f->>'attempt')::uuid;
  if a.id is null or a.ended_seq is not null or r.attempt_id is distinct from a.id or a.generation <> (f->>'generation')::bigint then
    return board_refusal('fenced', 'This attempt is no longer the request''s; this call was not committed.');
  end if;
  -- 8
  if slot.lease_until is null or slot.lease_until <= clock_timestamp() or a.lease_until is null or a.lease_until <= clock_timestamp() then
    return board_refusal('lease_expired', 'Your lease lapsed; this call was not committed. Claim the request again if it is still yours to take.');
  end if;
  -- 9
  if f ? 'expectedRevision' and (f->>'expectedRevision')::bigint <> r.revision then
    return board_refusal('revision_conflict', format('The request is at revision %s, not %s; read it and decide again.', r.revision, f->>'expectedRevision'));
  end if;
  return jsonb_build_object('ok', true, 'enrollment', e.id, 'generation', e.generation, 'attempt', a.id, 'request', r.message_id, 'capability', r.capability,
    'state', r.state, 'effect', r.effect);
end $$;

create function board_renew_leases(p_estate uuid, p_project uuid, p_capability text, p_attempt uuid) returns void
language sql volatile security definer set search_path = public as $$
  update board_responder_slots set lease_until = board_lease_until() where estate_id = p_estate and project_id = p_project and capability = p_capability;
  update board_attempts set lease_until = board_lease_until() where estate_id = p_estate and id = p_attempt;
$$;

create function board_fence_extra(c jsonb) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('generation', (c->>'generation')::bigint, 'attempt_id', c->>'attempt', 'enrollment_id', c->>'enrollment')
$$;

-- `com.accept` (comms-fenced): claimed → accepted. The current responder acknowledged the exact request and digest.
create function board_accept(p_estate uuid, p_holder jsonb, p_project uuid, p_args jsonb, p_digest text)
returns jsonb language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare v_refusal jsonb; c jsonb; v_done jsonb; v_receipt jsonb; f jsonb := p_args->'fence';
begin
  v_refusal := board_responder_refusal(p_estate, p_holder, p_project, p_args, p_digest, array['fence']);
  if v_refusal is not null then return v_refusal; end if;
  c := board_fence(p_estate, p_holder, p_project, f, 'accept', p_digest);
  if c ? 'error' then return c; end if;
  if c ? 'repeat' then return c->'repeat'; end if;
  if c->>'state' <> 'claimed' then
    return board_refusal('invalid_transition', format('This request is %s; only a claimed request is accepted.', replace(c->>'state', '_', ' ')));
  end if;
  v_done := board_move(p_estate, (c->>'request')::uuid, 'accept', 'accepted', c->>'effect', 'responder', board_actor(p_holder), board_fence_extra(c));
  perform board_renew_leases(p_estate, p_project, c->>'capability', (c->>'attempt')::uuid);
  v_receipt := jsonb_build_object('ok', true, 'repeated', false, 'request', v_done->'request');
  perform board_store_receipt(p_estate, p_project, 'accept', (f->'idempotency'->>'epoch')::integer, f->'idempotency'->>'key', p_digest, v_receipt);
  return v_receipt;
end $$;

-- `com.renew` (comms-fenced): both leases, no state. Naturally idempotent: nothing stored, repeated is false.
create function board_renew(p_estate uuid, p_holder jsonb, p_project uuid, p_args jsonb, p_digest text)
returns jsonb language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare v_refusal jsonb; c jsonb;
begin
  v_refusal := board_responder_refusal(p_estate, p_holder, p_project, p_args, p_digest, array['fence']);
  if v_refusal is not null then return v_refusal; end if;
  c := board_fence(p_estate, p_holder, p_project, p_args->'fence', 'renew', p_digest);
  if c ? 'error' then return c; end if;
  perform board_renew_leases(p_estate, p_project, c->>'capability', (c->>'attempt')::uuid);
  return jsonb_build_object('ok', true, 'repeated', false, 'slot', board_slot_json(p_estate, p_project, c->>'capability'),
    'attempt', board_attempt_json(p_estate, (c->>'attempt')::uuid));
end $$;

-- `com.progress` (comms-progress): renew, and a note posted at most once per attempt and key; a repeat finds that
-- note's message, and the same key with another note is idempotency_conflict, judged against the message's digest.
create function board_progress(p_estate uuid, p_holder jsonb, p_project uuid, p_args jsonb, p_digest text)
returns jsonb language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare v_refusal jsonb; c jsonb; n board_progress_notes; v_written jsonb; v_key text := p_args->'fence'->'idempotency'->>'key'; v_repeated boolean := false;
        v_message uuid;
begin
  v_refusal := board_responder_refusal(p_estate, p_holder, p_project, p_args, p_digest, array['fence', 'note']);
  if v_refusal is not null then return v_refusal; end if;
  if p_args ? 'note' and (jsonb_typeof(p_args->'note') is distinct from 'object'
      or exists (select 1 from jsonb_object_keys(p_args->'note') k where k <> 'text')
      or jsonb_typeof(p_args->'note'->'text') is distinct from 'string' or length(p_args->'note'->>'text') not between 1 and 2000) then
    return board_refusal('invalid_arguments', 'A progress note is a text of 1 to 2,000 characters.');
  end if;
  c := board_fence(p_estate, p_holder, p_project, p_args->'fence', 'progress', p_digest);
  if c ? 'error' then return c; end if;
  if p_args ? 'note' then
    select * into n from board_progress_notes where estate_id = p_estate and attempt_id = (c->>'attempt')::uuid and key = v_key;
    if found then
      if n.digest <> p_digest then return board_refusal('idempotency_conflict', 'This idempotency key already posted a different note for this attempt.'); end if;
      v_message := n.message_id; v_repeated := true;
    else
      v_written := board_insert_fenced_message(p_estate, p_project, p_holder, (c->>'request')::uuid, p_args->'note'->>'text', 'text/plain', '[]'::jsonb,
        p_digest, 'com.progress', board_fence_extra(c));
      v_message := (v_written->>'message')::uuid;
      insert into board_progress_notes values (p_estate, (c->>'attempt')::uuid, v_key, v_message, p_digest);
    end if;
  end if;
  perform board_renew_leases(p_estate, p_project, c->>'capability', (c->>'attempt')::uuid);
  return jsonb_strip_nulls(jsonb_build_object('ok', true, 'repeated', v_repeated, 'slot', board_slot_json(p_estate, p_project, c->>'capability'),
    'attempt', board_attempt_json(p_estate, (c->>'attempt')::uuid), 'message', v_message));
end $$;

-- `com.effect_begin` (comms-effect-begin): accepted → in_progress, effect not_started → started. From here only an
-- observed result settles the request. A summary is posted on the request's thread for its readers.
create function board_effect_begin(p_estate uuid, p_holder jsonb, p_project uuid, p_args jsonb, p_digest text)
returns jsonb language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare v_refusal jsonb; c jsonb; v_done jsonb; v_receipt jsonb; f jsonb := p_args->'fence';
begin
  v_refusal := board_responder_refusal(p_estate, p_holder, p_project, p_args, p_digest, array['fence', 'summary']);
  if v_refusal is not null then return v_refusal; end if;
  if p_args ? 'summary' and (jsonb_typeof(p_args->'summary') is distinct from 'string' or length(p_args->>'summary') not between 1 and 2000) then
    return board_refusal('invalid_arguments', 'A summary is 1 to 2,000 characters.');
  end if;
  c := board_fence(p_estate, p_holder, p_project, f, 'effect_begin', p_digest);
  if c ? 'error' then return c; end if;
  if c ? 'repeat' then return c->'repeat'; end if;
  if c->>'state' <> 'accepted' then
    return board_refusal('invalid_transition', format('This request is %s; an effect begins only on an accepted request.', replace(c->>'state', '_', ' ')));
  end if;
  v_done := board_move(p_estate, (c->>'request')::uuid, 'effect_begin', 'in_progress', 'started', 'responder', board_actor(p_holder), board_fence_extra(c));
  if p_args ? 'summary' then
    perform board_insert_fenced_message(p_estate, p_project, p_holder, (c->>'request')::uuid, p_args->>'summary', 'text/plain', '[]'::jsonb,
      p_digest, 'com.effect_begin', board_fence_extra(c));
  end if;
  perform board_renew_leases(p_estate, p_project, c->>'capability', (c->>'attempt')::uuid);
  v_receipt := jsonb_build_object('ok', true, 'repeated', false, 'request', v_done->'request');
  perform board_store_receipt(p_estate, p_project, 'effect_begin', (f->'idempotency'->>'epoch')::integer, f->'idempotency'->>'key', p_digest, v_receipt);
  return v_receipt;
end $$;

-- The outcome's shape (comms-complete / comms-reconcile). Null when it passes.
create function board_outcome_refusal(o jsonb, p_observed_required boolean) returns jsonb language sql immutable set search_path = public as $$
  select case when jsonb_typeof(o) is distinct from 'object'
                or exists (select 1 from jsonb_object_keys(o) k where k not in ('state', 'observed', 'summary', 'evidence'))
                or o->>'state' not in ('completed', 'failed_known') or jsonb_typeof(o->'observed') is distinct from 'boolean'
                or (p_observed_required and o->'observed' <> 'true'::jsonb)
                or (o ? 'summary' and (jsonb_typeof(o->'summary') is distinct from 'string' or length(o->>'summary') not between 1 and 2000))
                or jsonb_typeof(coalesce(o->'evidence', '[]'::jsonb)) is distinct from 'array' or jsonb_array_length(coalesce(o->'evidence', '[]'::jsonb)) > 8
              then board_refusal('invalid_arguments', case when p_observed_required then 'An outcome is completed or failed_known, observed, with an optional summary and evidence.'
                                                         else 'An outcome is completed or failed_known, observed or not, with an optional summary and evidence.' end) end
$$;

create function board_outcome_payload(o jsonb) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('state', o->>'state', 'observed', (o->>'observed')::boolean, 'has_summary', o ? 'summary',
    'evidence_count', jsonb_array_length(coalesce(o->'evidence', '[]'::jsonb)))
$$;

-- `com.complete` (comms-complete): accepted → completed / failed_known (nothing began, the effect stays not_started);
-- in_progress → … only with an observed result (succeeded_observed / failed_observed), else observation_required.
create function board_complete(p_estate uuid, p_holder jsonb, p_project uuid, p_args jsonb, p_digest text)
returns jsonb language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare v_refusal jsonb; c jsonb; v_done jsonb; v_receipt jsonb; f jsonb := p_args->'fence'; o jsonb := p_args->'outcome'; v_effect text;
begin
  v_refusal := board_responder_refusal(p_estate, p_holder, p_project, p_args, p_digest, array['fence', 'outcome']);
  if v_refusal is not null then return v_refusal; end if;
  v_refusal := board_outcome_refusal(o, false);
  if v_refusal is not null then return v_refusal; end if;
  c := board_fence(p_estate, p_holder, p_project, f, 'complete', p_digest);
  if c ? 'error' then return c; end if;
  if c ? 'repeat' then return c->'repeat'; end if;
  if c->>'state' = 'accepted' then
    v_effect := c->>'effect';
  elsif c->>'state' = 'in_progress' then
    if o->'observed' <> 'true'::jsonb then
      return board_refusal('observation_required', 'An effect began; only an observed result completes this request. Observe it, or leave it to com.reconcile.');
    end if;
    v_effect := case when o->>'state' = 'completed' then 'succeeded_observed' else 'failed_observed' end;
  else
    return board_refusal('invalid_transition', format('This request is %s; accept it before you complete it.', replace(c->>'state', '_', ' ')));
  end if;
  v_done := board_move(p_estate, (c->>'request')::uuid, 'complete', o->>'state', v_effect, 'responder', board_actor(p_holder),
    board_fence_extra(c) || jsonb_build_object('observed', (o->>'observed')::boolean, 'outcome', board_outcome_payload(o)));
  if o ? 'summary' or jsonb_array_length(coalesce(o->'evidence', '[]'::jsonb)) > 0 then
    insert into board_outcomes (estate_id, request_id, attempt_id, summary, evidence, seq)
    values (p_estate, (c->>'request')::uuid, (c->>'attempt')::uuid, o->>'summary', coalesce(o->'evidence', '[]'::jsonb), (v_done->>'seq')::bigint);
  end if;
  v_receipt := jsonb_build_object('ok', true, 'repeated', false, 'request', v_done->'request');
  perform board_store_receipt(p_estate, p_project, 'complete', (f->'idempotency'->>'epoch')::integer, f->'idempotency'->>'key', p_digest, v_receipt);
  return v_receipt;
end $$;

-- A responder's `com.reply` (comms-reply, the fenced form): a message on the request's thread. A reply is not a
-- completion: the request does not move.
create function board_reply_fenced(p_estate uuid, p_holder jsonb, p_project uuid, p_args jsonb, p_digest text)
returns jsonb language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare v_refusal jsonb; c jsonb; v_written jsonb; v_receipt jsonb; f jsonb := p_args->'fence';
begin
  v_refusal := board_responder_refusal(p_estate, p_holder, p_project, p_args, p_digest, array['fence', 'body', 'artifacts']);
  if v_refusal is not null then return v_refusal; end if;
  v_refusal := board_body_refusal(p_args);
  if v_refusal is not null then return v_refusal; end if;
  c := board_fence(p_estate, p_holder, p_project, f, 'reply', p_digest);
  if c ? 'error' then return c; end if;
  if c ? 'repeat' then return c->'repeat'; end if;
  v_written := board_insert_fenced_message(p_estate, p_project, p_holder, (c->>'request')::uuid, p_args->'body'->>'text',
    coalesce(p_args->'body'->>'format', 'text/plain'), coalesce(p_args->'artifacts', '[]'::jsonb), p_digest, 'com.reply', board_fence_extra(c));
  v_receipt := jsonb_build_object('ok', true, 'repeated', false, 'message', v_written->'message', 'thread', v_written->'thread', 'at', v_written->'at');
  perform board_store_receipt(p_estate, p_project, 'reply', (f->'idempotency'->>'epoch')::integer, f->'idempotency'->>'key', p_digest, v_receipt);
  return v_receipt;
end $$;

-- `com.reconcile` (comms-reconcile): outcome_unknown → completed / failed_known, observed only, by the slot's current
-- holder. Unfenced (the attempt that began the effect is gone): the request's digest is the check instead.
create function board_reconcile(p_estate uuid, p_holder jsonb, p_project uuid, p_args jsonb, p_digest text)
returns jsonb language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare s jsonb := p_args; v_refusal jsonb; v_gate jsonb; r board_requests; v_held jsonb; slot board_responder_slots; v_digest text; v_done jsonb;
        v_receipt jsonb; v_epoch integer; v_key text; o jsonb := p_args->'outcome';
begin
  v_refusal := board_responder_refusal(p_estate, p_holder, p_project, s, p_digest, array['idempotency', 'request', 'digest', 'expectedRevision', 'outcome']);
  if v_refusal is not null then return v_refusal; end if;
  v_refusal := coalesce(board_idempotency_refusal(s), board_outcome_refusal(o, true));
  if v_refusal is not null then return v_refusal; end if;
  if coalesce(s->>'digest', '') !~ '^sha256:[0-9a-f]{64}$'
     or (s ? 'expectedRevision' and (jsonb_typeof(s->'expectedRevision') is distinct from 'number' or (s->>'expectedRevision') !~ '^[1-9][0-9]{0,15}$')) then
    return board_refusal('invalid_arguments', 'Name the request''s digest, and an expected revision of 1 or more if you give one.');
  end if;
  if not board_is_uuid(s->>'request') then return board_refusal('not_authorized', 'This Project cannot act on that request.'); end if;
  select * into r from board_requests where estate_id = p_estate and message_id = (s->>'request')::uuid and target_project = p_project;
  if not found then return board_refusal('not_authorized', 'This Project cannot act on that request.'); end if;
  perform board_slot_lock(p_estate, p_project, r.capability);
  select * into r from board_requests where estate_id = p_estate and message_id = r.message_id for update;
  v_held := board_holder_enrollment(p_estate, p_holder, p_project, r.capability);
  if v_held ? 'error' then return v_held; end if;
  v_epoch := (s->'idempotency'->>'epoch')::integer; v_key := s->'idempotency'->>'key';
  v_gate := board_epoch_gate(p_estate, p_project, 'reconcile', v_epoch, v_key, p_digest, true);
  if not (v_gate ? 'fresh') then return v_gate; end if;
  select m.digest into v_digest from board_messages m where m.estate_id = p_estate and m.id = r.message_id;
  if v_digest is distinct from s->>'digest' then
    return board_refusal('digest_conflict', 'That digest is not this request''s; read the request again.');
  end if;
  select * into slot from board_responder_slots where estate_id = p_estate and project_id = p_project and capability = r.capability;
  if slot.holder_enrollment is distinct from (v_held->>'enrollment')::uuid then
    return board_refusal('fenced', 'A newer responder holds this slot; this call was not committed.');
  end if;
  if slot.lease_until is null or slot.lease_until <= clock_timestamp() then
    return board_refusal('lease_expired', 'Your responder lease lapsed; call com.enroll again.');
  end if;
  if s ? 'expectedRevision' and (s->>'expectedRevision')::bigint <> r.revision then
    return board_refusal('revision_conflict', format('The request is at revision %s, not %s; read it and decide again.', r.revision, s->>'expectedRevision'));
  end if;
  if r.state <> 'outcome_unknown' then
    return board_refusal('invalid_transition', format('This request is %s; only an outcome_unknown request is reconciled.', replace(r.state, '_', ' ')));
  end if;
  v_done := board_move(p_estate, r.message_id, 'reconcile', o->>'state', case when o->>'state' = 'completed' then 'succeeded_observed' else 'failed_observed' end,
    'responder', board_actor(p_holder), jsonb_build_object('generation', slot.generation, 'enrollment_id', (v_held->>'enrollment')::uuid, 'observed', true,
      'outcome', board_outcome_payload(o)));
  if o ? 'summary' or jsonb_array_length(coalesce(o->'evidence', '[]'::jsonb)) > 0 then
    insert into board_outcomes (estate_id, request_id, attempt_id, summary, evidence, seq)
    values (p_estate, r.message_id, null, o->>'summary', coalesce(o->'evidence', '[]'::jsonb), (v_done->>'seq')::bigint);
  end if;
  update board_responder_slots set lease_until = board_lease_until() where estate_id = p_estate and project_id = p_project and capability = r.capability;
  v_receipt := jsonb_build_object('ok', true, 'repeated', false, 'request', v_done->'request');
  perform board_store_receipt(p_estate, p_project, 'reconcile', v_epoch, v_key, p_digest, v_receipt);
  return v_receipt;
end $$;

-- ── 6 · release (COM03-10) ──────────────────────────────────────────────────────────────────────────────────
-- A session's end, or its grant's revocation, releases its enrollments and ends their live attempts. Not an operation:
-- no request moves (DEC-0073 §5). Best effort: the authority recheck inside every transition is what refuses.
create function board_release(p_estate uuid, p_where text, p_value text, p_cause text) returns jsonb
language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare e board_enrollments; n integer := 0;
begin
  for e in select * from board_enrollments where estate_id = p_estate and released_seq is null
             and case p_where when 'session' then session_id = p_value when 'grant' then grant_id::text = p_value else false end
             order by enrolled_seq loop
    perform board_slot_lock(p_estate, e.project_id, e.capability);
    if exists (select 1 from board_enrollments where estate_id = p_estate and id = e.id and released_seq is null) then
      perform board_append(p_estate, 'comms.responder_released@1', jsonb_build_object('kind', 'system', 'id', 'board'), jsonb_build_object(
        'enrollment_id', e.id, 'project_id', e.project_id, 'capability', e.capability, 'generation', e.generation, 'cause', p_cause));
      update board_responder_slots set lease_until = null where estate_id = p_estate and project_id = e.project_id and capability = e.capability and holder_enrollment is null;
      n := n + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'released', n);
end $$;

create function board_release_session(p_estate uuid, p_session text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_estate is null or coalesce(length(p_session), 0) not between 1 and 200 then return board_refusal('invalid_arguments', 'Name the session.'); end if;
  return board_release(p_estate, 'session', p_session, 'session-ended');
end $$;

create function board_release_grant(p_estate uuid, p_grant uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_estate is null or p_grant is null then return board_refusal('invalid_arguments', 'Name the grant.'); end if;
  return board_release(p_estate, 'grant', p_grant::text, 'revoked');
end $$;

-- ── 7 · reads: join, responders, directory ──────────────────────────────────────────────────────────────────
-- `fabric.board.join` (COM03-09): the capabilities a binding may answer for one Project, from its live grants.
create function board_join_check(p_estate uuid, p_binding uuid, p_project uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_caps jsonb;
begin
  if p_estate is null or p_binding is null or p_project is null then return board_refusal('invalid_arguments', 'Name the binding and the Project.'); end if;
  if not board_is_project(p_estate, p_project) then return board_refusal('not_authorized', 'This binding may not join that Project''s board.'); end if;
  select coalesce(jsonb_agg(distinct substr(g.resource, length('board:' || p_project::text || '/') + 1)), '[]'::jsonb) into v_caps
    from access_grants g join access_bindings b on b.estate_id = g.estate_id and b.id = g.binding_id
   where g.estate_id = p_estate and g.binding_id = p_binding and g.callee = 'fabric' and g.capability = 'board.respond'
     and g.resource like 'board:' || p_project::text || '/%' and g.revoked_at is null and g.expires_at > clock_timestamp() and b.revoked_at is null;
  if jsonb_array_length(v_caps) = 0 then return board_refusal('not_authorized', 'This binding may not join that Project''s board.'); end if;
  return jsonb_build_object('ok', true, 'capabilities', (select jsonb_agg(c order by c) from jsonb_array_elements_text(v_caps) c));
end $$;

-- The capabilities a Project takes requests for, as Fabric lists them: those an operator granted board.respond on.
create function board_listed_capabilities(p_estate uuid, p_project uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct substr(g.resource, length('board:' || p_project::text || '/') + 1)), '{}')
    from access_grants g join access_bindings b on b.estate_id = g.estate_id and b.id = g.binding_id
   where g.estate_id = p_estate and g.callee = 'fabric' and g.capability = 'board.respond'
     and g.resource like 'board:' || p_project::text || '/%' and g.revoked_at is null and g.expires_at > clock_timestamp() and b.revoked_at is null
$$;

create function board_responder_state(s board_responder_slots) returns text language sql stable set search_path = public as $$
  select case when s.holder_enrollment is null then 'absent' when s.lease_until > clock_timestamp() then 'active' else 'stale' end
$$;

-- com.status's responders (COM03-11): every capability with a slot, a listed grant or an open request.
create or replace function board_responders_json(p_estate uuid, p_project uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with caps as (
    select capability from board_responder_slots where estate_id = p_estate and project_id = p_project
    union select unnest(board_listed_capabilities(p_estate, p_project))
    union select capability from board_requests where estate_id = p_estate and target_project = p_project
                    and state not in ('completed', 'failed_known', 'cancelled', 'expired')
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'capability', c.capability,
           'state', coalesce(board_responder_state(s), 'absent'),
           'generation', coalesce(s.generation, 0),
           'leaseExpiresAt', case when s.holder_enrollment is not null and s.lease_until is not null then board_at(s.lease_until) end,
           'provenance', case when s.holder_enrollment is not null then 'trusted' end)) order by c.capability), '[]'::jsonb)
    from (select capability from caps order by capability limit 256) c
    left join board_responder_slots s on s.estate_id = p_estate and s.project_id = p_project and s.capability = c.capability
$$;

-- The operator's read (COM03-13): every slot of the estate with who holds it. SQL only; the screen is a later wave.
create function board_responders_operator(p_estate uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', true, 'responders', coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'project', s.project_id, 'capability', s.capability, 'state', board_responder_state(s), 'generation', s.generation,
           'leaseExpiresAt', case when s.holder_enrollment is not null then board_at(s.lease_until) end,
           'agent', e.agent, 'cameIn', e.came_in, 'label', e.principal->>'label',
           'since', (select board_at(j.occurred_at) from journal j where j.estate_id = s.estate_id and j.seq = e.enrolled_seq)))
         order by s.project_id, s.capability), '[]'::jsonb))
    from board_responder_slots s
    left join board_enrollments e on e.estate_id = s.estate_id and e.id = s.holder_enrollment
   where s.estate_id = p_estate
$$;

-- The operator lists or unlists a Project in the directory (DEC-0073 §8). No tool reaches this: the host's operator
-- path calls it (the Settings control is COM-06's). Discovery only; journalled, so it survives a restore.
create function board_set_listing(p_estate uuid, p_project uuid, p_listed boolean, p_actor jsonb) returns jsonb
language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
begin
  if p_estate is null or p_project is null or p_listed is null or jsonb_typeof(p_actor) is distinct from 'object'
     or p_actor->>'kind' not in ('person', 'operator') or coalesce(length(p_actor->>'id'), 0) not between 1 and 200 then
    return board_refusal('invalid_arguments', 'The listing change is not valid.');
  end if;
  if not exists (select 1 from projects where id = p_project and estate_id = p_estate) then
    return board_refusal('not_authorized', 'That Project is not one of this estate.');
  end if;
  perform board_append(p_estate, 'comms.directory_listing_set@1', p_actor, jsonb_build_object('project_id', p_project, 'listed', p_listed));
  return jsonb_build_object('ok', true, 'project', p_project, 'listed', p_listed);
end $$;

-- `com.directory` (comms-directory): the addressable Projects of the reader's estate, by name then id; never the
-- reader itself, never an unlisted one, never content, counts, generations, leases or holders.
create function board_directory(p_estate uuid, p_reader uuid, p_capability text, p_after uuid, p_limit integer) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100); v_after_name text; v_rows jsonb; v_more boolean; v_last uuid;
begin
  if p_estate is null or p_reader is null or (p_capability is not null and p_capability !~ '^[a-z][a-z0-9._-]{1,127}$') then
    return board_refusal('invalid_arguments', 'The directory request is not valid.');
  end if;
  if not board_is_project(p_estate, p_reader) then return board_refusal('not_authorized', 'This Project may not read the directory.'); end if;
  if p_after is not null then
    select left(coalesce(nullif(name, ''), id::text), 120) into v_after_name from projects where id = p_after and estate_id = p_estate;
    if not found then return board_refusal('cursor_reset_required', 'This cursor no longer points into the directory; read again from the start.'); end if;
  end if;
  with listed as (
    select p.id, left(coalesce(nullif(p.name, ''), p.id::text), 120) as name, board_listed_capabilities(p_estate, p.id) as caps
      from projects p
     where p.estate_id = p_estate and p.status = 'active' and p.id <> p_reader
       and not exists (select 1 from board_directory_listings l where l.estate_id = p_estate and l.project_id = p.id and l.unlisted)
  ), filtered as (
    select * from listed where (p_capability is null or p_capability = any (caps))
       and (p_after is null or (name, id::text) > (v_after_name, p_after::text))
     order by name, id::text limit v_limit + 1
  ), page as (select * from filtered order by name, id::text limit v_limit)
  select coalesce(jsonb_agg(jsonb_build_object('id', pg.id, 'name', pg.name, 'capabilities',
           coalesce((select jsonb_agg(jsonb_build_object('capability', c,
                       'responder', coalesce((select board_responder_state(s) from board_responder_slots s
                                               where s.estate_id = p_estate and s.project_id = pg.id and s.capability = c), 'absent')) order by c)
                       from (select c from unnest(pg.caps) c order by c limit 64) cc), '[]'::jsonb)) order by pg.name, pg.id::text), '[]'::jsonb),
         (select count(*) from filtered) > v_limit,
         (select id from page order by name desc, id::text desc limit 1)
    into v_rows, v_more, v_last from page pg;
  return jsonb_build_object('ok', true, 'projects', v_rows, 'more', coalesce(v_more, false), 'last', v_last);
end $$;

-- ── 8 · the projector: responders, attempts, the restore rule ───────────────────────────────────────────────
create function board_restored(e journal) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from estate_restore_boundaries b where b.target_estate_id = e.estate_id and e.seq <= b.watermark_seq)
$$;

-- Migration 86's transition projector, plus attempts, the generation and the restore rule. Replay-safe.
create or replace function apply_comms_requests(e journal) returns void
language plpgsql security definer set search_path = public as $$
declare v_to text := e.payload->>'to'; v_effect text := e.payload->>'effect_to'; v_op text := e.payload->>'op'; v_request uuid;
        v_restored boolean; v_attempt uuid := identity_uuid(e.payload->>'attempt_id'); v_new boolean;
begin
  if e.type <> 'comms.request_transitioned@1' then return; end if;
  v_request := (e.payload->>'request_id')::uuid;
  v_restored := board_restored(e);
  -- History, not authority (ADR-0149 §6): a restored claim is queued again; a restored effect in progress is unknown.
  if v_restored and v_to = 'claimed' then v_to := 'queued'; end if;
  if v_restored and v_to = 'in_progress' then v_to := 'outcome_unknown'; v_effect := 'unknown'; end if;
  if not exists (select 1 from board_requests where estate_id = e.estate_id and message_id = v_request and updated_seq < e.seq) then return; end if;
  v_new := v_op in ('claim', 'replace') and v_attempt is not null;
  -- Every op but accept and effect_begin ends the request's live attempt (a claim or a transfer replaces it).
  if v_op not in ('accept', 'effect_begin') or v_restored then
    update board_attempts set ended_seq = e.seq,
           ended_cause = case when v_restored then 'restore' else case v_op when 'claim' then 'lapsed' when 'replace' then 'replaced' when 'complete' then 'completed'
                              when 'cancel' then 'cancelled' when 'expire' then 'expired' when 'lost_result' then 'lost_result' else 'replaced' end end
     where estate_id = e.estate_id and request_id = v_request and ended_seq is null and claimed_seq < e.seq;
  end if;
  if v_new then
    insert into board_attempts (estate_id, id, request_id, generation, enrollment_id, claimed_seq, ended_seq, ended_cause)
    values (e.estate_id, v_attempt, v_request, (e.payload->>'generation')::bigint, (e.payload->>'enrollment_id')::uuid, e.seq,
            case when v_restored then e.seq end, case when v_restored then 'restore' end)
    on conflict do nothing;
  end if;
  update board_requests set state = v_to, effect = v_effect, revision = (e.payload->>'revision')::bigint, updated_seq = e.seq,
                            generation = coalesce((e.payload->>'generation')::bigint, generation),
                            attempt_id = case when v_restored then null when v_new then v_attempt when v_op in ('accept', 'effect_begin') then attempt_id else null end
   where estate_id = e.estate_id and message_id = v_request and updated_seq < e.seq;
end $$;

create function apply_comms_responders(e journal) returns void
language plpgsql security definer set search_path = public as $$
declare v_restored boolean; v_enrollment uuid; v_old uuid;
begin
  if e.type not in ('comms.responder_enrolled@1', 'comms.responder_released@1') then return; end if;
  v_restored := board_restored(e);
  v_enrollment := (e.payload->>'enrollment_id')::uuid;
  if e.type = 'comms.responder_enrolled@1' then
    if exists (select 1 from board_enrollments where estate_id = e.estate_id and id = v_enrollment) then return; end if;   -- replay
    v_old := identity_uuid(e.payload->>'replaced_enrollment_id');
    if v_old is not null then
      update board_enrollments set released_seq = e.seq, released_cause = 'replaced' where estate_id = e.estate_id and id = v_old and released_seq is null;
      update board_attempts set ended_seq = e.seq, ended_cause = 'replaced' where estate_id = e.estate_id and enrollment_id = v_old and ended_seq is null;
      update board_requests q set attempt_id = null where q.estate_id = e.estate_id and q.attempt_id is not null
         and not exists (select 1 from board_attempts a where a.estate_id = q.estate_id and a.id = q.attempt_id and a.ended_seq is null);
    end if;
    -- A slot left to another holder at restore keeps nobody: the enrollment is history (released, cause restore).
    if v_restored then
      update board_enrollments set released_seq = e.seq, released_cause = 'restore'
       where estate_id = e.estate_id and project_id = (e.payload->>'project_id')::uuid and capability = e.payload->>'capability' and released_seq is null;
    end if;
    insert into board_enrollments (estate_id, id, project_id, capability, generation, session_id, came_in, agent, binding_id, grant_id, principal,
                                   enrolled_seq, released_seq, released_cause)
    values (e.estate_id, v_enrollment, (e.payload->>'project_id')::uuid, e.payload->>'capability', (e.payload->>'generation')::bigint,
            e.payload->>'session_id', e.payload->>'came_in', e.payload->>'agent', identity_uuid(e.payload->>'binding_id'),
            (e.payload->>'grant_id')::uuid, e.payload->'principal', e.seq,
            case when v_restored then e.seq end, case when v_restored then 'restore' end);
    insert into board_responder_slots (estate_id, project_id, capability, generation, holder_enrollment, updated_seq)
    values (e.estate_id, (e.payload->>'project_id')::uuid, e.payload->>'capability', (e.payload->>'generation')::bigint,
            case when v_restored then null else v_enrollment end, e.seq)
    on conflict (estate_id, project_id, capability) do update
       set generation = greatest(board_responder_slots.generation, excluded.generation),
           holder_enrollment = excluded.holder_enrollment, lease_until = null, updated_seq = excluded.updated_seq
     where board_responder_slots.updated_seq < excluded.updated_seq;
  else
    update board_enrollments set released_seq = e.seq, released_cause = e.payload->>'cause' where estate_id = e.estate_id and id = v_enrollment and released_seq is null;
    update board_attempts set ended_seq = e.seq, ended_cause = 'released' where estate_id = e.estate_id and enrollment_id = v_enrollment and ended_seq is null;
    update board_requests q set attempt_id = null where q.estate_id = e.estate_id and q.attempt_id is not null
       and not exists (select 1 from board_attempts a where a.estate_id = q.estate_id and a.id = q.attempt_id and a.ended_seq is null);
    update board_responder_slots set holder_enrollment = null, updated_seq = e.seq
     where estate_id = e.estate_id and holder_enrollment = v_enrollment and updated_seq < e.seq;
  end if;
end $$;

create function apply_comms_listings(e journal) returns void
language plpgsql security definer set search_path = public as $$
begin
  if e.type <> 'comms.directory_listing_set@1' then return; end if;
  insert into board_directory_listings values (e.estate_id, (e.payload->>'project_id')::uuid, not (e.payload->>'listed')::boolean, e.seq)
  on conflict (estate_id, project_id) do update set unlisted = excluded.unlisted, updated_seq = excluded.updated_seq
   where board_directory_listings.updated_seq < excluded.updated_seq;
end $$;

-- Migration 86's epoch projector, plus the restore rule: an epoch the source opened projects closed (its receipts did
-- not travel), so the restored Project's next submit opens a fresh one (C6).
create or replace function apply_comms_epochs(e journal) returns void
language plpgsql security definer set search_path = public as $$
declare v_project uuid; v_closed integer; v_opened integer; x jsonb; v_restored boolean := board_restored(e);
begin
  case e.type
    when 'comms.epoch_rotated@1' then
      v_project := (e.payload->>'project_id')::uuid;
      v_closed := (e.payload->>'closed_epoch')::integer;
      v_opened := (e.payload->>'opened_epoch')::integer;
      insert into board_epochs (estate_id, project_id, epoch, state, opened_at, closed_seq, closed_at)
      values (e.estate_id, v_project, v_closed, 'closed', e.occurred_at, e.seq, e.occurred_at)
      on conflict (estate_id, project_id, epoch) do update set state = 'closed', closed_seq = e.seq, closed_at = e.occurred_at
        where board_epochs.state = 'open';
      insert into board_epochs (estate_id, project_id, epoch, state, opened_seq, opened_at, closed_seq, closed_at)
      values (e.estate_id, v_project, v_opened, case when v_restored then 'closed' else 'open' end, e.seq, e.occurred_at,
              case when v_restored then e.seq end, case when v_restored then e.occurred_at end)
      on conflict do nothing;
    when 'comms.retention_applied@1' then
      for x in select value from jsonb_array_elements(coalesce(e.payload->'retired', '[]'::jsonb)) loop
        insert into board_epochs (estate_id, project_id, epoch, state, opened_at, closed_at, retired_seq)
        values (e.estate_id, (x->>'project_id')::uuid, (x->>'epoch')::integer, 'retired', e.occurred_at, e.occurred_at, e.seq)
        on conflict (estate_id, project_id, epoch) do update set state = 'retired', retired_seq = e.seq
          where board_epochs.state <> 'retired';
      end loop;
    else null;
  end case;
end $$;

-- Migration 86's lazy epoch, plus the restore rule: in a restored estate a Project's first epoch is above every one
-- its source may have used — epoch 1 was opened lazily, with no event, so a restored estate starts at 2 at least.
create or replace function board_current_epoch(p_estate_id uuid, p_sender uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare v integer; v_floor integer := 1;
begin
  select epoch into v from board_epochs where estate_id = p_estate_id and project_id = p_sender and state = 'open';
  if found then return v; end if;
  if exists (select 1 from estate_restore_boundaries b where b.target_estate_id = p_estate_id) then v_floor := 2; end if;
  insert into board_epochs (estate_id, project_id, epoch, state, opened_at)
  values (p_estate_id, p_sender,
          greatest(coalesce((select max(epoch) + 1 from board_epochs where estate_id = p_estate_id and project_id = p_sender), 1), v_floor),
          'open', clock_timestamp())
  on conflict do nothing;
  select epoch into v from board_epochs where estate_id = p_estate_id and project_id = p_sender and state = 'open';
  return v;
end $$;

create or replace function apply_comms(e journal) returns void
language plpgsql security definer set search_path = public as $$
begin
  if e.type not like 'comms.%' then return; end if;
  perform apply_comms_messages(e);
  perform apply_comms_reads(e);
  perform apply_comms_requests(e);
  perform apply_comms_epochs(e);
  perform apply_comms_responders(e);
  perform apply_comms_listings(e);
end $$;

-- `board_idempotency.operation` already takes every responder family (migration 86); renew and progress store none.

-- ── 9 · the doors ───────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function board_lease_seconds(), board_lease_until(), board_holder_valid(jsonb), board_holder_principal(jsonb), board_actor(jsonb),
  board_grant_for(uuid, jsonb, uuid, text), board_grant_live(uuid, uuid), board_slot_lock(uuid, uuid, text), board_is_uuid(text),
  board_slot_json(uuid, uuid, text), board_attempt_json(uuid, uuid), board_request_json(uuid, uuid),
  board_move(uuid, uuid, text, text, text, text, jsonb, jsonb),
  board_insert_fenced_message(uuid, uuid, jsonb, uuid, text, text, jsonb, text, text, jsonb),
  board_fence_shape_refusal(jsonb), board_responder_refusal(uuid, jsonb, uuid, jsonb, text, text[]),
  board_replacement_effects(uuid, uuid, text, bigint, text, jsonb), board_holder_enrollment(uuid, jsonb, uuid, text),
  board_fence(uuid, jsonb, uuid, jsonb, text, text), board_renew_leases(uuid, uuid, text, uuid), board_fence_extra(jsonb),
  board_outcome_refusal(jsonb, boolean), board_outcome_payload(jsonb), board_release(uuid, text, text, text),
  board_listed_capabilities(uuid, uuid), board_responder_state(board_responder_slots), board_restored(journal),
  apply_comms_requests(journal), apply_comms_responders(journal), apply_comms_listings(journal), apply_comms_epochs(journal),
  board_current_epoch(uuid, uuid), apply_comms(journal), board_responders_json(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke execute on function board_enroll(uuid, jsonb, uuid, jsonb, text), board_responder_replace(uuid, jsonb, uuid, jsonb, text),
  board_claim(uuid, jsonb, uuid, jsonb, text), board_accept(uuid, jsonb, uuid, jsonb, text), board_renew(uuid, jsonb, uuid, jsonb, text),
  board_progress(uuid, jsonb, uuid, jsonb, text), board_effect_begin(uuid, jsonb, uuid, jsonb, text), board_complete(uuid, jsonb, uuid, jsonb, text),
  board_reply_fenced(uuid, jsonb, uuid, jsonb, text), board_reconcile(uuid, jsonb, uuid, jsonb, text),
  board_release_session(uuid, text), board_release_grant(uuid, uuid), board_join_check(uuid, uuid, uuid),
  board_responders_operator(uuid), board_set_listing(uuid, uuid, boolean, jsonb), board_directory(uuid, uuid, text, uuid, integer)
  from public, anon, authenticated;
grant execute on function board_enroll(uuid, jsonb, uuid, jsonb, text), board_responder_replace(uuid, jsonb, uuid, jsonb, text),
  board_claim(uuid, jsonb, uuid, jsonb, text), board_accept(uuid, jsonb, uuid, jsonb, text), board_renew(uuid, jsonb, uuid, jsonb, text),
  board_progress(uuid, jsonb, uuid, jsonb, text), board_effect_begin(uuid, jsonb, uuid, jsonb, text), board_complete(uuid, jsonb, uuid, jsonb, text),
  board_reply_fenced(uuid, jsonb, uuid, jsonb, text), board_reconcile(uuid, jsonb, uuid, jsonb, text),
  board_release_session(uuid, text), board_release_grant(uuid, uuid), board_join_check(uuid, uuid, uuid),
  board_responders_operator(uuid), board_set_listing(uuid, uuid, boolean, jsonb), board_directory(uuid, uuid, text, uuid, integer)
  to service_role;

-- #endregion project-board-responders
