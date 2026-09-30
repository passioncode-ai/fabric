-- First-slice plan B3-1 (ADR-0081, ADR-0073): an owned backend's own open and exit receipts.
--
-- A Codex or Claude backend that Fabric's registry owns is not a PTY: it writes no
-- terminal.opened@1 / terminal.closed@1. It gets its own two receipts, written by trusted main:
--   backend.opened@1  {session_id, owner_id, channel_epoch, process_ref, host_instance_id, boot_id}
--   backend.exited@1  the same identity plus exit_code, exit_signal (integers or null) and
--                     process_group: 'quiescent' | 'unknown'
-- Managed Stop accepts a backend exit only when it names the same owner, epoch, process, host and
-- boot as the open, and the process group was observed quiescent. `unknown` — for instance a
-- descendant that left the group, measured on codex-cli 0.157.1 (B2b-3) — is never a stop.
-- fail_task_launch counts either receipt as process evidence, so a launch with an owned backend
-- cannot be relabelled "never spawned" (closes the B1 gap).

insert into event_types (type, projects, note) values
  ('backend.opened@1', false, 'an owned backend process was spawned for a session; owner, epoch and process identity'),
  ('backend.exited@1', false, 'an owned backend process exited; its process group observation travels with it');

-- The session's backend receipts, or null when the session's process is not an owned backend.
-- Only the latest open after admission counts, and only an exit with that open's exact identity.
create function backend_exit_evidence(p_estate uuid,p_session uuid,p_after bigint) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare o journal; x journal; ident text[]:=array['owner_id','channel_epoch','process_ref','host_instance_id','boot_id']; k text;
begin
 select * into o from journal where estate_id=p_estate and type='backend.opened@1' and payload->>'session_id'=p_session::text
  and actor->>'kind' in ('system','person') and seq>p_after order by seq desc limit 1;
 if not found then return null; end if;
 foreach k in array ident loop
  if jsonb_typeof(o.payload->k) is distinct from 'string' or length(o.payload->>k)>256 or o.payload->>k !~ '^[A-Za-z0-9._:/-]+$' then
   -- A malformed open is still an owned backend: it can never be stopped by it, only reported unknown.
   return jsonb_build_object('openedSeq',o.seq,'exitedSeq',null,'processGroup','unknown');
  end if;
 end loop;
 select * into x from journal where estate_id=p_estate and type='backend.exited@1' and payload->>'session_id'=p_session::text
  and actor->>'kind' in ('system','person') and seq>o.seq
  and payload->>'owner_id'=o.payload->>'owner_id' and payload->>'channel_epoch'=o.payload->>'channel_epoch'
  and payload->>'process_ref'=o.payload->>'process_ref' and payload->>'host_instance_id'=o.payload->>'host_instance_id'
  and payload->>'boot_id'=o.payload->>'boot_id' order by seq desc limit 1;
 if not found then return jsonb_build_object('openedSeq',o.seq,'exitedSeq',null,'processGroup','unknown'); end if;
 return jsonb_build_object('openedSeq',o.seq,'exitedSeq',x.seq,
  'processGroup',case when x.payload->>'process_group'='quiescent' then 'quiescent' else 'unknown' end,
  'processRef',o.payload->>'process_ref','hostInstanceId',o.payload->>'host_instance_id','bootId',o.payload->>'boot_id');
end $$;
revoke all on function backend_exit_evidence(uuid,uuid,bigint) from public,anon,authenticated;

