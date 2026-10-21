-- 95 (by count; suffix 120): the board part of Fabric 0.3.9 "the core holds"
-- (docs/evidence/plans/2026-10-21-core-reliability/2026-10-21-board.md, BD-1 to BD-4; BD-2's operator read).
--
-- NUMBERS. `schema_version()` counts applied migrations, so this file makes the schema 95. The task pipeline's prose
-- reservation holds 117/118 unexecuted (`docs/evidence/plans/task-pipeline-persistence-contract.md`); this file takes
-- 120, past it, and leaves 119 to the other 0.3.9 branches. If two 0.3.9 branches land migrations, the later one is
-- renumbered at integration and its private-archive line admits its own count.
--
-- WHAT THIS ADDS
--   * BD-1, a reply answers a request. A message from a request's TARGET Project that names the request (com.reply, or
--     com.submit with replyTo; never another request) moves a queued request to `answered`, as a
--     `comms.request_transitioned@1` with op `answer` and cause `target-reply`, in the reply's own transaction. The
--     request row is locked before the reply's append (ADR-0149 §5's lock order: the command's own row, then the
--     estate). `answered` is not open: it leaves the thread's open count, the target's responder list and the
--     operator's waiting reads, the tick no longer expires it, and the requester may still cancel it. The tick answers
--     queued requests a target replied to before this rule (the six requests of 2026-10-16 to 10-20).
--   * BD-1, nothing stays queued for ever. A request submitted without a deadline gets one seven days out, written into
--     its event, so a rebuild keeps it. A request stored before this release with no deadline expires at the tick once
--     its message is older than the same seven days; that is a read of the message's time, never a rewritten event.
--   * BD-1, `board_responder_possible`: whether anyone can answer a (Project, capability) now: a slot with a holder,
--     or a live board.respond grant. The app adds `noResponder` to a request's receipt when nobody can (it is accepted:
--     the target can still answer it with a reply, and a grant may come later).
--   * BD-3, `board_list_reader`: board_list's page with each message's `read` for this reader, optionally only what is
--     unread to it and only what was written since a time. `board_list` itself is unchanged: the contract's page has no
--     read field, so a caller that asks nothing new gets exactly the contract's bytes. The thread test is
--     `participants @> array[reader]`, which the GIN index serves (BD-10).
--   * BD-3, `board_cursor_keys` and `board_cursor_key`: the key that binds a com.list cursor, one per estate, kept in the
--     database so a cursor survives an app restart. Operational, not projected: a restored estate has a new id and so a
--     new key, and its old cursors read `cursor_reset_required`, which the contract asks for after a restore.
--   * BD-4, `board_read_ack_many` and `comms.read_acked_many@1`: up to 100 named messages, or every message of one
--     thread delivered to the reader at or before a named one (at most 1000), marked read in one call and ONE journal
--     event. All or nothing: a message the reader cannot read refuses the call. Marking again changes nothing.
--   * BD-2, `board_waiting_operator`: requests waiting with nobody to answer them, and unread deliveries, each with the
--     oldest; `board_pending_operator` counts a request nobody answers whether or not its target marked it read.
--   * Schema 95 as a private-archive source (ADR-0079 decision 5): migration 116's function with 95 admitted.
--
-- The dispatcher is migration 104's, plus one line.

-- #region board-core-holds — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#board

insert into event_types (type, projects, note) values
  ('comms.read_acked_many@1', true, 'a participant Project marked several board messages read in one call; the event carries the reader and the message ids, never a body')
on conflict (type) do nothing;

-- ── 1 · BD-1: answered, the default deadline, who can answer ───────────────────────────────────────────────────
alter table board_requests drop constraint board_requests_state_check,
  add constraint board_requests_state_check check (state in
    ('queued', 'claimed', 'accepted', 'in_progress', 'completed', 'failed_known', 'cancelled', 'expired', 'outcome_unknown', 'answered'));

