-- 79 (by count; suffix 81 sorts above every applied migration, ADR-0117 §5, CO-199) — the project board's
-- durable core, COM-02.1 of `docs/evidence/plans/2026-10-04-project-communications.md`.
--
-- Fabric hosts the board of `fabric-project-comms/0.1` (DEC-0022; ADR-0117). This migration stores what a
-- participant submits and reads, nothing more: no responders, claims or leases (COM-03), no mirrors
-- (COM-08), no screens (COM-06/07).
--
-- WHAT IS PRIMARY AND WHAT IS A PROJECTION. A message's body must be redactable ("a redacted message keeps
-- its id and digest and loses its body", project-comms.md), and the journal is append-only, so the board
-- follows the CEO conversation pattern (migration 64): the command `board_submit` writes the primary rows —
-- thread, message, body, idempotency receipt — in the SAME transaction as its journal event, and the event
-- carries references and the digest, never the body. Only two tables are projections of the journal:
-- `board_requests` (a request's state) and `board_read_marks`. Both are replay-safe: an event whose seq a
-- row already records is a no-op, because `rebuild_estate_projections` replays without clearing.
--
-- WHO MAY WRITE. `comms.*` events are appended only by the board's own commands: `append_event` refuses
-- them unless a board command authorized that exact payload in the same transaction, as it does for the
-- CEO's private events. The trusted host (service role) calls the commands with the estate, the sender's
-- Project and the principal taken from the authenticated endpoint; the payload never supplies them
-- (contract C1–C2), and these functions re-check every invariant the host already validated.
--
-- ORDER AND PAGINATION. A message's `seq` is its journal seq: per estate, gapless and assigned under the
-- estate lock, so commit order equals seq order and a reader paging by `seq` loses nothing to a concurrent
-- insert or a replay.
--
-- REFUSALS are returned, not raised, as the contract's `{error: {code, message, retryable}}`; every check
-- runs before the first write, and a refusal names no hidden Project, participant set or body.

-- #region project-board-core — docs: docs/adr/0117-fabric-hosts-the-project-board-of-fabric-project-comms.md#5-names-so-that-later-work-does-not-collide

insert into event_types (type, projects, note) values
  ('comms.message_submitted@1', true, 'a Project submitted a board message (message, request, reply, finding or announcement); the event carries ids, the digest and a request''s target and capability, never the body'),
  ('comms.read_acked@1', true, 'a participant Project explicitly marked a board message read; reading alone marks nothing');

create table board_threads (
  id            uuid primary key,
  estate_id     uuid not null,
  -- Fixed at creation (C2): no function here changes them; widening is a future explicit sharing command.
  participants  uuid[] not null check (cardinality(participants) between 1 and 16),
  subject       text check (subject is null or length(subject) between 1 and 200),
  created_by    uuid not null,
  created_seq   bigint not null check (created_seq between 1 and 9007199254740991),
  unique (id, estate_id)
);
create table board_messages (
  id              uuid primary key,
  estate_id       uuid not null,
  thread_id       uuid not null,
  seq             bigint not null check (seq between 1 and 9007199254740991),
  sender_project  uuid not null,
  principal       jsonb not null,
  kind            text not null check (kind in ('message', 'request', 'reply', 'finding', 'announcement')),
  digest          text not null check (digest ~ '^sha256:[0-9a-f]{64}$'),
  reply_to        uuid,
  artifacts       jsonb not null default '[]'::jsonb check (jsonb_typeof(artifacts) = 'array' and jsonb_array_length(artifacts) <= 8),
  at              timestamptz not null,
  unique (estate_id, seq),
  unique (id, estate_id),
  foreign key (thread_id, estate_id) references board_threads (id, estate_id)
);
-- The body apart from the message, so that redaction (a later, separately authorized command) removes
-- the body and keeps the message, its id and its digest.
create table board_bodies (
  message_id  uuid primary key,
  estate_id   uuid not null,
  text        text not null check (octet_length(text) between 1 and 65536),
  format      text not null default 'text/plain' check (format in ('text/plain', 'text/markdown')),
  -- Composite, so a body can never name another estate's message (scripts/check-estate-references).
  foreign key (message_id, estate_id) references board_messages (id, estate_id)
);
-- One receipt per (estate, sender Project, operation family, epoch, key). The namespace is the logical
-- Project and operation, not the session, so a replacement responder can retry the same command (C6).
create table board_idempotency (
  estate_id       uuid not null,
  sender_project  uuid not null,
  operation       text not null check (operation in ('submit')),
  epoch           integer not null check (epoch >= 1),
  key             text not null check (key ~ '^[A-Za-z0-9._:-]{8,128}$'),
  digest          text not null check (digest ~ '^sha256:[0-9a-f]{64}$'),
  receipt         jsonb not null,
  primary key (estate_id, sender_project, operation, epoch, key)
);
-- Projection: a request's state and effect, separate facts (contract "Request lifecycle"). COM-02 writes
-- only `queued`/`not_started`; the transitions arrive with COM-03's responder commands.
create table board_requests (
  message_id      uuid primary key,
  estate_id       uuid not null,
  target_project  uuid not null,
  capability      text not null check (capability ~ '^[a-z][a-z0-9._-]{1,127}$'),   -- common.schema.json#/$defs/capabilityName
  deadline        timestamptz,
  state           text not null default 'queued' check (state in ('queued', 'claimed', 'accepted', 'in_progress', 'completed', 'failed_known', 'cancelled', 'expired', 'outcome_unknown')),
  effect          text not null default 'not_started' check (effect in ('not_started', 'started', 'succeeded_observed', 'failed_observed', 'unknown')),
  revision        bigint not null default 1 check (revision >= 1),
  submitted_seq   bigint not null,
  updated_seq     bigint not null
);
-- Projection: explicit read acknowledgements; unread counts belong to the reader.
create table board_read_marks (
  estate_id       uuid not null,
  reader_project  uuid not null,
  message_id      uuid not null,
  seq             bigint not null,
  primary key (estate_id, reader_project, message_id)
);
create table board_write_authorizations (
  transaction_id  bigint not null,
  estate_id       uuid not null,
  type            text not null,
  payload         jsonb not null,
  primary key (transaction_id, estate_id)
);
create index board_messages_thread_seq on board_messages (estate_id, thread_id, seq);
create index board_threads_participants on board_threads using gin (participants);

-- Primary rows are immutable even through an accidental definer update; redaction will be its own,
-- separately authorized path that deletes a body row only.
create function board_primary_immutable() returns trigger language plpgsql set search_path = public as $$
begin raise exception 'board primary record is immutable' using errcode = 'insufficient_privilege'; end $$;
create trigger board_thread_immutable before update or delete on board_threads for each row execute function board_primary_immutable();
create trigger board_message_immutable before update or delete on board_messages for each row execute function board_primary_immutable();
create trigger board_body_immutable before update on board_bodies for each row execute function board_primary_immutable();
create trigger board_idempotency_immutable before update or delete on board_idempotency for each row execute function board_primary_immutable();

alter table board_threads enable row level security;
alter table board_messages enable row level security;
alter table board_bodies enable row level security;
alter table board_idempotency enable row level security;
alter table board_requests enable row level security;
alter table board_read_marks enable row level security;
alter table board_write_authorizations enable row level security;
-- No API role reads a board table directly: a participant reads only through the commands, which apply
-- the participant rule. A plain service-role select would be the estate-wide read the report forbids.
revoke all on board_threads, board_messages, board_bodies, board_idempotency, board_requests, board_read_marks,
  board_write_authorizations from public, anon, authenticated, service_role;

create function board_refusal(p_code text, p_message text, p_retryable boolean default false) returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_build_object('error', jsonb_build_object('code', p_code, 'message', p_message, 'retryable', p_retryable))
$$;

create function board_is_project(p_estate_id uuid, p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from projects where id = p_project and estate_id = p_estate_id and status = 'active')
$$;

create function board_principal_valid(p jsonb) returns boolean language sql immutable set search_path = public as $$
  select coalesce(jsonb_typeof(p) = 'object'
    and (select array_agg(k order by k) from jsonb_object_keys(p) k) <@ array['id', 'kind', 'label', 'provenance']
    and p->>'kind' in ('agent', 'person', 'operator')
    and jsonb_typeof(p->'id') = 'string' and length(p->>'id') between 1 and 200
    and (p->'label' is null or (jsonb_typeof(p->'label') = 'string' and length(p->>'label') <= 80))
    and p->>'provenance' in ('trusted', 'asserted'), false)
$$;

create function board_append(p_estate_id uuid, p_type text, p_actor jsonb, p_payload jsonb) returns journal
language plpgsql security definer set search_path = public as $$
declare j journal;
begin
  insert into board_write_authorizations values (txid_current(), p_estate_id, p_type, p_payload);
  select * into j from append_event(p_estate_id, p_type, p_actor, p_payload, '1');
  delete from board_write_authorizations where transaction_id = txid_current() and estate_id = p_estate_id;
  return j;
end $$;

-- The epoch a sender writes under. COM-02 opens epoch 1 and never retires it; rotation and the
-- retirement receipts arrive with retention (COM-02.3), and a retired epoch is then refused for ever.
create function board_current_epoch(p_estate_id uuid, p_sender uuid) returns integer
language sql stable set search_path = public as $$ select 1 $$;

-- Keys one epoch may hold before a submit is refused before any effect (C6, `capacity_exceeded`).
create function board_epoch_capacity() returns integer language sql immutable set search_path = public as $$ select 100000 $$;

create function board_submit(p_estate_id uuid, p_sender uuid, p_principal jsonb, p_submit jsonb, p_digest text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s jsonb := p_submit;
  v_epoch integer; v_key text; v_kind text; v_body text; v_format text;
  v_thread uuid; v_new boolean; v_participants uuid[]; v_subject text; v_reply uuid;
  v_target uuid; v_capability text; v_deadline timestamptz; v_artifacts jsonb;
  existing board_idempotency; t board_threads; v_message uuid := gen_random_uuid(); j journal; v_receipt jsonb;
  v_actor jsonb; p text;
begin
  -- Shape and identity first: nothing below runs on a malformed call.
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
  if jsonb_typeof(s->'idempotency') is distinct from 'object' or jsonb_typeof(s->'idempotency'->'epoch') is distinct from 'number'
     or coalesce(s->'idempotency'->>'key', '') !~ '^[A-Za-z0-9._:-]{8,128}$' then
    return board_refusal('invalid_arguments', 'The idempotency key is missing or malformed.');
  end if;
  v_epoch := (s->'idempotency'->>'epoch')::numeric::integer;
  v_key := s->'idempotency'->>'key';

  -- One submit per (sender, key) at a time: a concurrent duplicate waits here and then sees the receipt.
  perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text || '/' || p_sender::text || '/' || v_epoch::text || '/' || v_key, 4243));
  if v_epoch < board_current_epoch(p_estate_id, p_sender) then
    return board_refusal('idempotency_window_expired', 'This idempotency epoch is retired; read the current one and submit again.');
  elsif v_epoch > board_current_epoch(p_estate_id, p_sender) then
    return board_refusal('invalid_arguments', 'This idempotency epoch has not been issued.');
  end if;
  select * into existing from board_idempotency
   where estate_id = p_estate_id and sender_project = p_sender and operation = 'submit' and epoch = v_epoch and key = v_key;
  if found then
    if existing.digest = p_digest then return existing.receipt || jsonb_build_object('repeated', true); end if;
    return board_refusal('idempotency_conflict', 'This idempotency key was already used for a different message.');
  end if;
  if (select count(*) from board_idempotency where estate_id = p_estate_id and sender_project = p_sender
        and operation = 'submit' and epoch = v_epoch) >= board_epoch_capacity() then
    return board_refusal('capacity_exceeded', 'This idempotency epoch is full; nothing was stored.', true);
  end if;

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
        -- One sentence for a foreign, an absent and an archived Project alike: none of them is named.
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
    -- Absent, foreign and not-a-participant answer alike.
    if not found or not (p_sender = any (t.participants)) then
      return board_refusal('not_authorized', 'This Project does not take part in that thread.');
    end if;
    v_thread := t.id; v_participants := t.participants;
  end if;

  -- FAC-SEM-026: only a request carries request details, and its target takes part in the thread; a reply
  -- names what it answers, in the same thread.
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
  -- A reply names what it answers; any message MAY name one (the contract requires replyTo only of a reply),
  -- and what it names is a message of the same thread.
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

  -- Every check has passed; now the writes, all in this transaction.
  v_actor := jsonb_build_object('kind', case when p_principal->>'kind' = 'agent' then 'agent' else 'person' end,
                                'id', p_principal->>'id');
  if v_new then v_thread := gen_random_uuid(); end if;
  j := board_append(p_estate_id, 'comms.message_submitted@1', v_actor, jsonb_build_object(
    'message_id', v_message, 'thread_id', v_thread, 'kind', v_kind, 'sender_project_id', p_sender,
    'principal', p_principal, 'digest', p_digest, 'reply_to', v_reply, 'artifact_count', jsonb_array_length(v_artifacts),
    'thread_new', case when v_new then jsonb_build_object('participants', to_jsonb(v_participants), 'subject', v_subject) else null end,
    'request', case when v_kind = 'request' then jsonb_build_object('target_project_id', v_target, 'capability', v_capability, 'deadline', v_deadline) else null end));
  if v_new then
    insert into board_threads values (v_thread, p_estate_id, v_participants, v_subject, p_sender, j.seq);
  end if;
  insert into board_messages values (v_message, p_estate_id, v_thread, j.seq, p_sender, p_principal, v_kind, p_digest, v_reply, v_artifacts, j.occurred_at);
  insert into board_bodies values (v_message, p_estate_id, v_body, v_format);
  v_receipt := jsonb_build_object('ok', true, 'message', v_message, 'thread', v_thread, 'seq', j.seq, 'at', j.occurred_at,
    'request', case when v_kind = 'request' then v_message else null end, 'repeated', false);
  insert into board_idempotency values (p_estate_id, p_sender, 'submit', v_epoch, v_key, p_digest, v_receipt);
  return v_receipt;
