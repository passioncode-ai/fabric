-- 98 (by count; suffix 125): Fabric 0.3.13 holds the board's narrowed count for readers pinned before DEC-0135
-- (fabric-agent-contract DEC-0135 DR-4, board thread `7ef21793`, finding `6045afec`; Fabric's row CO-437).
--
-- NUMBERS. `schema_version()` counts applied migrations, so this file makes the schema 98. The task pipeline's prose
-- reservation held 125 and 126 unexecuted (`docs/evidence/plans/task-pipeline-persistence-contract.md`); this file takes
-- 125, the next free number, and by that document's collision rule the reservation moves to 126 and 127.
--
-- WHY. Migration 124 (CO-370) delivers a reply to the sender of the message it answers, and made `board_list_reader`
-- (com.list's `unread` and `read`) and `board_status` (com.status's count) read those deliveries. The contract lets the
-- board narrow that count only for a reader pinned at or after DEC-0135; every reader today is pinned before it (Fabric's
-- own pin `v0.1.0+2026-10-26.3`, the adapter's kits), and such a reader is answered as v0.3.12 answered it: every message
-- in its threads that its Project did not send counts, until a mark. Found by the contract before 0.3.13's tag.
--
-- WHAT THIS CHANGES (each a `create or replace` of the latest body, same signature, so its grants stand):
--   * `board_list_reader`: migration 120's `unread` and `read` (no delivery read), with 124's participation test.
--   * `board_status`: `unread` counts the messages of the reader's threads its Project did not send and has not marked;
--     the same set the deliveries held before 124 (every participant but the sender, migration 103), and still only a
--     message the board holds (migration 107's wave-2 fix 3).
--   * Migration 124's deliveries stay as they are: the mirror and the operator's surfaces (`board_pending_operator`,
--     `board_waiting_operator`) keep reading them. Staging the count by the reader's pin comes with Fabric's repin to
--     DEC-0135 (CO-437, 0.3.14 at the latest).
--   * Schema 98 as a private-archive source (ADR-0079 decision 5): no archive shape, read as 97.

-- #region board-reader-count-held — docs: docs/evidence/plans/2026-10-26-release-0313-verification.md#iteration-3
create or replace function board_list_reader(p_estate_id uuid, p_reader uuid, p_thread uuid, p_after_seq bigint, p_limit integer,
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
       -- DEC-0135 DR-4: a reader pinned before DEC-0135 counts every message its Project did not send, until a mark.
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

create or replace function board_status(p_estate_id uuid, p_reader uuid) returns jsonb
language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
begin
  if p_estate_id is null or p_reader is null then return board_refusal('invalid_arguments', 'The status request is not valid.'); end if;
  if not board_is_project(p_estate_id, p_reader) then return board_refusal('not_authorized', 'This Project may not read the board.'); end if;
  return jsonb_build_object('ok', true,
    -- DEC-0135 DR-4: the messages of the reader's threads its Project did not send and has not marked, as com.list's
    -- `unread` counts them; only a message the board holds (migration 107's wave-2 fix 3).
    'unread', (select count(*)::integer from board_messages m join board_threads t on t.id = m.thread_id and t.estate_id = m.estate_id
                where m.estate_id = p_estate_id and t.participants @> array[p_reader] and m.sender_project <> p_reader
                  and not exists (select 1 from board_read_marks r where r.estate_id = m.estate_id and r.reader_project = p_reader and r.message_id = m.id)),
    'epoch', board_current_epoch(p_estate_id, p_reader),
    'responders', board_responders_json(p_estate_id, p_reader));
end $$;
-- #endregion board-reader-count-held

-- ── schema 98 as a private-archive source ────────────────────────────────────────────────────────────────────────
-- Schema 98 adds no archive event shape, so an archive taken at 98 reads as one taken at 97 (migration 124's function,
-- with 98 admitted).
-- #region private-archive-source-schema — docs: docs/adr/0079-private-conversation-archives-preserve-history-not-authority.md#decision
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb,'71'::jsonb,'72'::jsonb,'73'::jsonb,'74'::jsonb,'75'::jsonb,'76'::jsonb,'77'::jsonb,'78'::jsonb,'79'::jsonb,'80'::jsonb,'81'::jsonb,'82'::jsonb,'83'::jsonb,'84'::jsonb,'85'::jsonb,'86'::jsonb,'87'::jsonb,'88'::jsonb,'89'::jsonb,'90'::jsonb,'91'::jsonb,'92'::jsonb,'93'::jsonb,'94'::jsonb,'95'::jsonb,'96'::jsonb,'97'::jsonb,'98'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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
