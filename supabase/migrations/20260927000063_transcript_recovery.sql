-- HAR-R0: crash capture is evidence of text, never evidence of process ending.
-- PRE-RELEASE ROLLOUT BARRIER: stop writers, install upgraded readers offline,
-- apply schema, then start upgraded readers. See ADR-0073; no live rollout here.
-- Once @2 exists, an old-reader/schema rollback is unsafe. Preserve the journal;
-- fix forward or restore the entire pre-migration backup, never invent end times.
alter table session_transcripts alter column started_at drop not null;
alter table session_transcripts alter column ended_at drop not null;
alter table session_transcripts add column captured_at timestamptz;
alter table session_transcripts add column ending_provenance text not null default 'legacy'
 check (ending_provenance in ('legacy','observed','unknown'));
-- Only a matching journal receipt supplies the capture time. Orphans stay null.
-- Legacy provenance never infers that a historical endpoint was observed.
update session_transcripts s set captured_at=j.occurred_at
 from journal j where j.estate_id=s.estate_id and j.seq=s.seq
 and j.type='transcript.captured@1' and lower(j.payload->>'session_id')=s.session_id::text;
create index session_transcripts_capture_order on session_transcripts(estate_id,project_id,captured_at desc nulls last);
insert into event_types(type,projects,note) values
 ('transcript.captured@2',true,'A recovered capture, with an independently known or unknown ending. No runtime completion authority.');
create index transcript_recovery_session on journal((payload->>'session_id')) where type='transcript.captured@2';
create index transcript_recovery_command on journal((payload->>'command_id')) where type='transcript.captured@2';

-- Ephemeral, transaction-bound authorization for the SINGLE journal writer.
-- There is no public authorizer or table write grant, including service_role.
create table transcript_recovery_authorizations (
  transaction_id bigint not null,
  estate_id uuid not null,
  project_id uuid not null,
  payload jsonb not null,
  primary key(transaction_id,estate_id)
);
revoke all on transcript_recovery_authorizations from public,anon,authenticated,service_role;
alter table transcript_recovery_authorizations enable row level security;

-- Returns only a bounded reason code. No raw text is echoed by a refusal.
create function transcript_capture_error(p jsonb) returns text
language plpgsql immutable set search_path=public as $$
declare k text; start_time timestamptz; end_time timestamptz; n numeric;
begin
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>49000000 then return 'invalid_capture'; end if;
 if (select count(*) from jsonb_object_keys(p))<>14 or not p ?& array[
  'task_id','option_id','sha256','bytes','lines','truncated','annotation','excerpt','body',
  'capture_state','started_at','ended_at','exit_code','ending_provenance'] then return 'invalid_capture'; end if;
 foreach k in array array['option_id','sha256','annotation','excerpt','body','capture_state','ending_provenance'] loop
  if jsonb_typeof(p->k)<>'string' then return 'invalid_capture'; end if;
 end loop;
 if length(p->>'option_id') not between 1 and 256 or octet_length(p->>'annotation')>8192
  or octet_length(p->>'excerpt')>32768 or octet_length(p->>'body')>8000000 then return 'capture_too_large'; end if;
 if p->>'sha256' !~ '^[0-9a-f]{64}$' or p->>'sha256'<>encode(sha256(convert_to(p->>'body','UTF8')),'hex') then return 'digest_mismatch'; end if;
 if jsonb_typeof(p->'truncated')<>'boolean' or p->>'capture_state' not in ('captured','empty')
  or p->>'ending_provenance' not in ('observed','unknown') then return 'invalid_capture'; end if;
 foreach k in array array['bytes','lines'] loop
  if jsonb_typeof(p->k)<>'number' then return 'invalid_capture'; end if;
  n:=(p->>k)::numeric;
  if n<>trunc(n) or n<0 or n>8000001 then return 'invalid_capture'; end if;
 end loop;
 if (p->>'bytes')::int<>octet_length(p->>'body') then return 'size_mismatch'; end if;
 if p->'task_id'<>'null'::jsonb and (jsonb_typeof(p->'task_id')<>'string'
  or p->>'task_id' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') then return 'invalid_capture'; end if;
 foreach k in array array['started_at','ended_at'] loop
  if p->k<>'null'::jsonb then
   if jsonb_typeof(p->k)<>'string' or p->>k !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,6})?Z$'
    then return 'invalid_time'; end if;
   if not isfinite((p->>k)::timestamptz) then return 'invalid_time'; end if;
  end if;
 end loop;
 start_time:=(p->>'started_at')::timestamptz; end_time:=(p->>'ended_at')::timestamptz;
 if start_time is not null and end_time is not null and end_time<start_time then return 'invalid_time'; end if;
 if p->'exit_code'<>'null'::jsonb then
  if jsonb_typeof(p->'exit_code')<>'number' then return 'invalid_capture'; end if;
  n:=(p->>'exit_code')::numeric;
  if n<>trunc(n) or n< -2147483648 or n>2147483647 then return 'invalid_capture'; end if;
 end if;
 if p->>'ending_provenance'='unknown' then
  if end_time is not null or p->'exit_code'<>'null'::jsonb or p->>'capture_state'<>'captured'
   or p->'truncated'<>'true'::jsonb then return 'invalid_ending'; end if;
 elsif end_time is null then return 'invalid_ending'; end if;
 if p->>'capture_state'='empty' then
  if p->>'body'<>'' or (p->>'lines')::int<>0 or p->'truncated'<>'false'::jsonb
   or p->>'annotation'<>'' or p->>'excerpt'<>'' then return 'invalid_empty'; end if;
 else
  if p->>'body' !~ '[^[:space:]]' then return 'invalid_empty'; end if;
  -- TranscriptStore counts body.split('\n'), including a trailing empty line.
  if (p->>'lines')::int<>1+length(p->>'body')-length(replace(p->>'body',E'\n','')) then return 'lines_mismatch'; end if;
 end if;
 return null;