-- Whether a request still waits on someone: every state but the terminal ones and `answered`.
create function board_request_open(p_state text) returns boolean language sql immutable set search_path = public as $$
  select p_state not in ('completed', 'failed_known', 'cancelled', 'expired', 'answered')
$$;
-- How long a request with no deadline of its own may wait: seven days, in hours so a daylight-saving change in the
-- session's time zone cannot make it 167 or 169.
create function board_request_default_ttl() returns interval language sql immutable set search_path = public as $$ select interval '168 hours' $$;

create index if not exists board_messages_reply_to on board_messages (estate_id, reply_to) where reply_to is not null;

-- Migration 86's `board_insert_message` (shared by submit and reply), plus the default deadline and the answer.
create or replace function board_insert_message(p_estate uuid, p_sender uuid, p_principal jsonb, p_kind text, p_thread uuid,
  p_new_participants uuid[], p_subject text, p_reply_to uuid, p_target uuid, p_capability text, p_deadline timestamptz,
  p_artifacts jsonb, p_body text, p_format text, p_digest text, p_operation text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_message uuid := gen_random_uuid(); v_thread uuid := coalesce(p_thread, gen_random_uuid()); v_new boolean := p_thread is null; j journal;
        v_deadline timestamptz := p_deadline; v_answers board_requests; v_actor jsonb;
begin
  if p_kind = 'request' and v_deadline is null then v_deadline := clock_timestamp() + board_request_default_ttl(); end if;
  v_actor := jsonb_build_object('kind', case when p_principal->>'kind' = 'agent' then 'agent' else 'person' end, 'id', p_principal->>'id');
  -- BD-1: the request this message answers, locked before the append takes the estate (ADR-0149 §5).
  if p_reply_to is not null and p_kind <> 'request' then
    select * into v_answers from board_requests
     where estate_id = p_estate and message_id = p_reply_to and target_project = p_sender and state = 'queued' for update;
  end if;
  j := board_append(p_estate, 'comms.message_submitted@1', v_actor,
    jsonb_build_object(
      'message_id', v_message, 'thread_id', v_thread, 'kind', p_kind, 'sender_project_id', p_sender,
      'principal', p_principal, 'digest', p_digest, 'reply_to', p_reply_to, 'artifact_count', jsonb_array_length(p_artifacts),
      'thread_new', case when v_new then jsonb_build_object('participants', to_jsonb(p_new_participants), 'subject', p_subject) else null end,
      'request', case when p_kind = 'request' then jsonb_build_object('target_project_id', p_target, 'capability', p_capability, 'deadline', v_deadline) else null end,
      'operation', p_operation));
  if v_new then insert into board_threads values (v_thread, p_estate, p_new_participants, p_subject, p_sender, j.seq); end if;
  insert into board_messages values (v_message, p_estate, v_thread, j.seq, p_sender, p_principal, p_kind, p_digest, p_reply_to, p_artifacts, j.occurred_at);
  insert into board_bodies values (v_message, p_estate, p_body, p_format);
  if v_answers.message_id is not null then
    perform board_transition(p_estate, v_answers.message_id, 'answer', 'answered', v_answers.effect, 'target-reply', v_actor);
  end if;
  return jsonb_build_object('message', v_message, 'thread', v_thread, 'at', board_at(j.occurred_at));
end $$;

-- Whether anyone can answer a (Project, capability) now: a slot someone holds, or a live board.respond grant that would
-- let a session take it. Read by the app after a request is stored, to say `noResponder` in the receipt.
create function board_responder_possible(p_estate uuid, p_project uuid, p_capability text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if p_estate is null or p_project is null or coalesce(p_capability, '') !~ '^[a-z][a-z0-9._-]{1,127}$' then
    return board_refusal('invalid_arguments', 'Name a Project and a capability.');
  end if;
  return jsonb_build_object('ok', true, 'possible',
    exists (select 1 from board_responder_slots s where s.estate_id = p_estate and s.project_id = p_project and s.capability = p_capability
              and s.holder_enrollment is not null)
    or p_capability = any (board_listed_capabilities(p_estate, p_project)));
end $$;

-- ── 2 · BD-3: what is new to a reader, and cursors that outlive a restart ──────────────────────────────────────
-- One page for a reader, as `board_list` pages (after a seq, oldest first, at most 100), with each message's `read`
-- for this reader: its own messages and those it marked are read. `p_unread` keeps only the unread; `p_since` only what
-- was written at or after that time.
create function board_list_reader(p_estate_id uuid, p_reader uuid, p_thread uuid, p_after_seq bigint, p_limit integer,
  p_unread boolean, p_since timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100); v_rows jsonb; v_last bigint; v_more boolean;
        v_unread boolean := coalesce(p_unread, false);
begin
  if p_estate_id is null or p_reader is null or p_after_seq is null or p_after_seq < 0 then
    return board_refusal('invalid_arguments', 'The page request is not valid.');
  end if;
  if not board_is_project(p_estate_id, p_reader) then return board_refusal('not_authorized', 'This Project may not read the board.'); end if;
  if p_thread is not null and not exists (select 1 from board_threads t where t.id = p_thread and t.estate_id = p_estate_id and t.participants @> array[p_reader]) then
    return board_refusal('not_authorized', 'This Project does not take part in that thread.');
  end if;
  with page as (
    select m.id, m.seq from board_messages m join board_threads t on t.id = m.thread_id and t.estate_id = m.estate_id
     where m.estate_id = p_estate_id and t.participants @> array[p_reader] and m.seq > p_after_seq
       and (p_thread is null or m.thread_id = p_thread)
       and (p_since is null or m.at >= p_since)
       and (not v_unread or (m.sender_project <> p_reader
              and not exists (select 1 from board_read_marks r where r.estate_id = m.estate_id and r.reader_project = p_reader and r.message_id = m.id)))
     order by m.seq limit v_limit + 1),
  kept as (select id, seq from page order by seq limit v_limit)
  select coalesce((select jsonb_agg(board_message_json(bm) || jsonb_build_object('read',
             bm.sender_project = p_reader
             or exists (select 1 from board_read_marks r where r.estate_id = bm.estate_id and r.reader_project = p_reader and r.message_id = bm.id))
           order by bm.seq) from board_messages bm join kept k on k.id = bm.id), '[]'::jsonb),
         (select max(seq) from kept), (select count(*) from page) > v_limit
    into v_rows, v_last, v_more;
  return jsonb_build_object('ok', true, 'messages', v_rows, 'last_seq', coalesce(v_last, p_after_seq), 'more', coalesce(v_more, false));
end $$;

-- The key that binds a com.list cursor (an HMAC key, 32 bytes), one per estate. Operational: written by its door only,
-- read by nothing else, never exported. Two v4 uuids from the server's strong random source make it.
create table board_cursor_keys (
  estate_id   uuid primary key,
  key         bytea not null check (octet_length(key) = 32),
  created_at  timestamptz not null default clock_timestamp()
);
alter table board_cursor_keys enable row level security;
revoke all on board_cursor_keys from public, anon, authenticated, service_role;

create function board_cursor_key(p_estate uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k bytea;
begin
  if p_estate is null then return board_refusal('invalid_arguments', 'Name the estate.'); end if;
  insert into board_cursor_keys (estate_id, key)
  values (p_estate, decode(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'hex'))
  on conflict (estate_id) do nothing;
  select key into k from board_cursor_keys where estate_id = p_estate;
  return jsonb_build_object('ok', true, 'key', encode(k, 'hex'));
end $$;

-- ── 3 · BD-4: many read marks in one call ─────────────────────────────────────────────────────────────────────
-- Either up to 100 named messages, or one thread up to a named message of it: every message of that thread delivered to
-- the reader (so never its own) at or before that message, at most 1000. All or nothing: a message this Project cannot
-- read refuses the call, and nothing is marked. What is already marked is counted, not marked again; when nothing is
-- new the answer is `repeated: true` with the newest earlier mark's time, and nothing is appended.
create function board_read_ack_many(p_estate_id uuid, p_reader uuid, p_principal jsonb, p_messages uuid[], p_thread uuid, p_up_to uuid)
returns jsonb language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare v_ids uuid[]; v_new uuid[]; v_known integer; v_up board_messages; j journal; v_more boolean := false;
        v_by_list boolean := p_messages is not null; v_cap constant integer := 1000;
begin
  if not board_principal_valid(p_principal) then return board_refusal('invalid_arguments', 'The principal is not valid.'); end if;
  if v_by_list = (p_thread is not null or p_up_to is not null) or (not v_by_list and (p_thread is null or p_up_to is null)) then
    return board_refusal('invalid_arguments', 'Name the messages, or a thread and the message to mark read up to.');
  end if;
  if v_by_list and (cardinality(p_messages) is null or cardinality(p_messages) not between 1 and 100) then
    return board_refusal('invalid_arguments', 'Mark 1 to 100 messages in one call.');
  end if;
  if not board_is_project(p_estate_id, p_reader) then return board_refusal('not_authorized', 'This Project may not read the board.'); end if;
  -- One bulk mark per reader at a time; a single mark's own lock is per message, and the projection takes each mark once.
  perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text || '/ack-many/' || p_reader::text, 4244));
  if v_by_list then
    select array_agg(distinct x) into v_ids from unnest(p_messages) x;
    select count(*)::integer into v_known from board_messages bm join board_threads t on t.id = bm.thread_id and t.estate_id = bm.estate_id
     where bm.estate_id = p_estate_id and bm.id = any (v_ids) and t.participants @> array[p_reader];
    if v_known <> cardinality(v_ids) then return board_refusal('not_authorized', 'This Project cannot read one of those messages.'); end if;
  else
    select bm.* into v_up from board_messages bm join board_threads t on t.id = bm.thread_id and t.estate_id = bm.estate_id
     where bm.id = p_up_to and bm.estate_id = p_estate_id and bm.thread_id = p_thread and t.participants @> array[p_reader];
    if not found then return board_refusal('not_authorized', 'This Project cannot read that message in that thread.'); end if;
    select array_agg(id order by seq), count(*) > v_cap into v_ids, v_more from (
      select m.id, m.seq from board_messages m
       where m.estate_id = p_estate_id and m.thread_id = p_thread and m.seq <= v_up.seq and m.sender_project <> p_reader
       order by m.seq limit v_cap + 1) x;
    if v_more then v_ids := v_ids[1:v_cap]; end if;
    v_ids := coalesce(v_ids, '{}'::uuid[]);
  end if;
  select coalesce(array_agg(x), '{}'::uuid[]) into v_new from unnest(v_ids) x
   where not exists (select 1 from board_read_marks r where r.estate_id = p_estate_id and r.reader_project = p_reader and r.message_id = x);
  if cardinality(v_new) = 0 then
    return jsonb_strip_nulls(jsonb_build_object('ok', true, 'repeated', true, 'marked', 0, 'alreadyRead', cardinality(v_ids),
      'at', (select board_at(max(e.occurred_at)) from board_read_marks r join journal e on e.estate_id = r.estate_id and e.seq = r.seq
              where r.estate_id = p_estate_id and r.reader_project = p_reader and r.message_id = any (v_ids)),
      'more', case when v_more then true end));
  end if;
  j := board_append(p_estate_id, 'comms.read_acked_many@1',
    jsonb_build_object('kind', case when p_principal->>'kind' = 'agent' then 'agent' else 'person' end, 'id', p_principal->>'id'),
    jsonb_build_object('reader_project_id', p_reader, 'message_ids', to_jsonb(v_new), 'principal', p_principal));
  return jsonb_strip_nulls(jsonb_build_object('ok', true, 'repeated', false, 'marked', cardinality(v_new),
    'alreadyRead', cardinality(v_ids) - cardinality(v_new), 'at', board_at(j.occurred_at), 'more', case when v_more then true end));
end $$;

-- Its projector: one read mark per message, at the event's seq; a mark already there stays (replay-safe).
create function apply_comms_reads_many(e journal) returns void
language plpgsql security definer set search_path = public as $$
begin
  if e.type <> 'comms.read_acked_many@1' then return; end if;
  insert into board_read_marks (estate_id, reader_project, message_id, seq)
  select e.estate_id, (e.payload->>'reader_project_id')::uuid, x::uuid, e.seq
    from jsonb_array_elements_text(coalesce(e.payload->'message_ids', '[]'::jsonb)) x
  on conflict (estate_id, reader_project, message_id) do nothing;
end $$;

create or replace function apply_comms(e journal) returns void
language plpgsql security definer set search_path = public as $$
begin
  if e.type not like 'comms.%' then return; end if;
  perform apply_comms_messages(e);
  perform apply_comms_reads(e);
  perform apply_comms_reads_many(e);
  perform apply_comms_requests(e);
  perform apply_comms_epochs(e);
  perform apply_comms_responders(e);
  perform apply_comms_listings(e);
end $$;

-- ── 4 · BD-2: what waits reaches the operator ─────────────────────────────────────────────────────────────────
-- Migration 89's per-project read, with requests nobody answers counted from the requests themselves: a request its
-- target marked read and did not answer still waits (BD-2 measured 3 of 6 vanishing from "Waiting for a project").
create or replace function board_pending_operator(p_estate uuid, p_limit integer) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 100); v_rows jsonb; v_total bigint;
begin
  if p_estate is null then return board_refusal('invalid_arguments', 'The pending request is not valid.'); end if;
  with waiting as (
    -- Delivered, held by the board (a delivery whose message the board holds), and not marked read by the recipient.
    select d.recipient_project, d.is_request, m.kind, m.at
      from board_deliveries d
      join board_messages m on m.estate_id = d.estate_id and m.id = d.message_id
     where d.estate_id = p_estate
       and not exists (select 1 from board_read_marks r where r.estate_id = d.estate_id and r.reader_project = d.recipient_project and r.message_id = d.message_id)
  ), unread as (
    select w.recipient_project as project, count(*) as unread, min(w.at) as oldest_at,
           count(*) filter (where w.kind = 'finding') as findings,
           count(*) filter (where w.is_request) as requests
      from waiting w group by w.recipient_project
  ), asked as (
    -- An open request addressed to this project whose slot no responder holds, read or not.
    select br.target_project as project, count(*) as absent, min(m.at) as oldest_at
      from board_requests br
      join board_messages m on m.estate_id = br.estate_id and m.id = br.message_id
     where br.estate_id = p_estate and board_request_open(br.state)
       and not exists (select 1 from board_responder_slots s
                        where s.estate_id = p_estate and s.project_id = br.target_project and s.capability = br.capability
                          and s.holder_enrollment is not null)
     group by br.target_project
  ), per as (
    select coalesce(u.project, a.project) as project, coalesce(u.unread, 0) as unread, least(u.oldest_at, a.oldest_at) as oldest_at,
           coalesce(u.findings, 0) as findings, coalesce(u.requests, 0) as requests, coalesce(a.absent, 0) as absent
      from unread u full join asked a on a.project = u.project
  )
  select coalesce((select jsonb_agg(jsonb_build_object('project', x.project, 'unread', x.unread, 'oldestAt', board_at(x.oldest_at),
                                                       'findings', x.findings, 'requests', x.requests, 'requestsWithAbsentResponder', x.absent)
                                    order by x.oldest_at, x.project)
                     from (select * from per order by oldest_at, project limit v_limit) x), '[]'::jsonb),
         (select count(*) from per)
    into v_rows, v_total;
  return jsonb_build_object('ok', true, 'projects', v_rows, 'more', v_total > v_limit);
