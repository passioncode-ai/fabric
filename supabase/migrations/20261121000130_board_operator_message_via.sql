-- 103 (by count; suffix 130): the operator's read of a thread says what each responder message is (contract DEC-0181).
--
-- NUMBERS. `schema_version()` counts applied migrations, so this file makes the schema 103.
--
-- WHAT. Every message a responder writes on a request's thread (`com.reply`, `com.progress`, `com.effect_begin`, the
-- checkpoint of `com.responder_replace`) is stored by `board_insert_fenced_message` with `kind: reply`; which command
-- wrote it is only in the journal (`comms.message_submitted@1`, `operation`). So a reader took a takeover's checkpoint
-- for an answer to the request. The contract's DEC-0181 (fabric-agent-contract 6ab4d03) names the optional field `via`
-- (`reply`, `progress`, `effect`, `checkpoint`) on a reply that names its request. `board_message_via` derives it from
-- the journal event of the message; `board_list_operator` (migration 94's function, nothing else changed) adds it to
-- each message it returns. A message whose event names no such command (written before migration 103's lifecycle, or a
-- plain reply of `board_submit`) carries no `via`, which the contract reads as an answer.
--
-- WHO GETS IT. Only the operator's door, which Fabric's own main process reads (Comms, the people.ask bridge) and which
-- is pinned to the contract at DEC-0181. `board_message_json`, which agents read through `com.list` and `com.get`, is
-- not changed: the contract gives `via` only to a reader pinned at DEC-0181 or later, and the board cannot read a
-- reader's pin (VIA-4; the same hold as migration 125 for `deliverTo`).
--
-- WHY THE ARCHIVE FUNCTION. Every schema step admits itself as a private-archive source (migration 127's rule): the
-- last function is migration 129's `ceo_private_archive_canonical` with 103 added to the admitted list, nothing else.
-- #region board-operator-message-via — docs: docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md#5-leases-fences-and-the-clock
create function board_message_via(m board_messages) returns text
language sql stable security definer set search_path = public as $$
  select case when m.kind = 'reply' and m.reply_to is not null then
    (select case j.payload->>'operation'
              when 'com.reply' then 'reply'
              when 'com.progress' then 'progress'
              when 'com.effect_begin' then 'effect'
              when 'com.responder_replace' then 'checkpoint'
            end
       from journal j
      where j.estate_id = m.estate_id and j.seq = m.seq and j.type = 'comms.message_submitted@1')
  end
$$;

create or replace function board_list_operator(p_estate_id uuid, p_thread uuid, p_after_seq bigint, p_limit integer) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100); v_rows jsonb; v_last bigint; v_more boolean;
begin
  if p_estate_id is null or p_after_seq is null or p_after_seq < 0 then
    return board_refusal('invalid_arguments', 'The page request is not valid.');
  end if;
  if p_thread is not null and not exists (select 1 from board_threads t where t.id = p_thread and t.estate_id = p_estate_id) then
    return board_refusal('not_found', 'That thread is not part of this estate.');
  end if;
  with page as (
    select m.id, m.seq from board_messages m
     where m.estate_id = p_estate_id and m.seq > p_after_seq
       and (p_thread is null or m.thread_id = p_thread)
     order by m.seq limit v_limit + 1),
  kept as (select id, seq from page order by seq limit v_limit)
  select coalesce((select jsonb_agg(board_message_json(bm) || jsonb_strip_nulls(jsonb_build_object('via', board_message_via(bm))) order by bm.seq)
                     from board_messages bm join kept k on k.id = bm.id), '[]'::jsonb),
         (select max(seq) from kept), (select count(*) from page) > v_limit
    into v_rows, v_last, v_more;
  return jsonb_build_object('ok', true, 'messages', v_rows, 'last_seq', coalesce(v_last, p_after_seq), 'more', coalesce(v_more, false));
end $$;

revoke execute on function board_message_via(board_messages) from public, anon, authenticated;
grant execute on function board_message_via(board_messages) to service_role;
-- #endregion board-operator-message-via

-- #region private-archive-source-schema — docs: docs/adr/0079-private-conversation-archives-preserve-history-not-authority.md#decision
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb,'71'::jsonb,'72'::jsonb,'73'::jsonb,'74'::jsonb,'75'::jsonb,'76'::jsonb,'77'::jsonb,'78'::jsonb,'79'::jsonb,'80'::jsonb,'81'::jsonb,'82'::jsonb,'83'::jsonb,'84'::jsonb,'85'::jsonb,'86'::jsonb,'87'::jsonb,'88'::jsonb,'89'::jsonb,'90'::jsonb,'91'::jsonb,'92'::jsonb,'93'::jsonb,'94'::jsonb,'95'::jsonb,'96'::jsonb,'97'::jsonb,'98'::jsonb,'99'::jsonb,'100'::jsonb,'101'::jsonb,'102'::jsonb,'103'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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
