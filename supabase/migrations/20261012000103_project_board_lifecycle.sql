-- 86 (by count; suffix 103) — the project board's lifecycle, COM-02.3 of
-- `docs/evidence/plans/2026-10-04-project-communications.md`, decided in ADR-0149 (which amends ADR-0117 §4 and §6).
--
-- NUMBERS. `schema_version()` counts applied migrations, so this file makes the schema 86 whatever its suffix
-- says. Suffixes 101/102 were the task pipeline's prose reservation; it moves to 105/106 in the same change
-- (`docs/evidence/plans/task-pipeline-persistence-contract.md`), and 104 is the responders' migration (COM-03).
-- Three earlier headers are frozen by `supabase/migration-ledger.json` and state stale counts; the true ones are:
-- `…094_project_board_operator_read.sql` is 83 (its header says "80 … suffix 84"), `…095_work_claims.sql` is 84
-- (its header says 83), `…100_project_board_thread_aggregates.sql` is 85 (its header says "84 … suffix 97").
-- A7-024, corrected here because migration 81's bytes are frozen too: `…081:68` cites
-- `scripts/check-estate-references`, which does not exist. The check is `estate-identity-db.test.mjs` and
-- `project-board-db.test.mjs`.
--
-- WHAT THIS CHANGES (ADR-0149 §5–§7):
--   * A7-024: `board_requests` is keyed by (estate_id, message_id) — a request id is unique per estate, so two
--     estates in one database cannot collide on it — with no foreign key to `board_messages`, because a restore
--     replays requests whose messages may be absent. `board_threads_operator` joins it estate-qualified.
--   * A7-018: `board_get` and `board_read_ack` refuse an inactive Project, as `board_list`/`board_submit` do;
--     `board_unread` is dropped for `board_status`, which refuses one too.
--   * C3: no receipt carries the estate seq. The stored receipts are rewritten to the new shape once, here.
--   * A7-019 / C6: idempotency epochs live in `board_epochs` (open → closed → retired, one open per Project),
--     one gate (`board_epoch_gate`) serves every mutation, a full epoch rotates and answers `capacity_exceeded`.
--   * `board_reply` (a participant's reply, `com.reply`), `board_cancel` (the requester's `com.cancel`) and the
--     first `comms.request_transitioned@1` transitions: cancel and deadline expiry.
--   * `board_tick` (the app's 60 s cycle): expiry, rotation, receipt retention and outbox retention, each
--     pass that did something leaving one `comms.retention_applied@1` receipt.
--   * `board_deliveries` (who a message is delivered to, P:90) and a transactional outbox (`board_outbox`,
--     written in the same transaction as every comms.* event; ids only, never bodies) with compare-and-swap
--     consumer cursors. No consumer exists yet: COM-08 and COM-11 will be them. Events appended before this
--     migration have no outbox row; a consumer starts from the journal.
--   * CO-212: `board_history_export` / `restore_board_history` carry threads, messages, bodies and outcomes in
--     an estate archive's `board.json`, each message matched to the restored journal event at its seq.
--   * The private-archive schema list gains 85 (migration 100 did not extend it — A7-045) and 86.
--
-- LOCK ORDER (ADR-0149 §5): a command's own lock — an advisory key lock, or the row it changes, taken
-- `FOR UPDATE` — and only then `append_event`'s estate lock 4242. The tick takes its rows with SKIP LOCKED
-- before it appends, so it never waits on a row while holding the estate. Every board function that waits
-- does so for at most `lock_timeout = '3s'`.
--
-- THE CLOCK (ADR-0149 §5, clarifying ADR-0117 §4): a deadline or an epoch age is compared with
-- `clock_timestamp()` — database time at the check — never `now()`, which is the transaction's start and goes
-- stale behind a lock wait. Projectors use the event's own `occurred_at`.
--
-- OPERATIONAL, NOT PROJECTED: `board_epochs.keys`, the outbox and the cursors are written by commands only,
-- as migration 60 keeps dispatch ownership ("deliberately not reconstructed"). Everything else here is either
-- a primary row written beside its event (`board_outcomes`) or a projection of the journal.

-- #region project-board-lifecycle — docs: docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md#decision

insert into event_types (type, projects, note) values
  ('comms.request_transitioned@1', true, 'a board request moved from one state to another (cancel, deadline expiry; the responder transitions arrive with COM-03); the event carries the request id, the states, the revision and the cause, never a body'),
  ('comms.epoch_rotated@1', true, 'a Project''s idempotency epoch was closed and the next one opened (capacity, age or restore)'),
  ('comms.retention_applied@1', true, 'the board retired closed idempotency epochs and compacted their receipts and old outbox entries; the receipt of one retention pass');

-- ── 1 · A7-024: a request is keyed by its estate ────────────────────────────────────────────────────────────
alter table board_requests drop constraint board_requests_pkey, add primary key (estate_id, message_id);

-- ── 2 · idempotency: every mutation, one namespace per Project and epoch ────────────────────────────────────
alter table board_idempotency drop constraint board_idempotency_operation_check,
  add constraint board_idempotency_operation_check check (operation in
    ('submit', 'reply', 'cancel', 'enroll', 'claim', 'accept', 'effect_begin', 'complete', 'reconcile', 'responder_replace'));

-- C3: the receipts already stored (migration 81's shape, `…081:317-320`: `seq`, and `request` as an id or null) take
-- the new shape once, here — no `seq`, and a request as the object {id, state, effect, revision} read from its
-- current `board_requests` row, or absent for a message that is not a request. The one rewrite these rows ever take,
-- with the guard off for its length. `board_receipt_current` below does the same on replay, should a row of the old
-- shape ever reach the gate.
create function board_receipt_current(p_estate uuid, r jsonb) returns jsonb
language sql stable security definer set search_path = public as $$
  select (r - 'seq' - 'request')
    || case when jsonb_typeof(r->'request') = 'string' then coalesce((
         select jsonb_build_object('request', jsonb_build_object('id', q.message_id, 'state', q.state, 'effect', q.effect, 'revision', q.revision))
           from board_requests q where q.estate_id = p_estate and q.message_id::text = r->>'request'), '{}'::jsonb)
            when jsonb_typeof(r->'request') = 'object' then jsonb_build_object('request', r->'request')
            else '{}'::jsonb end
    || case when jsonb_typeof(r->'at') = 'string' and r->>'at' !~ 'Z$'
            then jsonb_build_object('at', to_char((r->>'at')::timestamptz at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
            else '{}'::jsonb end
$$;
alter table board_idempotency disable trigger board_idempotency_immutable;
update board_idempotency set receipt = board_receipt_current(estate_id, receipt)
 where receipt ? 'seq' or jsonb_typeof(receipt->'request') in ('string', 'null');
alter table board_idempotency enable trigger board_idempotency_immutable;

-- Receipts are immutable, and deletable only by the retention pass: `board_tick` authorizes its own transaction
-- (a transaction-local setting holding this transaction's id), and nothing else can.
create function board_idempotency_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' and current_setting('fabric.board_compaction', true) = txid_current()::text then return old; end if;
  raise exception 'board primary record is immutable' using errcode = 'insufficient_privilege';
end $$;
drop trigger board_idempotency_immutable on board_idempotency;
create trigger board_idempotency_immutable before update or delete on board_idempotency for each row execute function board_idempotency_guard();

-- ── 3 · the new tables ──────────────────────────────────────────────────────────────────────────────────────
-- A Project's idempotency epochs. State is projected from comms.epoch_rotated@1 / comms.retention_applied@1;
-- `keys` is operational (the gate counts what it stores), and epoch 1 is opened lazily on first use.
create table board_epochs (
  estate_id    uuid not null,
  project_id   uuid not null,
  epoch        integer not null check (epoch >= 1),
  state        text not null check (state in ('open', 'closed', 'retired')),
  opened_seq   bigint,
  opened_at    timestamptz not null,
  closed_seq   bigint,
  closed_at    timestamptz,
  retired_seq  bigint,
  keys         integer not null default 0 check (keys >= 0),
  primary key (estate_id, project_id, epoch)
);
create unique index board_epochs_one_open on board_epochs (estate_id, project_id) where state = 'open';
insert into board_epochs (estate_id, project_id, epoch, state, opened_at, keys)
  select estate_id, sender_project, 1, 'open', clock_timestamp(), count(*) from board_idempotency group by estate_id, sender_project;

-- What a request ended with, beside the event that ended it: a cancel's reason here, a responder's outcome
-- summary and evidence with COM-03. Primary, like a body: deleting a row is the redaction path, updating is refused.
create table board_outcomes (
  estate_id   uuid not null,
  request_id  uuid not null,
  attempt_id  uuid,
  summary     text check (summary is null or length(summary) between 1 and 2000),
  evidence    jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array' and jsonb_array_length(evidence) <= 8),
  seq         bigint not null check (seq between 1 and 9007199254740991),
  primary key (estate_id, request_id, seq)
);
create trigger board_outcome_immutable before update on board_outcomes for each row execute function board_primary_immutable();

-- The delivery-eligibility record (P:90): every participant of a message's thread but its sender. A projection
-- of comms.message_submitted@1; `board_status` counts unread from it.
create table board_deliveries (
  estate_id          uuid not null,
  message_id         uuid not null,
  recipient_project  uuid not null,
  seq                bigint not null,
  is_request         boolean not null,
  capability         text,
  primary key (estate_id, message_id, recipient_project)
);
create index board_deliveries_recipient on board_deliveries (estate_id, recipient_project, seq);

-- The transactional outbox: one row per comms.* event, written by `board_append` in the event's transaction.
-- Ids only. Operational: retained 7 days and while any cursor is below it.
create table board_outbox (
  estate_id   uuid not null,
  seq         bigint not null,
  event_type  text not null,
  message_id  uuid,
  request_id  uuid,
  created_at  timestamptz not null default clock_timestamp(),
  primary key (estate_id, seq)
);
create table board_consumer_cursors (
  estate_id  uuid not null,
  consumer   text not null check (consumer ~ '^[a-z][a-z0-9-]{1,62}$'),
  last_seq   bigint not null default 0 check (last_seq >= 0),
  revision   bigint not null check (revision >= 1),
  primary key (estate_id, consumer)
);

alter table board_epochs enable row level security;
alter table board_outcomes enable row level security;
alter table board_deliveries enable row level security;
alter table board_outbox enable row level security;
alter table board_consumer_cursors enable row level security;
revoke all on board_epochs, board_outcomes, board_deliveries, board_outbox, board_consumer_cursors
  from public, anon, authenticated, service_role;

-- ── 4 · helpers ─────────────────────────────────────────────────────────────────────────────────────────────
create function board_at(p timestamptz) returns text language sql immutable set search_path = public as $$
  select to_char(p at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

-- Every comms.* event, and its outbox row in the same transaction (the outbox's whole guarantee).
create or replace function board_append(p_estate_id uuid, p_type text, p_actor jsonb, p_payload jsonb) returns journal
language plpgsql security definer set search_path = public as $$
declare j journal;
begin
  insert into board_write_authorizations values (txid_current(), p_estate_id, p_type, p_payload);
  select * into j from append_event(p_estate_id, p_type, p_actor, p_payload, '1');
  delete from board_write_authorizations where transaction_id = txid_current() and estate_id = p_estate_id;
  insert into board_outbox (estate_id, seq, event_type, message_id, request_id)
  values (p_estate_id, j.seq, p_type, identity_uuid(p_payload->>'message_id'),
          coalesce(identity_uuid(p_payload->>'request_id'),
                   case when jsonb_typeof(p_payload->'request') = 'object' then identity_uuid(p_payload->>'message_id') end));
  return j;
end $$;

-- A7-019: the epoch a Project writes under is its open `board_epochs` row; the first use opens epoch 1.
create or replace function board_current_epoch(p_estate_id uuid, p_sender uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  select epoch into v from board_epochs where estate_id = p_estate_id and project_id = p_sender and state = 'open';
  if found then return v; end if;
  insert into board_epochs (estate_id, project_id, epoch, state, opened_at)
  values (p_estate_id, p_sender,
          coalesce((select max(epoch) + 1 from board_epochs where estate_id = p_estate_id and project_id = p_sender), 1),
          'open', clock_timestamp())
  on conflict do nothing;
  select epoch into v from board_epochs where estate_id = p_estate_id and project_id = p_sender and state = 'open';
  return v;
end $$;

-- Close a Project's epoch and open the next, as an event (the projector moves the rows).
create function board_rotate_epoch(p_estate uuid, p_project uuid, p_closed integer, p_cause text) returns journal
language plpgsql security definer set search_path = public as $$
begin
  return board_append(p_estate, 'comms.epoch_rotated@1', jsonb_build_object('kind', 'system', 'id', 'board'),
    jsonb_build_object('project_id', p_project, 'closed_epoch', p_closed, 'opened_epoch', p_closed + 1, 'cause', p_cause));
end $$;

-- THE idempotency gate of every mutation (ADR-0149 §7). Takes the key's lock and the epoch row, then answers:
-- a refusal, a stored receipt marked repeated, or {fresh: true} — after which the command stores its receipt
-- with `board_store_receipt` in the same transaction.
create function board_epoch_gate(p_estate uuid, p_project uuid, p_operation text, p_epoch integer, p_key text, p_digest text, p_store boolean)
returns jsonb language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare v_current integer; ep board_epochs; existing board_idempotency;
begin
  -- One call per (Project, operation, epoch, key) at a time: a concurrent duplicate waits here and then reads the receipt.
  perform pg_advisory_xact_lock(hashtextextended(p_estate::text || '/' || p_project::text || '/' || p_operation || '/' || p_epoch::text || '/' || p_key, 4243));
  v_current := board_current_epoch(p_estate, p_project);
  if p_epoch > v_current then
    return board_refusal('invalid_arguments', 'This idempotency epoch has not been issued; read the current one with com.status.');
  end if;
  select * into ep from board_epochs where estate_id = p_estate and project_id = p_project and epoch = p_epoch for update;
  if not found or ep.state = 'retired' then
    return board_refusal('idempotency_window_expired', 'This idempotency epoch is retired; read the current one with com.status and send again.');
  end if;
  if not p_store then return jsonb_build_object('fresh', true); end if;
  select * into existing from board_idempotency
   where estate_id = p_estate and sender_project = p_project and operation = p_operation and epoch = p_epoch and key = p_key;
  if found then
    if existing.digest = p_digest then return board_receipt_current(p_estate, existing.receipt) || jsonb_build_object('repeated', true); end if;
    return board_refusal('idempotency_conflict', 'This idempotency key was already used for a different call.');
  end if;
  if ep.state = 'closed' then
    return board_refusal('idempotency_window_expired', 'This epoch is closed; read the current one with com.status.');
  end if;
  if ep.keys >= board_epoch_capacity() then
    -- Capacity is a refusal before any effect, and the rotation it causes is committed with it.
    perform board_rotate_epoch(p_estate, p_project, ep.epoch, 'capacity');
    return board_refusal('capacity_exceeded',
      format('This idempotency epoch is full; the board opened epoch %s. Read it with com.status and send again.', ep.epoch + 1), true);
  end if;
  return jsonb_build_object('fresh', true);
end $$;

create function board_store_receipt(p_estate uuid, p_project uuid, p_operation text, p_epoch integer, p_key text, p_digest text, p_receipt jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into board_idempotency values (p_estate, p_project, p_operation, p_epoch, p_key, p_digest, p_receipt);
  update board_epochs set keys = keys + 1 where estate_id = p_estate and project_id = p_project and epoch = p_epoch;
end $$;

-- The shape checks a message's body and artifacts share (submit and reply). Null when they pass.
create function board_body_refusal(s jsonb) returns jsonb language plpgsql immutable set search_path = public as $$
declare v_body text; v_format text; v_artifacts jsonb;
begin
  if jsonb_typeof(s->'body') is distinct from 'object' or jsonb_typeof(s->'body'->'text') is distinct from 'string'
     or exists (select 1 from jsonb_object_keys(s->'body') k where k not in ('text', 'format')) then
    return board_refusal('invalid_arguments', 'The message has no text body.');
  end if;
  v_body := s->'body'->>'text';
  -- Bytes, not characters: the contract's limit is 65,536 UTF-8 bytes, checked before storage.
  if octet_length(v_body) > 65536 then return board_refusal('body_too_large', 'The message body is larger than 65,536 bytes.'); end if;
  if length(v_body) = 0 then return board_refusal('invalid_arguments', 'The message has no text body.'); end if;
  v_format := coalesce(s->'body'->>'format', 'text/plain');
  if v_format not in ('text/plain', 'text/markdown') then return board_refusal('invalid_arguments', 'The body format is not one the board takes.'); end if;
  v_artifacts := coalesce(s->'artifacts', '[]'::jsonb);
  if jsonb_typeof(v_artifacts) is distinct from 'array' then return board_refusal('invalid_arguments', 'Artifacts must be a list.'); end if;
  if jsonb_array_length(v_artifacts) > 8 then return board_refusal('invalid_arguments', 'A message carries at most 8 artifacts.'); end if;
  return null;
end $$;

create function board_idempotency_refusal(s jsonb) returns jsonb language sql immutable set search_path = public as $$
  select case when jsonb_typeof(s->'idempotency') is distinct from 'object' or jsonb_typeof(s->'idempotency'->'epoch') is distinct from 'number'
                or (s->'idempotency'->>'epoch') !~ '^[0-9]{1,10}$' or (s->'idempotency'->>'epoch')::numeric > 2147483647
                or coalesce(s->'idempotency'->>'key', '') !~ '^[A-Za-z0-9._:-]{8,128}$'
                or exists (select 1 from jsonb_object_keys(s->'idempotency') k where k not in ('epoch', 'key'))
              then board_refusal('invalid_arguments', 'The idempotency key is missing or malformed.') end
$$;

-- One message, its body and (for a new thread) the thread, written beside their event. Shared by submit and
-- reply; every check has passed before it is called.
create function board_insert_message(p_estate uuid, p_sender uuid, p_principal jsonb, p_kind text, p_thread uuid,
  p_new_participants uuid[], p_subject text, p_reply_to uuid, p_target uuid, p_capability text, p_deadline timestamptz,
  p_artifacts jsonb, p_body text, p_format text, p_digest text, p_operation text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_message uuid := gen_random_uuid(); v_thread uuid := coalesce(p_thread, gen_random_uuid()); v_new boolean := p_thread is null; j journal;
begin
  j := board_append(p_estate, 'comms.message_submitted@1',
    jsonb_build_object('kind', case when p_principal->>'kind' = 'agent' then 'agent' else 'person' end, 'id', p_principal->>'id'),
    jsonb_build_object(
      'message_id', v_message, 'thread_id', v_thread, 'kind', p_kind, 'sender_project_id', p_sender,
      'principal', p_principal, 'digest', p_digest, 'reply_to', p_reply_to, 'artifact_count', jsonb_array_length(p_artifacts),
      'thread_new', case when v_new then jsonb_build_object('participants', to_jsonb(p_new_participants), 'subject', p_subject) else null end,
      'request', case when p_kind = 'request' then jsonb_build_object('target_project_id', p_target, 'capability', p_capability, 'deadline', p_deadline) else null end,
      'operation', p_operation));
  if v_new then insert into board_threads values (v_thread, p_estate, p_new_participants, p_subject, p_sender, j.seq); end if;
  insert into board_messages values (v_message, p_estate, v_thread, j.seq, p_sender, p_principal, p_kind, p_digest, p_reply_to, p_artifacts, j.occurred_at);
  insert into board_bodies values (v_message, p_estate, p_body, p_format);
  return jsonb_build_object('message', v_message, 'thread', v_thread, 'at', board_at(j.occurred_at));
end $$;

-- One transition of a request, as an event. The caller holds the request row (FOR UPDATE) and has decided the
-- transition is legal; the projector applies it.
create function board_transition(p_estate uuid, p_request uuid, p_op text, p_to text, p_effect_to text, p_cause text, p_actor jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r board_requests; v_digest text; j journal;
begin
  select * into r from board_requests where estate_id = p_estate and message_id = p_request;
  select m.digest into v_digest from board_messages m where m.estate_id = p_estate and m.id = p_request;
  j := board_append(p_estate, 'comms.request_transitioned@1', p_actor, jsonb_strip_nulls(jsonb_build_object(
    'request_id', p_request, 'project_id', r.target_project, 'capability', r.capability, 'op', p_op,
    'from', r.state, 'to', p_to, 'effect_from', r.effect, 'effect_to', p_effect_to, 'revision', r.revision + 1,
    'cause', p_cause, 'digest', v_digest)));
  return jsonb_build_object('request', jsonb_build_object('id', p_request, 'state', p_to, 'effect', p_effect_to, 'revision', r.revision + 1),
                            'seq', j.seq, 'at', board_at(j.occurred_at));
end $$;

-- COM-03 replaces this with the slots; until then a Project has no responders.
create function board_responders_json(p_estate uuid, p_project uuid) returns jsonb
language sql stable security definer set search_path = public as $$ select '[]'::jsonb $$;

-- Deliveries from the primary rows: the migration's backfill and a history restore (whose journal was replayed
-- before its threads existed).
create function board_backfill_deliveries(p_estate uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into board_deliveries (estate_id, message_id, recipient_project, seq, is_request, capability)
  select m.estate_id, m.id, p, m.seq, m.kind = 'request', r.capability
    from board_messages m
    join board_threads t on t.id = m.thread_id and t.estate_id = m.estate_id
    cross join lateral unnest(t.participants) p
    left join board_requests r on r.estate_id = m.estate_id and r.message_id = m.id
   where (p_estate is null or m.estate_id = p_estate) and p <> m.sender_project
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- ── 5 · the participant commands ────────────────────────────────────────────────────────────────────────────
-- `board_submit`: migration 81's checks, unchanged in order and wording, through the one gate; the receipt
-- carries no seq (C3) and a request is an object.
create or replace function board_submit(p_estate_id uuid, p_sender uuid, p_principal jsonb, p_submit jsonb, p_digest text)
returns jsonb language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare
  s jsonb := p_submit; v_refusal jsonb; v_gate jsonb; v_epoch integer; v_key text; v_kind text;
  v_thread uuid; v_new boolean; v_participants uuid[]; v_subject text; v_reply uuid;
  v_target uuid; v_capability text; v_deadline timestamptz; v_artifacts jsonb; t board_threads; v_written jsonb; v_receipt jsonb; p text;
begin
  if p_estate_id is null or p_sender is null or not board_principal_valid(p_principal)
     or jsonb_typeof(s) is distinct from 'object' or p_digest is null or p_digest !~ '^sha256:[0-9a-f]{64}$' then
    return board_refusal('invalid_arguments', 'The submission is not a valid board message.');
  end if;
  if exists (select 1 from jsonb_object_keys(s) k where k not in ('idempotency', 'thread', 'kind', 'body', 'replyTo', 'request', 'artifacts')) then
    return board_refusal('invalid_arguments', 'The submission carries a field the board does not take.');
  end if;
  if not board_is_project(p_estate_id, p_sender) then
    return board_refusal('not_authorized', 'This Project may not write to the board.');
  end if;
  v_kind := s->>'kind';
  if v_kind is null or v_kind not in ('message', 'request', 'reply', 'finding', 'announcement') then
    return board_refusal('invalid_arguments', 'The message kind is not one the board knows.');
  end if;
  v_refusal := board_body_refusal(s);
  if v_refusal is not null then return v_refusal; end if;
  v_artifacts := coalesce(s->'artifacts', '[]'::jsonb);
  v_refusal := board_idempotency_refusal(s);
  if v_refusal is not null then return v_refusal; end if;
  v_epoch := (s->'idempotency'->>'epoch')::integer;
  v_key := s->'idempotency'->>'key';

  v_gate := board_epoch_gate(p_estate_id, p_sender, 'submit', v_epoch, v_key, p_digest, true);
  if not (v_gate ? 'fresh') then return v_gate; end if;

  -- The thread: an existing one the sender takes part in, or a new one with fixed participants.
  if jsonb_typeof(s->'thread') is distinct from 'object' or (select count(*) from jsonb_object_keys(s->'thread')) <> 1 then
    return board_refusal('invalid_arguments', 'Name an existing thread or a new one, not both.');
  end if;
  v_new := s->'thread' ? 'new';
  if v_new then
    if jsonb_typeof(s->'thread'->'new') is distinct from 'object' or jsonb_typeof(s->'thread'->'new'->'participants') is distinct from 'array'
       or exists (select 1 from jsonb_object_keys(s->'thread'->'new') k where k not in ('participants', 'subject')) then
      return board_refusal('invalid_arguments', 'A new thread names its participant Projects.');
    end if;
    foreach p in array array(select jsonb_array_elements_text(s->'thread'->'new'->'participants')) loop
      if p !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or not board_is_project(p_estate_id, p::uuid) then
        return board_refusal('not_authorized', 'A participant is not a Project this board can address.');
      end if;
    end loop;
    select array_agg(distinct x) into v_participants
      from (select jsonb_array_elements_text(s->'thread'->'new'->'participants')::uuid x union select p_sender) q;
    if cardinality(v_participants) > 16 then return board_refusal('invalid_arguments', 'A new thread has at most 16 participant Projects.'); end if;
    v_subject := s->'thread'->'new'->>'subject';
    if v_subject is not null and length(v_subject) not between 1 and 200 then return board_refusal('invalid_arguments', 'A thread subject is 1 to 200 characters.'); end if;
  else
    if coalesce(s->'thread'->>'id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return board_refusal('not_authorized', 'This Project does not take part in that thread.');
    end if;
    select * into t from board_threads where id = (s->'thread'->>'id')::uuid and estate_id = p_estate_id;
    if not found or not (p_sender = any (t.participants)) then
      return board_refusal('not_authorized', 'This Project does not take part in that thread.');
    end if;
    v_thread := t.id; v_participants := t.participants;
  end if;

  if v_kind = 'request' then
    if jsonb_typeof(s->'request') is distinct from 'object'
       or exists (select 1 from jsonb_object_keys(s->'request') k where k not in ('target', 'capability', 'deadline'))
       or coalesce(s->'request'->>'target', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(s->'request'->>'capability', '') !~ '^[a-z][a-z0-9._-]{1,127}$' then
      return board_refusal('invalid_arguments', 'A request names its target Project and capability.');
    end if;
    v_target := (s->'request'->>'target')::uuid;
    if not (v_target = any (v_participants)) then
      return board_refusal('invalid_arguments', 'A request''s target must take part in the thread.');
    end if;
    v_capability := s->'request'->>'capability';
    if s->'request' ? 'deadline' then
      begin v_deadline := (s->'request'->>'deadline')::timestamptz;
      exception when others then return board_refusal('invalid_arguments', 'The request deadline is not a date and time.'); end;
    end if;
  elsif s ? 'request' then
    return board_refusal('invalid_arguments', 'Only a request carries request details.');
  end if;
  if v_kind = 'reply' and not (s ? 'replyTo') then
    return board_refusal('invalid_arguments', 'A reply names the message it answers.');
  end if;
  if s ? 'replyTo' then
    if coalesce(s->>'replyTo', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or v_new
       or not exists (select 1 from board_messages m where m.id = (s->>'replyTo')::uuid and m.estate_id = p_estate_id and m.thread_id = v_thread) then
      return board_refusal('invalid_arguments', 'A reply names a message of the same thread.');
    end if;
    v_reply := (s->>'replyTo')::uuid;
  end if;

  v_written := board_insert_message(p_estate_id, p_sender, p_principal, v_kind, case when v_new then null else v_thread end,
    case when v_new then v_participants end, v_subject, v_reply, v_target, v_capability, v_deadline, v_artifacts,
    s->'body'->>'text', coalesce(s->'body'->>'format', 'text/plain'), p_digest, 'com.submit');
  v_receipt := jsonb_build_object('ok', true, 'repeated', false, 'message', v_written->'message', 'thread', v_written->'thread', 'at', v_written->'at')
    || case when v_kind = 'request' then jsonb_build_object('request',
         jsonb_build_object('id', v_written->'message', 'state', 'queued', 'effect', 'not_started', 'revision', 1)) else '{}'::jsonb end;
  perform board_store_receipt(p_estate_id, p_sender, 'submit', v_epoch, v_key, p_digest, v_receipt);
  return v_receipt;
end $$;

-- `com.reply`, a participant's form: a reply to a message of a thread the sender takes part in. An absent and a
-- foreign message answer alike. A reply is not a completion: no request changes state.
create function board_reply(p_estate_id uuid, p_sender uuid, p_principal jsonb, p_reply jsonb, p_digest text)
returns jsonb language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare s jsonb := p_reply; v_refusal jsonb; v_gate jsonb; m board_messages; v_written jsonb; v_receipt jsonb; v_epoch integer; v_key text;
begin
  if p_estate_id is null or p_sender is null or not board_principal_valid(p_principal)
     or jsonb_typeof(s) is distinct from 'object' or p_digest is null or p_digest !~ '^sha256:[0-9a-f]{64}$' then
    return board_refusal('invalid_arguments', 'The reply is not a valid board message.');
  end if;
  if exists (select 1 from jsonb_object_keys(s) k where k not in ('idempotency', 'replyTo', 'body', 'artifacts')) then
    return board_refusal('invalid_arguments', 'The reply carries a field the board does not take.');
  end if;
  if not board_is_project(p_estate_id, p_sender) then
    return board_refusal('not_authorized', 'This Project may not write to the board.');
  end if;
  v_refusal := coalesce(board_body_refusal(s), board_idempotency_refusal(s));
  if v_refusal is not null then return v_refusal; end if;
  if coalesce(s->>'replyTo', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return board_refusal('not_authorized', 'This Project cannot reply to that message.');
  end if;
  select bm.* into m from board_messages bm join board_threads t on t.id = bm.thread_id and t.estate_id = bm.estate_id
   where bm.id = (s->>'replyTo')::uuid and bm.estate_id = p_estate_id and p_sender = any (t.participants);
  if not found then return board_refusal('not_authorized', 'This Project cannot reply to that message.'); end if;
  v_epoch := (s->'idempotency'->>'epoch')::integer;
  v_key := s->'idempotency'->>'key';
  v_gate := board_epoch_gate(p_estate_id, p_sender, 'reply', v_epoch, v_key, p_digest, true);
  if not (v_gate ? 'fresh') then return v_gate; end if;
  v_written := board_insert_message(p_estate_id, p_sender, p_principal, 'reply', m.thread_id, null, null, m.id, null, null, null,
    coalesce(s->'artifacts', '[]'::jsonb), s->'body'->>'text', coalesce(s->'body'->>'format', 'text/plain'), p_digest, 'com.reply');
  v_receipt := jsonb_build_object('ok', true, 'repeated', false, 'message', v_written->'message', 'thread', v_written->'thread', 'at', v_written->'at');
  perform board_store_receipt(p_estate_id, p_sender, 'reply', v_epoch, v_key, p_digest, v_receipt);
  return v_receipt;
end $$;

-- `com.cancel`: only the Project that sent the request. queued/claimed/accepted → cancelled; in_progress →
-- outcome_unknown (an effect that began is settled only by an observed result); outcome_unknown answers
-- reconcile_required; a terminal request answers invalid_transition. A reason is kept beside the event in
-- `board_outcomes` (redactable), never in the journal.
create function board_cancel(p_estate_id uuid, p_caller uuid, p_principal jsonb, p_cancel jsonb, p_digest text)
returns jsonb language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare s jsonb := p_cancel; v_refusal jsonb; v_gate jsonb; r board_requests; v_sender uuid; v_to text; v_effect text; v_done jsonb;
        v_receipt jsonb; v_epoch integer; v_key text; v_reason text;
begin
  if p_estate_id is null or p_caller is null or not board_principal_valid(p_principal)
     or jsonb_typeof(s) is distinct from 'object' or p_digest is null or p_digest !~ '^sha256:[0-9a-f]{64}$' then
    return board_refusal('invalid_arguments', 'The cancellation is not valid.');
  end if;
  if exists (select 1 from jsonb_object_keys(s) k where k not in ('idempotency', 'request', 'expectedRevision', 'reason')) then
    return board_refusal('invalid_arguments', 'The cancellation carries a field the board does not take.');
  end if;
  v_refusal := board_idempotency_refusal(s);
  if v_refusal is not null then return v_refusal; end if;
  if s ? 'expectedRevision' and (jsonb_typeof(s->'expectedRevision') is distinct from 'number' or (s->>'expectedRevision') !~ '^[1-9][0-9]{0,15}$') then
    return board_refusal('invalid_arguments', 'The expected revision is a whole number from 1.');
  end if;
  if s ? 'reason' then
    if jsonb_typeof(s->'reason') is distinct from 'string' or length(s->>'reason') not between 1 and 300 then
      return board_refusal('invalid_arguments', 'A reason is 1 to 300 characters.');
    end if;
    v_reason := s->>'reason';
  end if;
  if not board_is_project(p_estate_id, p_caller) then
    return board_refusal('not_authorized', 'This Project may not write to the board.');
  end if;
  if coalesce(s->>'request', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return board_refusal('not_authorized', 'This Project cannot cancel that request.');
  end if;
  -- The command's own lock first: the request row. Then the key, then (inside the append) the estate.
  select * into r from board_requests where estate_id = p_estate_id and message_id = (s->>'request')::uuid for update;
  select m.sender_project into v_sender from board_messages m where m.estate_id = p_estate_id and m.id = (s->>'request')::uuid;
  -- Absent, foreign and not-the-requester answer alike.
  if r.message_id is null or v_sender is distinct from p_caller then
    return board_refusal('not_authorized', 'This Project cannot cancel that request.');
  end if;
  v_epoch := (s->'idempotency'->>'epoch')::integer;
  v_key := s->'idempotency'->>'key';
  v_gate := board_epoch_gate(p_estate_id, p_caller, 'cancel', v_epoch, v_key, p_digest, true);
  if not (v_gate ? 'fresh') then return v_gate; end if;
  if s ? 'expectedRevision' and (s->>'expectedRevision')::bigint <> r.revision then
    return board_refusal('revision_conflict', format('The request is at revision %s, not %s; read it and decide again.', r.revision, s->>'expectedRevision'));
  end if;
  if r.state = 'outcome_unknown' then
    return board_refusal('reconcile_required', 'This request may have happened; only com.reconcile with an observed result settles it.');
  elsif r.state in ('completed', 'failed_known', 'cancelled', 'expired') then
    return board_refusal('invalid_transition', format('This request is already %s.', replace(r.state, '_', ' ')));
  elsif r.state = 'in_progress' then
    v_to := 'outcome_unknown'; v_effect := 'unknown';
  else
    v_to := 'cancelled'; v_effect := r.effect;
  end if;
  v_done := board_transition(p_estate_id, r.message_id, 'cancel', v_to, v_effect, 'requester',
    jsonb_build_object('kind', case when p_principal->>'kind' = 'agent' then 'agent' else 'person' end, 'id', p_principal->>'id'));
  if v_reason is not null then
    insert into board_outcomes (estate_id, request_id, attempt_id, summary, seq) values (p_estate_id, r.message_id, null, v_reason, (v_done->>'seq')::bigint);
  end if;
  v_receipt := jsonb_build_object('ok', true, 'repeated', false, 'request', v_done->'request', 'at', v_done->'at');
  perform board_store_receipt(p_estate_id, p_caller, 'cancel', v_epoch, v_key, p_digest, v_receipt);
  return v_receipt;
end $$;

-- One message as `comms-message.schema.json` reads it; its request and body looked up estate-qualified (A7-024).
create or replace function board_message_json(m board_messages) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', m.id, 'thread', m.thread_id, 'kind', m.kind,
    'sender', jsonb_build_object('project', m.sender_project, 'principal', m.principal),
    'at', to_char(m.at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'digest', m.digest,
    'body', (select jsonb_strip_nulls(jsonb_build_object('text', b.text, 'format', b.format)) from board_bodies b where b.message_id = m.id and b.estate_id = m.estate_id),
    'redacted', case when not exists (select 1 from board_bodies b where b.message_id = m.id and b.estate_id = m.estate_id) then true end,
    'replyTo', m.reply_to,
    'request', (select jsonb_strip_nulls(jsonb_build_object('id', r.message_id, 'target', r.target_project, 'capability', r.capability,
                  'state', r.state, 'effect', r.effect,
                  'deadline', to_char(r.deadline at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'revision', r.revision))
                from board_requests r where r.message_id = m.id and r.estate_id = m.estate_id),
    'artifacts', case when jsonb_array_length(m.artifacts) > 0 then m.artifacts end))
$$;

-- A7-018: an archived Project reads nothing and marks nothing.
create or replace function board_get(p_estate_id uuid, p_reader uuid, p_message uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m board_messages;
begin
  if not board_is_project(p_estate_id, p_reader) then return board_refusal('not_authorized', 'This Project may not read the board.'); end if;
  select bm.* into m from board_messages bm join board_threads t on t.id = bm.thread_id and t.estate_id = bm.estate_id
   where bm.id = p_message and bm.estate_id = p_estate_id and p_reader = any (t.participants);
  if not found then return board_refusal('not_authorized', 'This Project cannot read that message.'); end if;
  return jsonb_build_object('ok', true, 'message', board_message_json(m));
end $$;

create or replace function board_read_ack(p_estate_id uuid, p_reader uuid, p_principal jsonb, p_message uuid) returns jsonb
language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare m board_messages; prior board_read_marks;
begin
  if not board_principal_valid(p_principal) then return board_refusal('invalid_arguments', 'The principal is not valid.'); end if;
  if not board_is_project(p_estate_id, p_reader) then return board_refusal('not_authorized', 'This Project may not read the board.'); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text || '/ack/' || p_reader::text || '/' || coalesce(p_message::text, ''), 4244));
  select bm.* into m from board_messages bm join board_threads t on t.id = bm.thread_id and t.estate_id = bm.estate_id
   where bm.id = p_message and bm.estate_id = p_estate_id and p_reader = any (t.participants);
  if not found then return board_refusal('not_authorized', 'This Project cannot read that message.'); end if;
  select * into prior from board_read_marks where estate_id = p_estate_id and reader_project = p_reader and message_id = p_message;
  if found then return jsonb_build_object('ok', true, 'repeated', true, 'message', p_message); end if;
  perform board_append(p_estate_id, 'comms.read_acked@1',
    jsonb_build_object('kind', case when p_principal->>'kind' = 'agent' then 'agent' else 'person' end, 'id', p_principal->>'id'),
    jsonb_build_object('reader_project_id', p_reader, 'message_id', p_message, 'principal', p_principal));
  return jsonb_build_object('ok', true, 'repeated', false, 'message', p_message);
end $$;

drop function board_unread(uuid, uuid);

-- `com.status`'s facts for one Project: unread from the deliveries, the epoch it submits under, its responders.
create function board_status(p_estate_id uuid, p_reader uuid) returns jsonb
language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
begin
  if p_estate_id is null or p_reader is null then return board_refusal('invalid_arguments', 'The status request is not valid.'); end if;
  if not board_is_project(p_estate_id, p_reader) then return board_refusal('not_authorized', 'This Project may not read the board.'); end if;
  return jsonb_build_object('ok', true,
    'unread', (select count(*)::integer from board_deliveries d where d.estate_id = p_estate_id and d.recipient_project = p_reader
                 and not exists (select 1 from board_read_marks r where r.estate_id = d.estate_id and r.reader_project = p_reader and r.message_id = d.message_id)),
    'epoch', board_current_epoch(p_estate_id, p_reader),
    'responders', board_responders_json(p_estate_id, p_reader));
end $$;

-- The operator's thread list (migration 100's body), its request join estate-qualified (A7-024; `…100:46`).
create or replace function board_threads_operator(p_estate_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_rows jsonb;
begin
  if p_estate_id is null then
    return board_refusal('invalid_arguments', 'The thread request is not valid.');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id,
           'subject', t.subject,
           'participants', t.participants,
           'createdBy', t.created_by,
           'createdSeq', t.created_seq,
           'messageCount', s.count,
           'lastSeq', coalesce(s.last_seq, 0),
           'lastAt', case when s.last_at is not null then to_char(s.last_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
           'kinds', coalesce(to_jsonb(s.kinds), '[]'::jsonb),
           'openRequests', r.open_requests
         ) order by t.created_seq), '[]'::jsonb)
    into v_rows
    from board_threads t
    left join lateral (
      select count(*)::integer as count, max(m.seq) as last_seq, max(m.at) as last_at,
             coalesce(array_agg(distinct m.kind order by m.kind), '{}'::text[]) as kinds
        from board_messages m
       where m.estate_id = t.estate_id and m.thread_id = t.id
    ) s on true
    left join lateral (
      select count(*)::integer as open_requests
        from board_requests br
        join board_messages m on m.id = br.message_id and m.estate_id = br.estate_id
       where m.estate_id = t.estate_id and m.thread_id = t.id
         and br.state not in ('completed', 'failed_known', 'cancelled', 'expired')
    ) r on true
   where t.estate_id = p_estate_id;
  return jsonb_build_object('ok', true, 'threads', v_rows);
end $$;

-- ── 6 · the tick: expiry, rotation, retention ───────────────────────────────────────────────────────────────
create function board_epoch_rotation_share() returns numeric language sql immutable set search_path = public as $$ select 0.9 $$;
create function board_epoch_max_age() returns interval language sql immutable set search_path = public as $$ select interval '30 days' $$;
create function board_receipt_retention() returns interval language sql immutable set search_path = public as $$ select interval '30 days' $$;
create function board_outbox_retention() returns interval language sql immutable set search_path = public as $$ select interval '7 days' $$;

-- One pass for one estate, from the app's 60 s cycle. Rows are taken with SKIP LOCKED before anything is
-- appended, so a pass never waits on a command and a command never waits on a pass for longer than one append.
create function board_tick(p_estate_id uuid) returns jsonb
language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare r board_requests; ep board_epochs; v_expired integer := 0; v_rotated integer := 0; v_receipts integer := 0; v_outbox integer := 0;
        v_retired jsonb := '[]'::jsonb; v_cutoff timestamptz := clock_timestamp() - board_receipt_retention(); n integer;
        v_system jsonb := jsonb_build_object('kind', 'system', 'id', 'board');
begin
  if p_estate_id is null then return board_refusal('invalid_arguments', 'The tick names no estate.'); end if;
  -- (a) A deadline passed: queued and claimed requests expire. An accepted one is held (C4) — its responder
  --     said it would act, and only an outcome or a cancel ends it.
  for r in select * from board_requests where estate_id = p_estate_id and state in ('queued', 'claimed')
             and deadline is not null and deadline < clock_timestamp() order by submitted_seq for update skip locked loop
    perform board_transition(p_estate_id, r.message_id, 'expire', 'expired', r.effect, 'deadline', v_system);
    v_expired := v_expired + 1;
  end loop;
  -- (b) An open epoch at 90 % of its capacity, or open for 30 days, rotates.
  for ep in select * from board_epochs where estate_id = p_estate_id and state = 'open'
              and (keys >= ceil(board_epoch_capacity() * board_epoch_rotation_share()) or opened_at < clock_timestamp() - board_epoch_max_age())
              for update skip locked loop
    perform board_rotate_epoch(p_estate_id, ep.project_id, ep.epoch,
      case when ep.keys >= ceil(board_epoch_capacity() * board_epoch_rotation_share()) then 'capacity' else 'age' end);
    v_rotated := v_rotated + 1;
  end loop;
  -- (c) A closed epoch 30 days after it closed: its receipts are compacted and it is retired for ever.
  perform set_config('fabric.board_compaction', txid_current()::text, true);
  for ep in select * from board_epochs where estate_id = p_estate_id and state = 'closed' and closed_at < v_cutoff
              order by project_id, epoch for update skip locked loop
    delete from board_idempotency where estate_id = p_estate_id and sender_project = ep.project_id and epoch = ep.epoch;
    get diagnostics n = row_count;
    v_receipts := v_receipts + n;
    v_retired := v_retired || jsonb_build_array(jsonb_build_object('project_id', ep.project_id, 'epoch', ep.epoch));
  end loop;
  perform set_config('fabric.board_compaction', '', true);
  -- (d) Outbox entries older than 7 days that every consumer cursor has passed. With no consumer, none waits.
  delete from board_outbox o where o.estate_id = p_estate_id and o.created_at < clock_timestamp() - board_outbox_retention()
     and not exists (select 1 from board_consumer_cursors c where c.estate_id = p_estate_id and c.last_seq < o.seq);
  get diagnostics v_outbox = row_count;
  -- Bodies are never deleted by age. One receipt per pass that did something; an idle pass writes nothing.
  if jsonb_array_length(v_retired) > 0 or v_outbox > 0 then
    perform board_append(p_estate_id, 'comms.retention_applied@1', v_system, jsonb_build_object(
      'policy', jsonb_build_object('receipt_days', 30, 'outbox_days', 7, 'bodies', 'kept-until-redacted'),
      'retired', v_retired, 'receipts_compacted', v_receipts, 'outbox_compacted', v_outbox, 'cutoff_at', board_at(v_cutoff)));
  end if;
  return jsonb_build_object('ok', true, 'expired', v_expired, 'rotated', v_rotated, 'retired', jsonb_array_length(v_retired),
    'receipts_compacted', v_receipts, 'outbox_compacted', v_outbox);
end $$;

-- ── 7 · the outbox, read and advanced by its consumers (COM-08, COM-11) ─────────────────────────────────────
create function board_outbox_read(p_estate_id uuid, p_consumer text, p_after_seq bigint, p_limit integer) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500); v_rows jsonb; v_last bigint; v_more boolean; c board_consumer_cursors;
begin
  if p_estate_id is null or coalesce(p_consumer, '') !~ '^[a-z][a-z0-9-]{1,62}$' or p_after_seq is null or p_after_seq < 0 then
    return board_refusal('invalid_arguments', 'The outbox request is not valid.');
  end if;
  select * into c from board_consumer_cursors where estate_id = p_estate_id and consumer = p_consumer;
  with page as (select * from board_outbox where estate_id = p_estate_id and seq > p_after_seq order by seq limit v_limit + 1),
       kept as (select * from page order by seq limit v_limit)
  select coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('seq', k.seq, 'type', k.event_type, 'message', k.message_id,
                    'request', k.request_id, 'at', board_at(k.created_at))) order by k.seq) from kept k), '[]'::jsonb),
         (select max(seq) from kept), (select count(*) from page) > v_limit
    into v_rows, v_last, v_more;
  return jsonb_build_object('ok', true, 'entries', v_rows, 'last_seq', coalesce(v_last, p_after_seq), 'more', coalesce(v_more, false),
    'cursor', jsonb_build_object('last_seq', coalesce(c.last_seq, 0), 'revision', coalesce(c.revision, 0)));
end $$;

-- Compare-and-swap: a consumer advances only from the revision it read, and never backwards.
create function board_outbox_advance(p_estate_id uuid, p_consumer text, p_expected_revision bigint, p_to_seq bigint) returns jsonb
language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare c board_consumer_cursors; n integer;
begin
  if p_estate_id is null or coalesce(p_consumer, '') !~ '^[a-z][a-z0-9-]{1,62}$' or p_expected_revision is null or p_expected_revision < 0
     or p_to_seq is null or p_to_seq < 0 then
    return board_refusal('invalid_arguments', 'The cursor move is not valid.');
  end if;
  select * into c from board_consumer_cursors where estate_id = p_estate_id and consumer = p_consumer for update;
  if not found then
    if p_expected_revision <> 0 then return board_refusal('revision_conflict', 'This consumer has no cursor yet; advance from revision 0.'); end if;
    insert into board_consumer_cursors values (p_estate_id, p_consumer, p_to_seq, 1) on conflict do nothing;
    get diagnostics n = row_count;
    if n = 0 then return board_refusal('revision_conflict', 'Another call moved this cursor first; read it again.'); end if;
    return jsonb_build_object('ok', true, 'consumer', p_consumer, 'last_seq', p_to_seq, 'revision', 1);
  end if;
  if c.revision <> p_expected_revision then
    return board_refusal('revision_conflict', format('The cursor is at revision %s, not %s; read it again.', c.revision, p_expected_revision));
  end if;
  if p_to_seq < c.last_seq then return board_refusal('invalid_arguments', 'A cursor never moves backwards.'); end if;
  update board_consumer_cursors set last_seq = p_to_seq, revision = revision + 1 where estate_id = p_estate_id and consumer = p_consumer;
  return jsonb_build_object('ok', true, 'consumer', p_consumer, 'last_seq', p_to_seq, 'revision', c.revision + 1);
end $$;

-- ── 8 · board history in the estate archive (CO-212) ────────────────────────────────────────────────────────
-- What `board.json` carries: every thread, message, body and outcome at or below the archive's watermark. A
-- redacted body is absent at export; a redaction after the export cannot reach the file (the inventory says so).
create function board_history_export(p_estate_id uuid, p_watermark bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if p_estate_id is null or p_watermark is null or p_watermark < 0 then
    return board_refusal('invalid_arguments', 'The export request is not valid.');
  end if;
  return jsonb_build_object('schema', 'FabricBoardHistory@1', 'source_estate_id', p_estate_id, 'watermark_seq', p_watermark,
    'threads', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'participants', to_jsonb(t.participants), 'subject', t.subject,
                  'created_by', t.created_by, 'created_seq', t.created_seq) order by t.created_seq)
                from board_threads t where t.estate_id = p_estate_id and t.created_seq <= p_watermark), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'thread', m.thread_id, 'seq', m.seq, 'sender_project', m.sender_project,
                  'principal', m.principal, 'kind', m.kind, 'digest', m.digest, 'reply_to', m.reply_to, 'artifacts', m.artifacts, 'at', board_at(m.at))
                  || coalesce((select jsonb_build_object('body', jsonb_build_object('text', b.text, 'format', b.format))
                                 from board_bodies b where b.message_id = m.id and b.estate_id = m.estate_id), jsonb_build_object('redacted', true))
                  order by m.seq)
                from board_messages m where m.estate_id = p_estate_id and m.seq <= p_watermark), '[]'::jsonb),
    'outcomes', coalesce((select jsonb_agg(jsonb_build_object('request', o.request_id, 'attempt', o.attempt_id, 'summary', o.summary,
                  'evidence', o.evidence, 'seq', o.seq) order by o.seq, o.request_id)
                from board_outcomes o where o.estate_id = p_estate_id and o.seq <= p_watermark), '[]'::jsonb));
end $$;

-- Restore the history into an estate a restore created. Every archived row must be the journal's: a message
-- matches the comms.message_submitted@1 at its seq field for field, a thread its first message's `thread_new`,
-- an outcome the transition at its seq. A message the journal names and the archive lacks is counted as
-- missing, never invented. Everything is checked before the first insert, and nothing is appended to the journal.
create function restore_board_history(p_target uuid, p_history jsonb) returns jsonb
language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare h jsonb := p_history; b estate_restore_boundaries; x jsonb; e journal; v_threads integer; v_messages integer; v_bodies integer;
        v_redacted integer; v_missing integer; v_outcomes integer;
  refuse constant text := 'The board history does not match this estate''s journal; nothing was restored.';
begin
  select * into b from estate_restore_boundaries where target_estate_id = p_target;
  if not found then
    return jsonb_build_object('ok', false, 'reason_code', 'not_restored', 'says', 'Board history goes only into an estate a restore created.');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_target::text, 4242));
  if exists (select 1 from board_messages where estate_id = p_target) or exists (select 1 from board_threads where estate_id = p_target) then
    return jsonb_build_object('ok', false, 'reason_code', 'already_restored', 'says', 'This estate already holds board messages; its history is not restored twice.');
  end if;
  if jsonb_typeof(h) is distinct from 'object' or h->>'schema' is distinct from 'FabricBoardHistory@1'
     or jsonb_typeof(h->'threads') is distinct from 'array' or jsonb_typeof(h->'messages') is distinct from 'array'
     or jsonb_typeof(h->'outcomes') is distinct from 'array'
     or (h ? 'source_estate_id' and h->>'source_estate_id' is distinct from b.source_estate_id::text) then
    return jsonb_build_object('ok', false, 'reason_code', 'invalid_history', 'says', 'The board history is not a FabricBoardHistory@1 of this archive''s estate.');
  end if;
  -- Ids are global keys: an estate restored beside its source would collide on them.
  if exists (select 1 from jsonb_array_elements(h->'messages') x2 join board_messages m on m.id::text = x2->>'id')
     or exists (select 1 from jsonb_array_elements(h->'threads') x2 join board_threads t on t.id::text = x2->>'id') then
    return jsonb_build_object('ok', false, 'reason_code', 'collides', 'says', 'This database already holds these board messages in another estate; restore into a database that does not.');
  end if;
  for x in select value from jsonb_array_elements(h->'threads') loop
    if coalesce(x->>'id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or jsonb_typeof(x->'participants') is distinct from 'array'
       or jsonb_typeof(x->'created_seq') is distinct from 'number' then
      return jsonb_build_object('ok', false, 'reason_code', 'invalid_history', 'says', refuse);
    end if;
    select * into e from journal where estate_id = p_target and seq = (x->>'created_seq')::bigint;
    if not found or e.type <> 'comms.message_submitted@1' or e.payload->>'thread_id' is distinct from x->>'id'
       or e.payload->'thread_new'->'participants' is distinct from x->'participants'
       or coalesce(e.payload->'thread_new'->'subject', 'null'::jsonb) is distinct from coalesce(x->'subject', 'null'::jsonb)
       or e.payload->>'sender_project_id' is distinct from x->>'created_by' then
      return jsonb_build_object('ok', false, 'reason_code', 'integrity_mismatch', 'says', refuse);
    end if;
  end loop;
  for x in select value from jsonb_array_elements(h->'messages') loop
    if coalesce(x->>'id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or jsonb_typeof(x->'seq') is distinct from 'number'
       or jsonb_typeof(x->'artifacts') is distinct from 'array' or jsonb_array_length(x->'artifacts') > 8
       or not exists (select 1 from jsonb_array_elements(h->'threads') t2 where t2->>'id' = x->>'thread')
       or (x ? 'body' and (jsonb_typeof(x->'body'->'text') is distinct from 'string' or octet_length(x->'body'->>'text') not between 1 and 65536
                           or coalesce(x->'body'->>'format', 'text/plain') not in ('text/plain', 'text/markdown'))) then
      return jsonb_build_object('ok', false, 'reason_code', 'invalid_history', 'says', refuse);
    end if;
    select * into e from journal where estate_id = p_target and seq = (x->>'seq')::bigint;
    if not found or e.type <> 'comms.message_submitted@1' or e.payload->>'message_id' is distinct from x->>'id'
       or e.payload->>'thread_id' is distinct from x->>'thread' or e.payload->>'kind' is distinct from x->>'kind'
       or e.payload->>'sender_project_id' is distinct from x->>'sender_project' or e.payload->'principal' is distinct from x->'principal'
       or e.payload->>'digest' is distinct from x->>'digest'
       or coalesce(e.payload->'reply_to', 'null'::jsonb) is distinct from coalesce(x->'reply_to', 'null'::jsonb)
       or (e.payload->>'artifact_count')::integer is distinct from jsonb_array_length(x->'artifacts') then
      return jsonb_build_object('ok', false, 'reason_code', 'integrity_mismatch', 'says', refuse);
    end if;
  end loop;
  for x in select value from jsonb_array_elements(h->'outcomes') loop
    select * into e from journal where estate_id = p_target and seq = (x->>'seq')::bigint;
    if not found or e.type <> 'comms.request_transitioned@1' or e.payload->>'request_id' is distinct from x->>'request'
       or (x->'summary' <> 'null'::jsonb and (jsonb_typeof(x->'summary') <> 'string' or length(x->>'summary') not between 1 and 2000))
       or jsonb_typeof(coalesce(x->'evidence', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(x->'evidence', '[]'::jsonb)) > 8 then
      return jsonb_build_object('ok', false, 'reason_code', 'integrity_mismatch', 'says', refuse);
    end if;
  end loop;

  insert into board_threads (id, estate_id, participants, subject, created_by, created_seq)
  select (x2->>'id')::uuid, p_target, array(select jsonb_array_elements_text(x2->'participants')::uuid), x2->>'subject',
         (x2->>'created_by')::uuid, (x2->>'created_seq')::bigint
    from jsonb_array_elements(h->'threads') x2;
  get diagnostics v_threads = row_count;
  insert into board_messages (id, estate_id, thread_id, seq, sender_project, principal, kind, digest, reply_to, artifacts, at)
  select (x2->>'id')::uuid, p_target, (x2->>'thread')::uuid, j.seq, (x2->>'sender_project')::uuid, x2->'principal', x2->>'kind',
         x2->>'digest', (x2->>'reply_to')::uuid, x2->'artifacts', j.occurred_at
    from jsonb_array_elements(h->'messages') x2 join journal j on j.estate_id = p_target and j.seq = (x2->>'seq')::bigint
   order by j.seq;
  get diagnostics v_messages = row_count;
  insert into board_bodies (message_id, estate_id, text, format)
  select (x2->>'id')::uuid, p_target, x2->'body'->>'text', coalesce(x2->'body'->>'format', 'text/plain')
    from jsonb_array_elements(h->'messages') x2 where x2 ? 'body';
  get diagnostics v_bodies = row_count;
  insert into board_outcomes (estate_id, request_id, attempt_id, summary, evidence, seq)
  select p_target, (x2->>'request')::uuid, (x2->>'attempt')::uuid, x2->>'summary', coalesce(x2->'evidence', '[]'::jsonb), (x2->>'seq')::bigint
    from jsonb_array_elements(h->'outcomes') x2;
  get diagnostics v_outcomes = row_count;
  v_redacted := v_messages - v_bodies;
  select count(*) - v_messages into v_missing from journal where estate_id = p_target and type = 'comms.message_submitted@1';
  perform board_backfill_deliveries(p_target);
  -- No journal event: the restored journal stays exactly the archive's prefix, which an owner's later private-history
  -- import requires (migration 66, ADR-0079). The counts are this answer, kept in the restore's operation record.
  return jsonb_build_object('ok', true, 'threads', v_threads, 'messages', v_messages, 'bodies', v_bodies, 'outcomes', v_outcomes,
    'redacted', v_redacted, 'missing', v_missing);
end $$;

-- ── 9 · the projector, one function per concern ─────────────────────────────────────────────────────────────
create function apply_comms_messages(e journal) returns void
language plpgsql security definer set search_path = public as $$
declare v_participants uuid[]; v_sender uuid; v_request boolean;
begin
  if e.type <> 'comms.message_submitted@1' then return; end if;
  v_request := jsonb_typeof(e.payload->'request') = 'object';
  if v_request then
    insert into board_requests (message_id, estate_id, target_project, capability, deadline, submitted_seq, updated_seq)
    values ((e.payload->>'message_id')::uuid, e.estate_id, (e.payload->'request'->>'target_project_id')::uuid,
            e.payload->'request'->>'capability', (e.payload->'request'->>'deadline')::timestamptz, e.seq, e.seq)
    on conflict (estate_id, message_id) do nothing;   -- replay: the row already records this seq
  end if;
  -- Who it is delivered to: a new thread's participants are in the event; an existing thread's are its fixed
  -- participants. A restore replays before its threads exist; `restore_board_history` backfills those.
  v_sender := (e.payload->>'sender_project_id')::uuid;
  if jsonb_typeof(e.payload->'thread_new') = 'object' then
    v_participants := array(select jsonb_array_elements_text(e.payload->'thread_new'->'participants')::uuid);
  else
    select participants into v_participants from board_threads where id = (e.payload->>'thread_id')::uuid and estate_id = e.estate_id;
  end if;
  if v_participants is not null then
    insert into board_deliveries (estate_id, message_id, recipient_project, seq, is_request, capability)
    select e.estate_id, (e.payload->>'message_id')::uuid, p, e.seq, v_request, case when v_request then e.payload->'request'->>'capability' end
      from unnest(v_participants) p where p <> v_sender
    on conflict do nothing;
  end if;
end $$;

create function apply_comms_reads(e journal) returns void
language plpgsql security definer set search_path = public as $$
begin
  if e.type <> 'comms.read_acked@1' then return; end if;
  insert into board_read_marks values (e.estate_id, (e.payload->>'reader_project_id')::uuid, (e.payload->>'message_id')::uuid, e.seq)
  on conflict (estate_id, reader_project, message_id) do nothing;
end $$;

-- A transition applies once: a row already past this seq is a replay.
create function apply_comms_requests(e journal) returns void
language plpgsql security definer set search_path = public as $$
begin
  if e.type <> 'comms.request_transitioned@1' then return; end if;
  update board_requests set state = e.payload->>'to', effect = e.payload->>'effect_to',
                            revision = (e.payload->>'revision')::bigint, updated_seq = e.seq
   where estate_id = e.estate_id and message_id = (e.payload->>'request_id')::uuid and updated_seq < e.seq;
end $$;

create function apply_comms_epochs(e journal) returns void
language plpgsql security definer set search_path = public as $$
declare v_project uuid; v_closed integer; v_opened integer; x jsonb;
begin
  case e.type
    when 'comms.epoch_rotated@1' then
      v_project := (e.payload->>'project_id')::uuid;
      v_closed := (e.payload->>'closed_epoch')::integer;
      v_opened := (e.payload->>'opened_epoch')::integer;
      -- The closed epoch may be unknown here (opened lazily in another estate, or before a restore): it is recorded.
      insert into board_epochs (estate_id, project_id, epoch, state, opened_at, closed_seq, closed_at)
      values (e.estate_id, v_project, v_closed, 'closed', e.occurred_at, e.seq, e.occurred_at)
      on conflict (estate_id, project_id, epoch) do update set state = 'closed', closed_seq = e.seq, closed_at = e.occurred_at
        where board_epochs.state = 'open';
      insert into board_epochs (estate_id, project_id, epoch, state, opened_seq, opened_at)
      values (e.estate_id, v_project, v_opened, 'open', e.seq, e.occurred_at)
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

-- The dispatcher migration 81 registered, now one line per concern (`apply_projections` already calls it).
create or replace function apply_comms(e journal) returns void
language plpgsql security definer set search_path = public as $$
begin
  if e.type not like 'comms.%' then return; end if;
  perform apply_comms_messages(e);
  perform apply_comms_reads(e);
  perform apply_comms_requests(e);
  perform apply_comms_epochs(e);
end $$;

-- Deliveries for every message already stored (P:90's backfill).
do $$ begin perform board_backfill_deliveries(null); end $$;

-- ── 10 · the doors ──────────────────────────────────────────────────────────────────────────────────────────
-- Helpers: no API role runs them, service_role included (R-003). Commands: service_role only.
revoke execute on function board_idempotency_guard(), board_at(timestamptz), board_receipt_current(uuid, jsonb), board_rotate_epoch(uuid, uuid, integer, text),
  board_epoch_gate(uuid, uuid, text, integer, text, text, boolean), board_store_receipt(uuid, uuid, text, integer, text, text, jsonb),
  board_body_refusal(jsonb), board_idempotency_refusal(jsonb),
  board_insert_message(uuid, uuid, jsonb, text, uuid, uuid[], text, uuid, uuid, text, timestamptz, jsonb, text, text, text, text),
  board_transition(uuid, uuid, text, text, text, text, jsonb), board_responders_json(uuid, uuid), board_backfill_deliveries(uuid),
  board_epoch_rotation_share(), board_epoch_max_age(), board_receipt_retention(), board_outbox_retention(),
  apply_comms_messages(journal), apply_comms_reads(journal), apply_comms_requests(journal), apply_comms_epochs(journal),
  board_current_epoch(uuid, uuid), board_append(uuid, text, jsonb, jsonb), apply_comms(journal)
  from public, anon, authenticated, service_role;
revoke execute on function board_reply(uuid, uuid, jsonb, jsonb, text), board_cancel(uuid, uuid, jsonb, jsonb, text),
  board_status(uuid, uuid), board_tick(uuid), board_outbox_read(uuid, text, bigint, integer),
  board_outbox_advance(uuid, text, bigint, bigint), board_history_export(uuid, bigint), restore_board_history(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function board_reply(uuid, uuid, jsonb, jsonb, text), board_cancel(uuid, uuid, jsonb, jsonb, text),
  board_status(uuid, uuid), board_tick(uuid), board_outbox_read(uuid, text, bigint, integer),
  board_outbox_advance(uuid, text, bigint, bigint), board_history_export(uuid, bigint), restore_board_history(uuid, jsonb)
  to service_role;

-- #endregion project-board-lifecycle

-- ── schema 86 as a private-archive source ─────────────────────────────────────────────────────────────────────
-- ADR-0079 decision 5, as every step since 67 did: an archive exported at this schema imports. Migration 95's
-- canonical body with 85 and 86 added — 85 because migration 100 (count 85) did not add itself, so an archive
-- exported at 85 was refused by SQL while TypeScript admitted it (A7-045). Nothing else changes.
-- #region private-archive-source-schema — docs: docs/adr/0079-private-conversation-archives-preserve-history-not-authority.md#decision
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb,'71'::jsonb,'72'::jsonb,'73'::jsonb,'74'::jsonb,'75'::jsonb,'76'::jsonb,'77'::jsonb,'78'::jsonb,'79'::jsonb,'80'::jsonb,'81'::jsonb,'82'::jsonb,'83'::jsonb,'84'::jsonb,'85'::jsonb,'86'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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
-- #endregion private-archive-source-schema