end $$;

-- One message as `comms-message.schema.json` reads it. `request.id` is the message's own id: a request
-- is a kind of message, and its state lives beside it.
create function board_message_json(m board_messages) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', m.id, 'thread', m.thread_id, 'kind', m.kind,
    'sender', jsonb_build_object('project', m.sender_project, 'principal', m.principal),
    'at', to_char(m.at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'digest', m.digest,
    'body', (select jsonb_strip_nulls(jsonb_build_object('text', b.text, 'format', b.format)) from board_bodies b where b.message_id = m.id),
    'redacted', case when not exists (select 1 from board_bodies b where b.message_id = m.id) then true end,
    'replyTo', m.reply_to,
    'request', (select jsonb_strip_nulls(jsonb_build_object('id', r.message_id, 'target', r.target_project, 'capability', r.capability,
                  'state', r.state, 'effect', r.effect,
                  'deadline', to_char(r.deadline at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'revision', r.revision))
                from board_requests r where r.message_id = m.id),
    'artifacts', case when jsonb_array_length(m.artifacts) > 0 then m.artifacts end))
$$;

-- One page for a reader: messages of the threads it takes part in, after `p_after_seq`, oldest first, at
-- most 100. The host binds the opaque cursor to the reader, grant, filter and restore epoch (C3); this
-- function answers for exactly one reader and never shows another Project's thread.
create function board_list(p_estate_id uuid, p_reader uuid, p_thread uuid, p_after_seq bigint, p_limit integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100); v_rows jsonb; v_last bigint; v_more boolean;
begin
  if p_estate_id is null or p_reader is null or p_after_seq is null or p_after_seq < 0 then
    return board_refusal('invalid_arguments', 'The page request is not valid.');
  end if;
  if not board_is_project(p_estate_id, p_reader) then return board_refusal('not_authorized', 'This Project may not read the board.'); end if;
  if p_thread is not null and not exists (select 1 from board_threads t where t.id = p_thread and t.estate_id = p_estate_id and p_reader = any (t.participants)) then
    return board_refusal('not_authorized', 'This Project does not take part in that thread.');
  end if;
  with page as (
    select m.id, m.seq from board_messages m join board_threads t on t.id = m.thread_id and t.estate_id = m.estate_id
     where m.estate_id = p_estate_id and p_reader = any (t.participants) and m.seq > p_after_seq
       and (p_thread is null or m.thread_id = p_thread)
     order by m.seq limit v_limit + 1),
  kept as (select id, seq from page order by seq limit v_limit)
  select coalesce((select jsonb_agg(board_message_json(bm) order by bm.seq) from board_messages bm join kept k on k.id = bm.id), '[]'::jsonb),
         (select max(seq) from kept), (select count(*) from page) > v_limit
    into v_rows, v_last, v_more;
  return jsonb_build_object('ok', true, 'messages', v_rows, 'last_seq', coalesce(v_last, p_after_seq), 'more', coalesce(v_more, false));
