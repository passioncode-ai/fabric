-- 89 (by count; suffix 108) — the operator's reads of the project board, wave 4 of
-- `docs/evidence/plans/2026-10-04-project-communications.md` (COM-07 and COM-05), decided in ADR-0156 §8 and SCN-143's
-- wave-4 amendment, SCN-147, SCN-156 and SCN-157; contract DEC-0081 for `settledBy` (fabric-agent-contract a59d04b,
-- pinned by the same change).
--
-- NUMBERS. `schema_version()` counts applied migrations, so this file makes the schema 89. Suffix 109 is wave 4's
-- controls migration (ADR-0156); suffixes 110/111 are the task pipeline's prose reservation
-- (`docs/evidence/plans/task-pipeline-persistence-contract.md`).
--
-- WHAT THIS ADDS (no table, no event type; one partial index on the journal):
--   * `board_responders_operator` (replaced, same signature): an absent slot says why its last holder left and when
--     (`releasedCause`, `releasedAt`); a null estate is refused. Stale stays its own state: a lapsed lease says nothing
--     about success or failure.
--   * `board_thread_page_operator`: the thread list as a bounded page, newest activity first, keyset (lastSeq, id), its
--     filters applied here — project, kind held, open request, active since, and the coding agent (`provider`, the
--     enrollments that took part in the thread's requests). It replaces reading every thread at once
--     (`board_threads_operator`, which stays for one release behind the deprecated `comms:threads`).
--   * `board_thread_heads_operator`: each thread's id and last seq only, newest first, capped (default 5,000, at most
--     10,000), saying when the cap cut it — the rail's unread count and "mark all read".
--   * `board_message_facts_operator`: for at most 100 messages, which participants marked each read (never the
--     sender), and for the requests among them the generation, whether an attempt is live, the last transition and
--     what the request ended with — an outcome told apart from a cancel reason by the journal's op at the outcome's seq.
--   * `board_request_timeline_operator`: a request's transitions from the journal, oldest first, at most 200.
--   * `board_related_threads_operator`: at most 20 threads between the same projects or carrying a file with the same
--     stated hash.
--   * `board_search_operator`: history search over message bodies, newest first, at most 50 a page; `%`, `_` and `\`
--     are searched as themselves; a removed body has no words to match; a time budget (`board_search_budget`, 2 s)
--     stops a long search and says so (`stoppedEarly`). The budget is a clock check inside the loop, not
--     `statement_timeout`: PostgreSQL arms that timer per client statement, so a function's own `set
--     statement_timeout` does not bound the statement already running it.
--   * `board_pending_operator` (COM05-01): per recipient project, what was delivered to it, the board holds and none of
--     its agents marked read — counts, the oldest, findings, requests and requests nobody answers.
--   * `board_complete`, `board_reconcile` (replaced, same signatures): their journal transitions carry
--     `settled_by: "responder"` (contract FAC-SEM-109, DEC-0081: every complete and reconcile record names who settled
--     the request). Nothing else in either changes. Events written before schema 89 carry none; no released build
--     serves the board (0.3.5 does not), so only development databases hold such events.
--   * `ceo_private_archive_canonical`: schema 89 imports as a private-archive source (ADR-0079 decision 5).
--
-- AUTHORITY. Every read is a security-definer door for the service role only — the host's main process, which reads
-- for the operator's screen — revoked from public, anon and authenticated, like migration 83's. Every one refuses a
-- null estate and qualifies every predicate by the estate, so no read answers another estate's rows.
--
-- #region project-board-operator-reads — docs: docs/adr/0156-the-estates-owner-may-pause-the-project-board-and-list-or-unlist-projects.md#8-what-comms-shows-besides

-- A request's transitions, looked up by request (the timeline, the facts' last step): the same pattern as migration
-- 72's journal lookup indexes.
create index board_transitions_by_request on journal (estate_id, (payload->>'request_id')) where type = 'comms.request_transitioned@1';

-- ── 1 · who answers ─────────────────────────────────────────────────────────────────────────────────────────
create or replace function board_responders_operator(p_estate uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if p_estate is null then return board_refusal('invalid_arguments', 'The responders request is not valid.'); end if;
  return jsonb_build_object('ok', true, 'responders', coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'project', s.project_id, 'capability', s.capability, 'state', board_responder_state(s), 'generation', s.generation,
             'leaseExpiresAt', case when s.holder_enrollment is not null then board_at(s.lease_until) end,
             'agent', e.agent, 'cameIn', e.came_in, 'label', e.principal->>'label',
             'since', (select board_at(j.occurred_at) from journal j where j.estate_id = s.estate_id and j.seq = e.enrolled_seq),
             -- Why the slot is empty and since when: the last released enrollment of this (project, capability).
             'releasedCause', case when s.holder_enrollment is null then last.released_cause end,
             'releasedAt', case when s.holder_enrollment is null
                                then (select board_at(j.occurred_at) from journal j where j.estate_id = s.estate_id and j.seq = last.released_seq) end))
           order by s.project_id, s.capability)
      from board_responder_slots s
      left join board_enrollments e on e.estate_id = s.estate_id and e.id = s.holder_enrollment
      left join lateral (
        select x.released_cause, x.released_seq from board_enrollments x
         where x.estate_id = s.estate_id and x.project_id = s.project_id and x.capability = s.capability and x.released_seq is not null
         order by x.released_seq desc limit 1
      ) last on true
     where s.estate_id = p_estate), '[]'::jsonb));
end $$;

-- ── 2 · the thread list: a bounded page and the heads ───────────────────────────────────────────────────────
create function board_thread_page_operator(p_estate uuid, p_filter jsonb, p_before jsonb, p_limit integer) returns jsonb
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
           and br.state not in ('completed', 'failed_known', 'cancelled', 'expired')
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

create function board_thread_heads_operator(p_estate uuid, p_limit integer default 5000) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_limit integer := least(greatest(coalesce(p_limit, 5000), 1), 10000); v_heads jsonb; v_total bigint;
begin
  if p_estate is null then return board_refusal('invalid_arguments', 'The heads request is not valid.'); end if;
  with heads as (
    select t.id, coalesce((select max(m.seq) from board_messages m where m.estate_id = t.estate_id and m.thread_id = t.id), 0) as last_seq
      from board_threads t where t.estate_id = p_estate
  ), top as (select * from heads order by last_seq desc, id desc limit v_limit + 1)
  select coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'lastSeq', x.last_seq) order by x.last_seq desc, x.id desc)
                     from (select * from top order by last_seq desc, id desc limit v_limit) x), '[]'::jsonb),
         (select count(*) from top)
    into v_heads, v_total;
  return jsonb_build_object('ok', true, 'heads', v_heads, 'truncated', v_total > v_limit);
end $$;

-- ── 3 · facts about messages and requests ──────────────────────────────────────────────────────────────────
create function board_message_facts_operator(p_estate uuid, p_messages uuid[]) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_messages jsonb; v_requests jsonb;
begin
  if p_estate is null or p_messages is null or cardinality(p_messages) > 100 or array_position(p_messages, null) is not null then
    return board_refusal('invalid_arguments', 'Ask for the facts of at most 100 messages.');
  end if;
  select coalesce(jsonb_object_agg(m.id, jsonb_build_object('readBy', coalesce((
           select jsonb_agg(rm.reader_project order by rm.reader_project)
             from board_read_marks rm
            where rm.estate_id = m.estate_id and rm.message_id = m.id and rm.reader_project <> m.sender_project), '[]'::jsonb))), '{}'::jsonb)
    into v_messages
    from board_messages m where m.estate_id = p_estate and m.id = any (p_messages);
  select coalesce(jsonb_object_agg(r.message_id, jsonb_strip_nulls(jsonb_build_object(
           'generation', r.generation,
           'attemptLive', exists (select 1 from board_attempts a where a.estate_id = r.estate_id and a.request_id = r.message_id and a.ended_seq is null),
           'lastOp', case when j.type = 'comms.request_transitioned@1' then j.payload->>'op' end,
           'lastCause', case when j.type = 'comms.request_transitioned@1' then j.payload->>'cause' end,
           'lastAt', case when j.type = 'comms.request_transitioned@1' then board_at(j.occurred_at) end,
           -- What it ended with: the journal's op at the outcome's seq tells a responder's (or, later, the owner's)
           -- outcome from the requester's cancel reason. An op this build does not know gives no kind.
           'outcomes', coalesce((
             select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                      'kind', case oj.payload->>'op' when 'cancel' then 'cancel_reason' when 'complete' then 'outcome' when 'reconcile' then 'outcome' end,
                      'summary', o.summary, 'evidence', o.evidence, 'at', board_at(oj.occurred_at),
                      'settledBy', oj.payload->>'settled_by')) order by o.seq)
               from board_outcomes o
               left join journal oj on oj.estate_id = o.estate_id and oj.seq = o.seq
              where o.estate_id = r.estate_id and o.request_id = r.message_id), '[]'::jsonb)))), '{}'::jsonb)
    into v_requests
    from board_requests r
    left join journal j on j.estate_id = r.estate_id and j.seq = r.updated_seq
   where r.estate_id = p_estate and r.message_id = any (p_messages);
  return jsonb_build_object('ok', true, 'messages', v_messages, 'requests', v_requests);
end $$;

create function board_request_timeline_operator(p_estate uuid, p_request uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_steps jsonb; v_total bigint;
begin
  if p_estate is null or p_request is null then return board_refusal('invalid_arguments', 'Name the request.'); end if;
  if not exists (select 1 from board_requests r where r.estate_id = p_estate and r.message_id = p_request) then
    return board_refusal('not_found', 'That request is not part of this estate.');
  end if;
  with steps as (
    select j.seq, j.occurred_at, j.payload from journal j
     where j.estate_id = p_estate and j.type = 'comms.request_transitioned@1' and j.payload->>'request_id' = p_request::text
     order by j.seq limit 201
  )
  select coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'op', x.payload->>'op', 'from', x.payload->>'from', 'to', x.payload->>'to',
           'effectFrom', x.payload->>'effect_from', 'effectTo', x.payload->>'effect_to', 'cause', x.payload->>'cause',
           'generation', case when jsonb_typeof(x.payload->'generation') = 'number' then x.payload->'generation' end,
           'settledBy', x.payload->>'settled_by', 'at', board_at(x.occurred_at))) order by x.seq)
           from (select * from steps order by seq limit 200) x), '[]'::jsonb),
         (select count(*) from steps)
    into v_steps, v_total;
  return jsonb_build_object('ok', true, 'steps', v_steps, 'more', v_total > 200);
end $$;

create function board_related_threads_operator(p_estate uuid, p_thread uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_parts uuid[]; v_rows jsonb; v_total bigint;
begin
  if p_estate is null or p_thread is null then return board_refusal('invalid_arguments', 'Name the thread.'); end if;
  select participants into v_parts from board_threads where estate_id = p_estate and id = p_thread;
  if not found then return board_refusal('not_found', 'That thread is not part of this estate.'); end if;
  with hashes as (
    select distinct a->>'contentHash' as h
      from board_messages m cross join lateral jsonb_array_elements(m.artifacts) a
     where m.estate_id = p_estate and m.thread_id = p_thread and jsonb_typeof(a) = 'object' and a ? 'contentHash'
  ), shared as (
    select distinct m.thread_id as id
      from board_messages m cross join lateral jsonb_array_elements(m.artifacts) a
     where m.estate_id = p_estate and m.thread_id <> p_thread and jsonb_typeof(a) = 'object'
       and a->>'contentHash' in (select h from hashes)
  ), same as (
    select o.id from board_threads o
     where o.estate_id = p_estate and o.id <> p_thread and o.participants @> v_parts and o.participants <@ v_parts
  ), candidates as (
    select id, 'shared-artifact' as why from shared
    union all
    select id, 'same-projects' from same where id not in (select id from shared)
  ), related as (
    -- With what opens it when the list does not hold it: its participants, first seq and last seq.
    select c.id, o.subject, c.why, o.participants, o.created_seq,
           (select max(m.at) from board_messages m where m.estate_id = p_estate and m.thread_id = c.id) as last_at,
           coalesce((select max(m.seq) from board_messages m where m.estate_id = p_estate and m.thread_id = c.id), 0) as last_seq
      from candidates c join board_threads o on o.estate_id = p_estate and o.id = c.id
  )
  select coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'subject', x.subject, 'why', x.why,
                                                       'lastAt', case when x.last_at is not null then board_at(x.last_at) end,
                                                       'participants', x.participants, 'createdSeq', x.created_seq, 'lastSeq', x.last_seq)
                                    order by x.last_at desc nulls last, x.id)
                     from (select * from related order by last_at desc nulls last, id limit 20) x), '[]'::jsonb),
         (select count(*) from related)
    into v_rows, v_total;
  return jsonb_build_object('ok', true, 'threads', v_rows, 'more', v_total > 20);
end $$;

-- ── 4 · history search ──────────────────────────────────────────────────────────────────────────────────────
-- How long one search may read before it stops and says so. A function so a test can plant a zero budget.
create function board_search_budget() returns interval language sql stable set search_path = public as $$ select interval '2 seconds' $$;

create function board_search_operator(p_estate uuid, p_query text, p_before_seq bigint, p_limit integer) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 50); v_pattern text; v_needle text;
        v_start timestamptz := clock_timestamp(); v_budget interval := board_search_budget();
        v_hits jsonb := '[]'::jsonb; v_n integer := 0; v_more boolean := false; v_stopped boolean := false; v_last bigint;
        v_pos integer; x record;
begin
  if p_estate is null or p_query is null or char_length(p_query) not between 2 and 200 or (p_before_seq is not null and p_before_seq < 1) then
    return board_refusal('invalid_arguments', 'Search for 2 to 200 characters.');
  end if;
  -- The words are searched as themselves: the LIKE metacharacters and the escape are escaped.
  v_pattern := '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_needle := lower(p_query);
  -- Newest first through (estate, seq); a removed body has no row here, so it never matches.
  for x in select m.id, m.thread_id, m.seq, m.at, m.sender_project, b.text, t.subject, t.participants, t.created_seq
             from board_messages m join board_bodies b on b.estate_id = m.estate_id and b.message_id = m.id
             join board_threads t on t.estate_id = m.estate_id and t.id = m.thread_id
            where m.estate_id = p_estate and (p_before_seq is null or m.seq < p_before_seq)
            order by m.seq desc loop
    if clock_timestamp() - v_start > v_budget then v_stopped := true; exit; end if;
    continue when not (x.text ilike v_pattern escape '\');
    if v_n = v_limit then v_more := true; exit; end if;
    v_pos := strpos(lower(x.text), v_needle);
    v_hits := v_hits || jsonb_build_array(jsonb_build_object('message', x.id, 'thread', x.thread_id, 'seq', x.seq, 'at', board_at(x.at),
      'sender', x.sender_project, 'snippet', substr(x.text, greatest(1, v_pos - 60), 200),
      -- Its thread, so the screen opens it there even when its list does not hold the thread.
      'subject', x.subject, 'participants', x.participants, 'createdSeq', x.created_seq));
    v_n := v_n + 1;
    v_last := x.seq;
  end loop;
  return jsonb_build_object('ok', true, 'hits', v_hits, 'more', v_more, 'stoppedEarly', v_stopped,
                            'before', case when v_more then v_last end);
end $$;

-- ── 5 · what waits for a project (COM05-01) ─────────────────────────────────────────────────────────────────
create function board_pending_operator(p_estate uuid, p_limit integer) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 100); v_rows jsonb; v_total bigint;
begin
  if p_estate is null then return board_refusal('invalid_arguments', 'The pending request is not valid.'); end if;
  with waiting as (
    -- Delivered, held by the board (migration 88's predicate: a delivery whose message the board holds), and not
    -- marked read by the recipient.
    select d.recipient_project, d.is_request, m.kind, m.at, br.state, br.target_project, br.capability
      from board_deliveries d
      join board_messages m on m.estate_id = d.estate_id and m.id = d.message_id
      left join board_requests br on br.estate_id = d.estate_id and br.message_id = d.message_id
     where d.estate_id = p_estate
       and not exists (select 1 from board_read_marks r where r.estate_id = d.estate_id and r.reader_project = d.recipient_project and r.message_id = d.message_id)
  ), per as (
    select w.recipient_project as project, count(*) as unread, min(w.at) as oldest_at,
           count(*) filter (where w.kind = 'finding') as findings,
           count(*) filter (where w.is_request) as requests,
           -- An open request addressed to this project whose slot no responder holds.
           count(*) filter (where w.is_request and w.target_project = w.recipient_project
                              and w.state not in ('completed', 'failed_known', 'cancelled', 'expired')
                              and not exists (select 1 from board_responder_slots s
                                               where s.estate_id = p_estate and s.project_id = w.target_project and s.capability = w.capability
                                                 and s.holder_enrollment is not null)) as absent
      from waiting w group by w.recipient_project
  )
  select coalesce((select jsonb_agg(jsonb_build_object('project', x.project, 'unread', x.unread, 'oldestAt', board_at(x.oldest_at),
                                                       'findings', x.findings, 'requests', x.requests, 'requestsWithAbsentResponder', x.absent)
                                    order by x.oldest_at, x.project)
                     from (select * from per order by oldest_at, project limit v_limit) x), '[]'::jsonb),
         (select count(*) from per)
    into v_rows, v_total;
  return jsonb_build_object('ok', true, 'projects', v_rows, 'more', v_total > v_limit);
end $$;

-- ── 6 · who settled it (contract DEC-0081, FAC-SEM-109) ─────────────────────────────────────────────────────
-- Migration 87's `com.complete` and `com.reconcile`, unchanged but for one member of their journal transition:
-- `settled_by: "responder"`. The estate owner's settlement (wave 4's W4-13) will write "owner"; until it lands no other
-- caller reaches either function.
create or replace function board_complete(p_estate uuid, p_holder jsonb, p_project uuid, p_args jsonb, p_digest text)
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
    board_fence_extra(c) || jsonb_build_object('observed', (o->>'observed')::boolean, 'outcome', board_outcome_payload(o),
      'settled_by', 'responder'));
  if o ? 'summary' or jsonb_array_length(coalesce(o->'evidence', '[]'::jsonb)) > 0 then
    insert into board_outcomes (estate_id, request_id, attempt_id, summary, evidence, seq)
    values (p_estate, (c->>'request')::uuid, (c->>'attempt')::uuid, o->>'summary', coalesce(o->'evidence', '[]'::jsonb), (v_done->>'seq')::bigint);
  end if;
  v_receipt := jsonb_build_object('ok', true, 'repeated', false, 'request', v_done->'request');
  perform board_store_receipt(p_estate, p_project, 'complete', (f->'idempotency'->>'epoch')::integer, f->'idempotency'->>'key', p_digest, v_receipt);
  return v_receipt;
end $$;

create or replace function board_reconcile(p_estate uuid, p_holder jsonb, p_project uuid, p_args jsonb, p_digest text)
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
      'outcome', board_outcome_payload(o), 'settled_by', 'responder'));
  if o ? 'summary' or jsonb_array_length(coalesce(o->'evidence', '[]'::jsonb)) > 0 then
    insert into board_outcomes (estate_id, request_id, attempt_id, summary, evidence, seq)
    values (p_estate, r.message_id, null, o->>'summary', coalesce(o->'evidence', '[]'::jsonb), (v_done->>'seq')::bigint);
  end if;
  update board_responder_slots set lease_until = board_lease_until() where estate_id = p_estate and project_id = p_project and capability = r.capability;
  v_receipt := jsonb_build_object('ok', true, 'repeated', false, 'request', v_done->'request');
  perform board_store_receipt(p_estate, p_project, 'reconcile', v_epoch, v_key, p_digest, v_receipt);
  return v_receipt;
end $$;

revoke execute on function board_search_budget() from public, anon, authenticated, service_role;
revoke execute on function board_thread_page_operator(uuid, jsonb, jsonb, integer), board_thread_heads_operator(uuid, integer),
  board_message_facts_operator(uuid, uuid[]), board_request_timeline_operator(uuid, uuid), board_related_threads_operator(uuid, uuid),
  board_search_operator(uuid, text, bigint, integer), board_pending_operator(uuid, integer)
  from public, anon, authenticated;
grant execute on function board_thread_page_operator(uuid, jsonb, jsonb, integer), board_thread_heads_operator(uuid, integer),
  board_message_facts_operator(uuid, uuid[]), board_request_timeline_operator(uuid, uuid), board_related_threads_operator(uuid, uuid),
  board_search_operator(uuid, text, bigint, integer), board_pending_operator(uuid, integer)
  to service_role;

-- #endregion project-board-operator-reads

-- ── schema 89 as a private-archive source ─────────────────────────────────────────────────────────────────────
-- ADR-0079 decision 5, as every step since 67 did: an archive exported at this schema imports. Migration 88's
-- canonical body with 89 added. Nothing else changes.
-- #region private-archive-source-schema — docs: docs/adr/0079-private-conversation-archives-preserve-history-not-authority.md#decision
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb,'71'::jsonb,'72'::jsonb,'73'::jsonb,'74'::jsonb,'75'::jsonb,'76'::jsonb,'77'::jsonb,'78'::jsonb,'79'::jsonb,'80'::jsonb,'81'::jsonb,'82'::jsonb,'83'::jsonb,'84'::jsonb,'85'::jsonb,'86'::jsonb,'87'::jsonb,'88'::jsonb,'89'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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