end $$;

-- The estate in two numbers for the home (BD-2): requests waiting with nobody to answer them, and board messages no
-- recipient has marked read, each with the oldest. Counts only: no body, no project name.
create function board_waiting_operator(p_estate uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_requests integer; v_oldest_request timestamptz; v_unread integer; v_oldest_unread timestamptz;
begin
  if p_estate is null then return board_refusal('invalid_arguments', 'The waiting request is not valid.'); end if;
  select count(*)::integer, min(m.at) into v_requests, v_oldest_request
    from board_requests br join board_messages m on m.estate_id = br.estate_id and m.id = br.message_id
   where br.estate_id = p_estate and board_request_open(br.state)
     and not exists (select 1 from board_responder_slots s
                      where s.estate_id = p_estate and s.project_id = br.target_project and s.capability = br.capability
                        and s.holder_enrollment is not null);
  select count(*)::integer, min(m.at) into v_unread, v_oldest_unread
    from board_deliveries d join board_messages m on m.estate_id = d.estate_id and m.id = d.message_id
   where d.estate_id = p_estate
     and not exists (select 1 from board_read_marks r where r.estate_id = d.estate_id and r.reader_project = d.recipient_project and r.message_id = d.message_id);
  return jsonb_strip_nulls(jsonb_build_object('ok', true, 'requests', v_requests, 'oldestRequestAt', board_at(v_oldest_request),
    'unread', v_unread, 'oldestUnreadAt', board_at(v_oldest_unread)));
end $$;

-- ── 5 · answered is not open: the reads that count open requests ──────────────────────────────────────────────
-- Migration 89's thread page, migration 86's thread list and migration 87's responder list, each with the one open test.
create or replace function board_thread_page_operator(p_estate uuid, p_filter jsonb, p_before jsonb, p_limit integer) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare f jsonb := coalesce(p_filter, '{}'::jsonb); v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
        v_project uuid; v_kind text; v_open boolean := false; v_since timestamptz; v_provider text;
        v_before_seq bigint; v_before_id uuid; v_rows jsonb; v_more boolean; v_next jsonb;
        bad constant jsonb := board_refusal('invalid_arguments', 'The thread page request is not valid.');
begin
  if p_estate is null or jsonb_typeof(f) is distinct from 'object'
     or exists (select 1 from jsonb_object_keys(f) k where k not in ('project', 'kind', 'openOnly', 'activeSince', 'provider')) then
    return bad;
  end if;
  if f ? 'project' then
    if jsonb_typeof(f->'project') is distinct from 'string' or not board_is_uuid(f->>'project') then return bad; end if;
    v_project := (f->>'project')::uuid;
  end if;
  if f ? 'kind' then
    if jsonb_typeof(f->'kind') is distinct from 'string' or f->>'kind' not in ('message', 'request', 'reply', 'finding', 'announcement') then return bad; end if;
    v_kind := f->>'kind';
  end if;
  if f ? 'openOnly' then
    if jsonb_typeof(f->'openOnly') is distinct from 'boolean' then return bad; end if;
    v_open := (f->>'openOnly')::boolean;
  end if;
  if f ? 'activeSince' then
    if jsonb_typeof(f->'activeSince') is distinct from 'string'
       or f->>'activeSince' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?Z$' then return bad; end if;
    begin
      v_since := (f->>'activeSince')::timestamptz;
    exception when others then return bad;
    end;
  end if;
  if f ? 'provider' then
    if jsonb_typeof(f->'provider') is distinct from 'string' or length(f->>'provider') not between 1 and 200 then return bad; end if;
    v_provider := f->>'provider';
  end if;
  if p_before is not null then
    if jsonb_typeof(p_before) is distinct from 'object'
       or exists (select 1 from jsonb_object_keys(p_before) k where k not in ('lastSeq', 'id'))
       or jsonb_typeof(p_before->'lastSeq') is distinct from 'number' or (p_before->>'lastSeq') !~ '^(0|[1-9][0-9]{0,15})$'
       or jsonb_typeof(p_before->'id') is distinct from 'string' or not board_is_uuid(p_before->>'id') then
      return bad;
    end if;
    v_before_seq := (p_before->>'lastSeq')::bigint;
    v_before_id := (p_before->>'id')::uuid;
  end if;
  with cand as (
    select t.id, t.subject, t.participants, t.created_by, t.created_seq,
           s.count as message_count, coalesce(s.last_seq, 0) as last_seq, s.last_at, s.kinds, r.open_requests, pv.providers
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
           and board_request_open(br.state)
      ) r on true
      -- The coding agents that took part: the enrollments any attempt on the thread's requests was made under.
      left join lateral (
        select coalesce(array_agg(distinct e.agent order by e.agent) filter (where e.agent is not null), '{}'::text[]) as providers
          from board_messages m
          join board_attempts a on a.estate_id = m.estate_id and a.request_id = m.id
          join board_enrollments e on e.estate_id = a.estate_id and e.id = a.enrollment_id
         where m.estate_id = t.estate_id and m.thread_id = t.id and m.kind = 'request'
      ) pv on true
     where t.estate_id = p_estate
       and (v_project is null or v_project = any (t.participants))
  ), filtered as (
    select * from cand
     where (v_kind is null or v_kind = any (kinds))
       and (not v_open or open_requests > 0)
       -- A window holds what was written inside it; an undated thread (no message) is in no window.
       and (v_since is null or (last_at is not null and last_at >= v_since))
       and (v_provider is null or v_provider = any (providers))
       and (v_before_seq is null or (last_seq, id) < (v_before_seq, v_before_id))
     order by last_seq desc, id desc
     limit v_limit + 1
  ), page as (select * from filtered order by last_seq desc, id desc limit v_limit)
  select coalesce((select jsonb_agg(jsonb_build_object(
           'id', p.id,
           'subject', p.subject,
           'participants', p.participants,
           'createdBy', p.created_by,
           'createdSeq', p.created_seq,
           'messageCount', p.message_count,
           'lastSeq', p.last_seq,
           'lastAt', case when p.last_at is not null then board_at(p.last_at) end,
           'kinds', to_jsonb(p.kinds),
           'openRequests', p.open_requests,
           'providers', to_jsonb(p.providers)
         ) order by p.last_seq desc, p.id desc) from page p), '[]'::jsonb),
         (select count(*) from filtered) > v_limit,
         (select jsonb_build_object('lastSeq', p.last_seq, 'id', p.id) from page p order by p.last_seq, p.id limit 1)
    into v_rows, v_more, v_next;
  return jsonb_build_object('ok', true, 'threads', v_rows, 'more', coalesce(v_more, false),
                            'before', case when coalesce(v_more, false) then v_next end);