end $$;

create function board_get(p_estate_id uuid, p_reader uuid, p_message uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m board_messages;
begin
  select bm.* into m from board_messages bm join board_threads t on t.id = bm.thread_id and t.estate_id = bm.estate_id
   where bm.id = p_message and bm.estate_id = p_estate_id and p_reader = any (t.participants);
  if not found then return board_refusal('not_authorized', 'This Project cannot read that message.'); end if;
  return jsonb_build_object('ok', true, 'message', board_message_json(m));
end $$;

-- An explicit read mark (reading marks nothing). Repeating it returns the same receipt and appends nothing.
create function board_read_ack(p_estate_id uuid, p_reader uuid, p_principal jsonb, p_message uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m board_messages; prior board_read_marks; j journal;
begin
  if not board_principal_valid(p_principal) then return board_refusal('invalid_arguments', 'The principal is not valid.'); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text || '/ack/' || p_reader::text || '/' || coalesce(p_message::text, ''), 4244));
  select bm.* into m from board_messages bm join board_threads t on t.id = bm.thread_id and t.estate_id = bm.estate_id
   where bm.id = p_message and bm.estate_id = p_estate_id and p_reader = any (t.participants);
  if not found then return board_refusal('not_authorized', 'This Project cannot read that message.'); end if;
  select * into prior from board_read_marks where estate_id = p_estate_id and reader_project = p_reader and message_id = p_message;
  if found then return jsonb_build_object('ok', true, 'message', p_message, 'seq', prior.seq, 'repeated', true); end if;
  j := board_append(p_estate_id, 'comms.read_acked@1',
    jsonb_build_object('kind', case when p_principal->>'kind' = 'agent' then 'agent' else 'person' end, 'id', p_principal->>'id'),
    jsonb_build_object('reader_project_id', p_reader, 'message_id', p_message, 'principal', p_principal));
  return jsonb_build_object('ok', true, 'message', p_message, 'seq', j.seq, 'repeated', false);