exception when invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range or invalid_text_representation then
 return 'invalid_capture';
end $$;
revoke all on function transcript_capture_error(jsonb) from public,anon,authenticated,service_role;

-- Pure projection: no operational authorization row is needed during replay or
-- restore. The ordinary writer separately refuses direct @2 appends.
create function apply_transcript_capture(e journal) returns void
language plpgsql security definer set search_path=public as $$
declare p jsonb; reason text;
begin
 if e.type='transcript.captured@1' then
  -- Extend the old projection without changing a single old endpoint/body.
  update session_transcripts set captured_at=e.occurred_at,ending_provenance='legacy'
   where estate_id=e.estate_id and session_id=(e.payload->>'session_id')::uuid and seq=e.seq;
  return;
 end if;
 if e.type<>'transcript.captured@2' then return; end if;
 p:=e.payload-array['session_id','command_id','payload_digest','captured_at'];
 reason:=transcript_capture_error(p);
 if reason is not null or (select count(*) from jsonb_object_keys(e.payload))<>18
  or e.actor<>jsonb_build_object('kind','system','id','transcript-recovery') or e.project_id is null
  or e.run_id is not null or e.node_id is not null
  -- Replay/restore bypass the command RPC: reject missing and JSON-null
  -- identities explicitly; a NULL regex result does not enter a PL/pgSQL IF.
  or e.schema_rev is distinct from '2'
  or jsonb_typeof(e.payload->'session_id') is distinct from 'string'
  or jsonb_typeof(e.payload->'command_id') is distinct from 'string'
  or e.payload->>'session_id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  or e.payload->>'command_id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  or e.payload->>'payload_digest' is distinct from encode(sha256(convert_to(p::text,'UTF8')),'hex')
  or (e.payload->>'captured_at')::timestamptz is distinct from e.occurred_at then
  raise exception 'Invalid recovered transcript event' using errcode='check_violation';
 end if;
 insert into session_transcripts(session_id,estate_id,project_id,task_id,option_id,sha256,bytes,lines,truncated,
  started_at,ended_at,exit_code,annotation,excerpt,body,seq,captured_at,ending_provenance)
 values((e.payload->>'session_id')::uuid,e.estate_id,e.project_id,(p->>'task_id')::uuid,p->>'option_id',p->>'sha256',
  (p->>'bytes')::int,(p->>'lines')::int,(p->>'truncated')::boolean,(p->>'started_at')::timestamptz,
  (p->>'ended_at')::timestamptz,(p->>'exit_code')::int,p->>'annotation',p->>'excerpt',p->>'body',e.seq,e.occurred_at,p->>'ending_provenance')
 on conflict(session_id) do update set sha256=excluded.sha256,bytes=excluded.bytes,lines=excluded.lines,
  truncated=excluded.truncated,started_at=excluded.started_at,ended_at=excluded.ended_at,exit_code=excluded.exit_code,
  annotation=excluded.annotation,excerpt=excluded.excerpt,body=excluded.body,seq=excluded.seq,
  captured_at=excluded.captured_at,ending_provenance=excluded.ending_provenance
 where session_transcripts.estate_id=e.estate_id and session_transcripts.project_id=e.project_id
  and session_transcripts.task_id is not distinct from excluded.task_id and session_transcripts.option_id=excluded.option_id
  and session_transcripts.seq<=e.seq and (session_transcripts.ending_provenance='unknown' or session_transcripts.seq=e.seq);