end $$;

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
         and board_request_open(br.state)
    ) r on true
   where t.estate_id = p_estate_id;
  return jsonb_build_object('ok', true, 'threads', v_rows);
end $$;

create or replace function board_responders_json(p_estate uuid, p_project uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with caps as (
    select capability from board_responder_slots where estate_id = p_estate and project_id = p_project
    union select unnest(board_listed_capabilities(p_estate, p_project))
    union select capability from board_requests where estate_id = p_estate and target_project = p_project
                    and board_request_open(state)
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

-- ── 7 · the tick: answers what a target replied to, expires what has no deadline past its default age ──────────
create or replace function board_tick(p_estate_id uuid) returns jsonb
language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare r board_requests; ep board_epochs; v_answered integer := 0; v_expired integer := 0; v_rotated integer := 0; v_receipts integer := 0; v_outbox integer := 0;
        v_retired jsonb := '[]'::jsonb; v_cutoff timestamptz := clock_timestamp() - board_receipt_retention(); n integer;
        v_system jsonb := jsonb_build_object('kind', 'system', 'id', 'board');
begin
  if p_estate_id is null then return board_refusal('invalid_arguments', 'The tick names no estate.'); end if;
  -- (a0) BD-1: a queued request its target already replied to is answered. The reply's own command answers it at once
  --      (board_insert_message); this pass settles what was stored before that rule, and is idle after.
  for r in select q.* from board_requests q where q.estate_id = p_estate_id and q.state = 'queued'
             and exists (select 1 from board_messages m where m.estate_id = q.estate_id and m.reply_to = q.message_id
                           and m.sender_project = q.target_project and m.kind <> 'request')
             order by q.submitted_seq for update of q skip locked loop
    perform board_transition(p_estate_id, r.message_id, 'answer', 'answered', r.effect, 'target-reply', v_system);
    v_answered := v_answered + 1;
  end loop;
  -- (a) A deadline passed: queued and claimed requests expire. An accepted one is held (C4) — its responder
  --     said it would act, and only an outcome or a cancel ends it. BD-1: a request stored with no deadline (before
  --     this release every request could be) is given the default age from its message, so nothing stays queued for ever.
  for r in select q.* from board_requests q where q.estate_id = p_estate_id and q.state in ('queued', 'claimed')
             and coalesce(q.deadline, (select m.at + board_request_default_ttl() from board_messages m
                                         where m.estate_id = q.estate_id and m.id = q.message_id)) < clock_timestamp()
             order by q.submitted_seq for update of q skip locked loop
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
  return jsonb_build_object('ok', true, 'answered', v_answered, 'expired', v_expired, 'rotated', v_rotated, 'retired', jsonb_array_length(v_retired),
    'receipts_compacted', v_receipts, 'outbox_compacted', v_outbox);
end $$;

-- ── 6 · the doors ───────────────────────────────────────────────────────────────────────────────────────────
-- Helpers: no API role runs them, service_role included (R-003). Doors: service_role only.
revoke execute on function board_request_open(text), board_request_default_ttl(), apply_comms_reads_many(journal)
  from public, anon, authenticated, service_role;
revoke execute on function board_list_reader(uuid, uuid, uuid, bigint, integer, boolean, timestamptz), board_cursor_key(uuid),
  board_read_ack_many(uuid, uuid, jsonb, uuid[], uuid, uuid), board_responder_possible(uuid, uuid, text), board_waiting_operator(uuid)
  from public, anon, authenticated;
grant execute on function board_list_reader(uuid, uuid, uuid, bigint, integer, boolean, timestamptz), board_cursor_key(uuid),
  board_read_ack_many(uuid, uuid, jsonb, uuid[], uuid, uuid), board_responder_possible(uuid, uuid, text), board_waiting_operator(uuid)
  to service_role;

-- #endregion board-core-holds

-- ── schema 95 as a private-archive source ────────────────────────────────────────────────────────────────────────
-- Schema 95 adds no archive event shape, so an archive taken at 95 reads as one taken at 94 (the function of
-- migration 116, with 95 admitted).
-- #region private-archive-source-schema — docs: docs/adr/0079-private-conversation-archives-preserve-history-not-authority.md#decision
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb,'71'::jsonb,'72'::jsonb,'73'::jsonb,'74'::jsonb,'75'::jsonb,'76'::jsonb,'77'::jsonb,'78'::jsonb,'79'::jsonb,'80'::jsonb,'81'::jsonb,'82'::jsonb,'83'::jsonb,'84'::jsonb,'85'::jsonb,'86'::jsonb,'87'::jsonb,'88'::jsonb,'89'::jsonb,'90'::jsonb,'91'::jsonb,'92'::jsonb,'93'::jsonb,'94'::jsonb,'95'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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
  exception when check_violation then perform ceo_archive_fail('invalid_archive');
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