create or replace function record_task_run_stop_observation(p_estate_id uuid,p_run_id uuid,p_session_id uuid,p_command_id uuid,p_observation jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r task_runs; t project_tasks; held leases; s run_stop_commands; e journal; closed journal; k text; safe jsonb:='{}'; backend jsonb;
 complete boolean:=true; v_outcome text; ref text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text,4242));
 select * into s from run_stop_commands where estate_id=p_estate_id and task_run_id=p_run_id and session_id=p_session_id and command_id=p_command_id for update;
 if not found then return jsonb_build_object('recorded',false,'reason_code','unknown_command'); end if;
 if s.state='stopped' then return jsonb_build_object('recorded',true,'command_id',s.command_id,'task_run_id',p_run_id,'task_id',s.task_id,
  'session_id',p_session_id,'state','stopped','receipt_seq',s.verified_seq,'outcome',s.outcome,'reason',s.reason,'basis',s.basis,'repeated',true); end if;
 select * into r from task_runs where estate_id=p_estate_id and task_run_id=p_run_id for update;
 if not found or r.session_id is distinct from p_session_id or exists(select 1 from task_runs where estate_id=p_estate_id and task_id=r.task_id and run_ordinal>r.run_ordinal) then
  return jsonb_build_object('recorded',false,'reason_code','generation_changed'); end if;
 select * into held from leases where estate_id=p_estate_id and work_id=r.task_id for update;
 if not found or held.owner_session<>p_session_id then return jsonb_build_object('recorded',false,'reason_code','lease_changed'); end if;
 if jsonb_typeof(p_observation) is distinct from 'object' then return jsonb_build_object('recorded',false,'reason_code','invalid_observation'); end if;
 -- Whitelist typed observations and opaque references; do not persist arbitrary
 -- freeform output, process environment, credentials or extra caller fields.
 foreach k in array array['rootExited','processTreeQuiescent','providerQuiescent','authorityRevoked','transcriptCommitted'] loop
  if p_observation ? k and jsonb_typeof(p_observation->k)<>'boolean' then
   return jsonb_build_object('recorded',false,'reason_code','invalid_observation'); end if;
  complete:=complete and coalesce((p_observation->>k)::boolean,false);
  safe:=safe||jsonb_build_object(k,coalesce((p_observation->>k)::boolean,false));
 end loop;
 foreach k in array array['hostInstanceId','bootId','processIdentityRef','providerObservationRef','authorityRevocationRef','transcriptRef'] loop
  ref:=p_observation->>k;
  if p_observation ? k and (jsonb_typeof(p_observation->k)<>'string' or length(ref)>256 or ref !~ '^[A-Za-z0-9._:/-]+$') then
   return jsonb_build_object('recorded',false,'reason_code','invalid_evidence_ref'); end if;
  if coalesce(length(ref),0)=0 then complete:=false; else safe:=safe||jsonb_build_object(k,ref); end if;
 end loop;
 v_outcome:=p_observation->>'outcome';
 if v_outcome is null or v_outcome not in ('completed','failed_known','cancelled') then return jsonb_build_object('recorded',false,'reason_code','invalid_outcome'); end if;
 -- The first durable intent controls classification even after a lost reply.
 v_outcome:=case when s.reason in ('operator_stop','app_shutdown') then 'cancelled'
  when s.reason='launch_failure' then 'failed_known' else v_outcome end;
 safe:=safe||jsonb_build_object('outcome',v_outcome);
 -- A session whose process is an owned backend ends only by that backend's own exit receipt (B3);
 -- a view's terminal.closed@1 for it is never read as the backend's exit.
 backend:=backend_exit_evidence(p_estate_id,p_session_id,r.admitted_seq);
 if backend is not null then
  if backend->>'exitedSeq' is null or backend->>'processGroup'<>'quiescent'
   or backend->>'processRef' is distinct from safe->>'processIdentityRef'
   or backend->>'hostInstanceId' is distinct from safe->>'hostInstanceId'
   or backend->>'bootId' is distinct from safe->>'bootId' then complete:=false; end if;
  safe:=safe||jsonb_build_object('backendOpenedSeq',(backend->>'openedSeq')::bigint)
   ||case when backend->>'exitedSeq' is null then '{}'::jsonb else jsonb_build_object('backendExitedSeq',(backend->>'exitedSeq')::bigint,'backendProcessGroup',backend->>'processGroup') end;
 else
  select * into closed from journal where estate_id=p_estate_id and type='terminal.closed@1' and payload->>'session_id'=p_session_id::text
   and actor->>'kind' in ('system','person') and seq>r.admitted_seq order by seq desc limit 1;
  if not found then complete:=false; else safe:=safe||jsonb_build_object('terminalClosedSeq',closed.seq); end if;
 end if;
 if s.observation=safe and s.state='outcome_unknown' then return jsonb_build_object('recorded',true,'command_id',s.command_id,'task_run_id',p_run_id,'task_id',s.task_id,
  'session_id',p_session_id,'state','outcome_unknown','receipt_seq',s.observation_seq,'reason',s.reason,'basis',null,'repeated',true); end if;
 e:=append_event(p_estate_id,case when complete then 'run.stop_observed@1' else 'run.stop_unknown@1' end,
  '{"kind":"system","id":"managed-stop-observer"}',jsonb_build_object('task_run_id',p_run_id,'task_id',r.task_id,
  'session_id',p_session_id,'command_id',p_command_id,'basis',case when complete then 'observed' else null end,'evidence',safe),'1',r.project_id,p_run_id);
 update run_stop_commands set state=case when complete then 'stopped' else 'outcome_unknown' end,
  observation=safe,observation_seq=e.seq,verified_seq=case when complete then e.seq else null end,
  outcome=case when complete then v_outcome else null end,
  basis=case when complete then 'observed' else null end where command_id=p_command_id;
 if complete then
  if r.state<>'ended' then
   perform append_event(p_estate_id,'run.ended@1','{"kind":"system","id":"managed-stop-observer"}',
    jsonb_build_object('task_run_id',p_run_id,'task_id',r.task_id,'outcome',v_outcome,'stop_command_id',p_command_id),'1',r.project_id,p_run_id);
  end if;
  -- Runtime quiescence makes the work available again; it does not assert a
  -- successful result. Preserve a separately submitted review/terminal state.
  select * into t from project_tasks where estate_id=p_estate_id and id=r.task_id for update;
  if found and t.session_id=p_session_id and t.status='running' then
   perform append_event(p_estate_id,'task.moved@1','{"kind":"system","id":"managed-stop-observer"}',
    jsonb_build_object('task_id',r.task_id,'to','backlog','task_run_id',p_run_id,
      'stop_command_id',p_command_id,'reason','execution_stopped'),'1',r.project_id,p_run_id);
  end if;
  delete from leases where estate_id=p_estate_id and work_id=r.task_id and owner_session=p_session_id;
 end if;
 return jsonb_build_object('recorded',true,'command_id',p_command_id,'task_run_id',p_run_id,'task_id',r.task_id,
  'session_id',p_session_id,'state',case when complete then 'stopped' else 'outcome_unknown' end,
  'receipt_seq',e.seq,'outcome',case when complete then v_outcome else null end,'reason',s.reason,
  'basis',case when complete then 'observed' else null end,'repeated',false);