end $$;
revoke all on function apply_transcript_capture(journal) from public,anon,authenticated,service_role;

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
  perform apply_deliveries(e);
  perform apply_task_runs(e);
  perform apply_transcript_capture(e);
end;
$$;

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
security definer set search_path = public
as $$
declare
  v_seq bigint;
  v_event journal;
begin
  if p_type='transcript.captured@2' and not exists (
    select 1 from transcript_recovery_authorizations a where a.transaction_id=txid_current()
      and a.estate_id=p_estate_id and a.project_id=p_project_id and a.payload=p_payload
      and p_actor=jsonb_build_object('kind','system','id','transcript-recovery')
      and p_run_id is null and p_node_id is null and p_schema_rev='2'
  ) then raise exception 'Use recover_transcript for recovered captures' using errcode='insufficient_privilege'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text, 4242));
  select coalesce(max(seq), 0) + 1 into v_seq from journal where estate_id = p_estate_id;
  insert into journal (estate_id, seq, type, schema_rev, actor, project_id, run_id, node_id, payload)
  values (p_estate_id, v_seq, p_type, p_schema_rev, p_actor, p_project_id, p_run_id, p_node_id, p_payload)
  returning * into v_event;
  perform apply_projections(v_event);
  return v_event;
end $$;

create function transcript_recovery_receipt(e journal, repeated boolean) returns jsonb
language sql immutable set search_path=public as $$
 select jsonb_build_object('recorded',true,'repeated',repeated,'estate_id',e.estate_id,'project_id',e.project_id,
  'session_id',e.payload->'session_id','command_id',e.payload->'command_id','receipt_seq',e.seq,'event_type',e.type,
  'payload_digest',e.payload->'payload_digest','sha256',e.payload->'sha256','capture_state',e.payload->'capture_state',
  'ending_provenance',e.payload->'ending_provenance','captured_at',e.payload->'captured_at',
  'started_at',e.payload->'started_at','ended_at',e.payload->'ended_at','exit_code',e.payload->'exit_code',
  'task_id',e.payload->'task_id','option_id',e.payload->'option_id','bytes',e.payload->'bytes',
  'lines',e.payload->'lines','truncated',e.payload->'truncated',
  'annotation',e.payload->'annotation','excerpt',e.payload->'excerpt');
$$;
revoke all on function transcript_recovery_receipt(journal,boolean) from public,anon,authenticated,service_role;