end $$;

-- The reader's unread count: messages in its threads, not its own, without its read mark.
create function board_unread(p_estate_id uuid, p_reader uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from board_messages m join board_threads t on t.id = m.thread_id and t.estate_id = m.estate_id
   where m.estate_id = p_estate_id and p_reader = any (t.participants) and m.sender_project <> p_reader
     and not exists (select 1 from board_read_marks r where r.estate_id = m.estate_id and r.reader_project = p_reader and r.message_id = m.id)
$$;

-- The projector: replay-safe, decided from the event alone.
create or replace function apply_comms(e journal) returns void
language plpgsql security definer set search_path = public as $$
begin
  case e.type
    when 'comms.message_submitted@1' then
      if e.payload->'request' is not null and e.payload->'request' <> 'null'::jsonb then
        insert into board_requests (message_id, estate_id, target_project, capability, deadline, submitted_seq, updated_seq)
        values ((e.payload->>'message_id')::uuid, e.estate_id, (e.payload->'request'->>'target_project_id')::uuid,
                e.payload->'request'->>'capability', (e.payload->'request'->>'deadline')::timestamptz, e.seq, e.seq)
        on conflict (message_id) do nothing;   -- replay: the row already records this seq
      end if;
    when 'comms.read_acked@1' then
      insert into board_read_marks values (e.estate_id, (e.payload->>'reader_project_id')::uuid, (e.payload->>'message_id')::uuid, e.seq)
      on conflict (estate_id, reader_project, message_id) do nothing;
    else null;
  end case;
end $$;

revoke execute on function board_refusal(text, text, boolean), board_is_project(uuid, uuid), board_principal_valid(jsonb),
  board_append(uuid, text, jsonb, jsonb), board_current_epoch(uuid, uuid), board_epoch_capacity(),
  board_message_json(board_messages), apply_comms(journal), board_primary_immutable()
  from public, anon, authenticated, service_role;
revoke execute on function board_submit(uuid, uuid, jsonb, jsonb, text), board_list(uuid, uuid, uuid, bigint, integer),
  board_get(uuid, uuid, uuid), board_read_ack(uuid, uuid, jsonb, uuid), board_unread(uuid, uuid) from public, anon, authenticated;
grant execute on function board_submit(uuid, uuid, jsonb, jsonb, text), board_list(uuid, uuid, uuid, bigint, integer),
  board_get(uuid, uuid, uuid), board_read_ack(uuid, uuid, jsonb, uuid), board_unread(uuid, uuid) to service_role;

-- #endregion project-board-core

-- append_event: migration 74's body, plus the board's gate before the estate lock.
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
  perform refuse_noncanonical_identity(p_type, p_payload);   -- migration 74: no lock taken yet
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
  -- migration 79: the board's events come only from the board's own commands (board_append).
  if p_type like 'comms.%' and not exists (
    select 1 from board_write_authorizations a where a.transaction_id=txid_current()
      and a.estate_id=p_estate_id and a.type=p_type and a.payload=p_payload
      and p_project_id is null and p_run_id is null and p_node_id is null and p_schema_rev='1'
  ) then raise exception 'Use the board commands' using errcode='insufficient_privilege'; end if;
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

-- The dispatcher gains ONE line; the concern is apply_comms above.
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
  perform apply_question_deferrals(e);
  perform apply_priority(e);
  perform apply_effect_lifecycle(e);
  perform apply_heartbeats(e);
  perform apply_deliveries(e);
  perform apply_task_runs(e);
  perform apply_transcript_capture(e);
  perform apply_ceo_receipt(e);
  perform apply_releases(e);
  perform apply_hub_access(e);
  perform apply_comms(e);
end;
$$;
revoke execute on function apply_projections(journal) from public, anon, authenticated, service_role;

-- ── schema 79 as a private-archive source ───────────────────────────────────
--
-- ADR-0079 decision 5, as migrations 67–80 did for their own numbers. Migration 79 (by count) registers two
-- event types, so a schema-79 journal may carry them and only a schema that registers them can restore it.
-- An export now names 79; import accepts 66 to 79. The bodies are migration 80's (count 78), changed only at
-- the accepted version list. Board message bodies are primary rows, not journal content, so an archive
-- carries the board's events and digests, never its bodies (ADR-0117 §6: a restored board keeps history only).
-- #region private-archive-source-schema — docs: docs/adr/0079-private-conversation-archives-preserve-history-not-authority.md#decision
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb,'71'::jsonb,'72'::jsonb,'73'::jsonb,'74'::jsonb,'75'::jsonb,'76'::jsonb,'77'::jsonb,'78'::jsonb,'79'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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

  v_archive:=jsonb_build_object('schema','CeoPrivateArchive@1','archive_id',gen_random_uuid(),'source_schema_version',schema_version(),'owner_person_id',p_person_id,
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