end $$;

create or replace function fail_task_launch(p_estate_id uuid,p_run_id uuid,p_session_id uuid,p_actor jsonb,p_process_started boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r task_runs; held leases; e journal; stop_receipt journal; s run_stop_commands;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text,4242));
 if coalesce(p_actor->>'kind','') not in ('person','system') then
  return jsonb_build_object('compensated',false,'reason_code','untrusted_actor'); end if;
 select * into r from task_runs where estate_id=p_estate_id and task_run_id=p_run_id for update;
 if not found then return jsonb_build_object('compensated',false,'reason_code','not_found'); end if;
 if p_process_started is null or r.session_id is distinct from p_session_id or exists(select 1 from task_runs where estate_id=p_estate_id and task_id=r.task_id and run_ordinal>r.run_ordinal) then
  return jsonb_build_object('compensated',false,'reason_code','generation_changed');
 end if;
 if r.state='ended' then
  if r.outcome='failed_known' and exists(select 1 from run_launch_compensations where estate_id=p_estate_id and task_run_id=p_run_id and session_id=p_session_id and receipt_seq=r.ended_seq) then
   return jsonb_build_object('compensated',true,'task_run_id',p_run_id,'session_id',p_session_id,'state','ended','outcome',r.outcome,'repeated',true);
  end if;
  return jsonb_build_object('compensated',false,'reason_code','ended','state','ended','outcome',r.outcome);
 end if;
 select * into held from leases where estate_id=p_estate_id and work_id=r.task_id for update;
 if not found or held.owner_session is distinct from p_session_id then return jsonb_build_object('compensated',false,'reason_code','lease_changed'); end if;
 if not p_process_started then
  select * into s from run_stop_commands where estate_id=p_estate_id and task_run_id=p_run_id and session_id=p_session_id for update;
  -- Absence of a terminal receipt is not proof by itself. This service-only
  -- command consumes the host's explicit no-process attestation for its exact
  -- begun generation; a stopped launch may be compensated before OS spawn.
  if (r.state <> 'launching' and not (r.state='ending' and s.command_id is not null and s.state<>'stopped'))
   or not exists(select 1 from journal where estate_id=p_estate_id and type='run.launching@1' and run_id=p_run_id)
   or exists(select 1 from journal where estate_id=p_estate_id and type='run.bound@1' and run_id=p_run_id)
   or exists(select 1 from journal where estate_id=p_estate_id and type in ('terminal.opened@1','terminal.closed@1','backend.opened@1','backend.exited@1') and payload->>'session_id'=p_session_id::text)
   or exists(select 1 from journal where estate_id=p_estate_id and type='run.launch_failed@1' and run_id=p_run_id and payload->>'process_started'='true') then
   return jsonb_build_object('compensated',false,'reason_code','process_evidence','state',r.state);
  end if;
  select * into e from append_event(p_estate_id,'run.ended@1',p_actor,jsonb_build_object('task_run_id',p_run_id,'task_id',r.task_id,'outcome','failed_known','launch_failure',true),'1',r.project_id,p_run_id);
  insert into run_launch_compensations(task_run_id,estate_id,session_id,receipt_seq) values(p_run_id,p_estate_id,p_session_id,e.seq);
  if s.command_id is not null then
   stop_receipt:=append_event(p_estate_id,'run.stop_observed@1','{"kind":"system","id":"managed-launch-compensator"}',
    jsonb_build_object('task_run_id',p_run_id,'task_id',r.task_id,'session_id',p_session_id,'command_id',s.command_id,
     'basis','never_spawned','evidence',jsonb_build_object('compensationSeq',e.seq)),'1',r.project_id,p_run_id);
   update run_stop_commands set state='stopped',basis='never_spawned',outcome='failed_known',
    observation=jsonb_build_object('basis','never_spawned','compensationSeq',e.seq),
    observation_seq=stop_receipt.seq,verified_seq=stop_receipt.seq where command_id=s.command_id;
  end if;
  delete from leases where estate_id=p_estate_id and work_id=r.task_id and owner_session=p_session_id;
  return jsonb_build_object('compensated',true,'task_run_id',p_run_id,'session_id',p_session_id,'state','ended','outcome','failed_known','repeated',false);
 end if;
 -- Preserve the host's positive process attestation even when Stop already
 -- moved the run to ending. A later false assertion must never erase it.
 if r.state='ending' and exists(select 1 from journal where estate_id=p_estate_id and type='run.launch_failed@1'
  and run_id=p_run_id and payload->>'process_started'='true') then
  return jsonb_build_object('compensated',true,'task_run_id',p_run_id,'session_id',p_session_id,'state','ending','repeated',true); end if;
 perform append_event(p_estate_id,'run.launch_failed@1',p_actor,jsonb_build_object('task_run_id',p_run_id,'task_id',r.task_id,'session_id',p_session_id,'process_started',true),'1',r.project_id,p_run_id);
 return jsonb_build_object('compensated',true,'task_run_id',p_run_id,'session_id',p_session_id,'state','ending','repeated',false);
end $$;

-- Schema 67 as a private-archive source (ADR-0079 decision 5: later schemas need explicit
-- qualification). Migration 67 changes no archived table; an ordinary journal from schema 67 may
-- carry the two backend receipt types, which only a schema that registers them can restore. An
-- export now names the schema it was taken from, 67; import accepts archives from 66 and 67 and
-- refuses any other source. The bodies below are migration 66's, changed only at those two points.
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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

  v_archive:=jsonb_build_object('schema','CeoPrivateArchive@1','archive_id',gen_random_uuid(),'source_schema_version',67,'owner_person_id',p_person_id,
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