-- Same session + identical capture may be retried with a fresh command UUID;
-- the ORIGINAL command_id/receipt is returned. Any changed intent is refused.
-- The receipt acknowledges stored text only, never stopped execution.
create function recover_transcript(p_estate_id uuid,p_project_id uuid,p_session_id uuid,p_command_id uuid,p_capture jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare reason text; digest text; old_event journal; e journal; v_payload jsonb; task uuid; now_capture timestamptz;
begin
 if p_estate_id is null or p_project_id is null or p_session_id is null or p_command_id is null then
  return jsonb_build_object('recorded',false,'reason_code','invalid_identity'); end if;
 reason:=transcript_capture_error(p_capture);
 if reason is not null then return jsonb_build_object('recorded',false,'reason_code',reason); end if;
 task:=(p_capture->>'task_id')::uuid;
 digest:=encode(sha256(convert_to(p_capture::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text,4242));
 -- Same global session fence as managed launch; command lock also prevents a
 -- cross-Estate same-command race involving two different session identities.
 perform pg_advisory_xact_lock(hashtextextended(p_session_id::text,6061));
 perform pg_advisory_xact_lock(hashtextextended(p_command_id::text,6063));
 select * into old_event from journal where type='transcript.captured@2' and payload->>'command_id'=p_command_id::text limit 1;
 if found then
  if old_event.estate_id<>p_estate_id or old_event.project_id<>p_project_id
   or old_event.payload->>'session_id'<>p_session_id::text or old_event.payload->>'payload_digest'<>digest then
   return jsonb_build_object('recorded',false,'reason_code','command_conflict'); end if;
  return transcript_recovery_receipt(old_event,true);
 end if;
 select * into old_event from journal where type='transcript.captured@2' and payload->>'session_id'=p_session_id::text limit 1;
 if found then
  if old_event.estate_id<>p_estate_id or old_event.project_id<>p_project_id or old_event.payload->>'payload_digest'<>digest then
   return jsonb_build_object('recorded',false,'reason_code','session_conflict'); end if;
  return transcript_recovery_receipt(old_event,true);
 end if;
 if not exists(select 1 from projects where estate_id=p_estate_id and id=p_project_id) then
  return jsonb_build_object('recorded',false,'reason_code','project_not_found'); end if;
 -- Existing stronger/legacy evidence is not replaced, even when its body hash
 -- happens to match. A body hash does not establish identical exit provenance.
 if exists(select 1 from session_transcripts where session_id=p_session_id)
  or exists(select 1 from journal where type='transcript.captured@1' and lower(payload->>'session_id')=p_session_id::text) then
  return jsonb_build_object('recorded',false,'reason_code','existing_capture'); end if;
 -- A local spool and UUID alone cannot create a session or relocate its scope.
 if not exists(select 1 from journal where estate_id=p_estate_id and project_id=p_project_id and type='terminal.opened@1'
  and lower(payload->>'session_id')=p_session_id::text and payload->>'option_id'=p_capture->>'option_id'
  and actor->>'kind' in ('system','person')) then
  return jsonb_build_object('recorded',false,'reason_code','session_not_found'); end if;
 if exists(select 1 from journal where type='terminal.opened@1' and lower(payload->>'session_id')=p_session_id::text
  and (estate_id<>p_estate_id or project_id is distinct from p_project_id or payload->>'option_id' is distinct from p_capture->>'option_id')) then
  return jsonb_build_object('recorded',false,'reason_code','session_conflict'); end if;
 -- Historical binding remains valid after the task moves to a NEW session.
 -- Any conflicting binding is a refusal, including an omitted task identity.
 if exists(select 1 from journal j where j.type in ('task.created@1','task.session.attached@1','run.started@1','run.bound@1')
  and lower(j.payload->>'session_id')=p_session_id::text
  and (j.estate_id<>p_estate_id or j.project_id is distinct from p_project_id
   or lower(case when j.type in ('task.created@1','task.session.attached@1') then j.payload->>'id' else j.payload->>'task_id' end)
     is distinct from task::text)) then
  return jsonb_build_object('recorded',false,'reason_code','task_conflict'); end if;
 if task is not null and (not exists(select 1 from project_tasks where estate_id=p_estate_id and project_id=p_project_id and id=task)
  or not exists(select 1 from journal j where j.estate_id=p_estate_id and j.project_id=p_project_id
   and j.type in ('task.created@1','task.session.attached@1','run.started@1','run.bound@1')
   and lower(j.payload->>'session_id')=p_session_id::text
   and lower(case when j.type in ('task.created@1','task.session.attached@1') then j.payload->>'id' else j.payload->>'task_id' end)=task::text)) then
  return jsonb_build_object('recorded',false,'reason_code','task_not_bound'); end if;
 -- append_event uses now() too: capture time is a durable observation timestamp,
 -- separate from nullable process end time and stable on lost-reply retry.
 now_capture:=now();
 v_payload:=p_capture||jsonb_build_object('session_id',p_session_id,'command_id',p_command_id,'payload_digest',digest,'captured_at',now_capture);
 insert into transcript_recovery_authorizations(transaction_id,estate_id,project_id,payload)
 values(txid_current(),p_estate_id,p_project_id,v_payload);
 e:=append_event(p_estate_id,'transcript.captured@2','{"kind":"system","id":"transcript-recovery"}',v_payload,'2',p_project_id);
 delete from transcript_recovery_authorizations where transaction_id=txid_current() and estate_id=p_estate_id;
 if not exists(select 1 from session_transcripts where estate_id=p_estate_id and project_id=p_project_id
  and session_id=p_session_id and seq=e.seq and sha256=p_capture->>'sha256') then
  raise exception 'Recovered capture did not project' using errcode='check_violation'; end if;
 return transcript_recovery_receipt(e,false);
end $$;
revoke all on function recover_transcript(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function recover_transcript(uuid,uuid,uuid,uuid,jsonb) to service_role;
