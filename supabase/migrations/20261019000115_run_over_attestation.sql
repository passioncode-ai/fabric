-- CO-327, ADR-0170: the person's «работа закончена» for a run whose Stop has an unknown outcome.
--
-- A Stop without a provider quiescence receipt (CO-168, HAR-R0-05) stays `outcome_unknown`, and
-- `task_has_unresolved_run_at` then holds its task for good. HAR-R0-04 invariant 2 forbids inferring that the work is
-- over from a lapsed lease or an exit, and this does not: the PERSON says it, explicitly, once the session's own
-- process has ended (a trusted terminal.closed@1, or the owned backend's exit receipt). The attestation completes the
-- existing Stop command with the basis `attested`, so `run_has_verified_stop` and every hold that reads it are
-- unchanged. Its undo restores the hold while the task has not moved on.

alter table run_stop_commands drop constraint if exists run_stop_commands_basis_check;
alter table run_stop_commands add constraint run_stop_commands_basis_check check (basis in ('observed','never_spawned','attested'));

insert into event_types (type, projects, note) values
  ('run.stop_attested@1', true, 'the person said the work of a run whose Stop had an unknown outcome is over, after its session process ended; the Stop completes with the basis attested and the task is free (ADR-0170)'),
  ('run.stop_attestation_revoked@1', false, 'the person took back their «работа закончена»: the Stop is of unknown outcome again and the task is held (ADR-0170)')
on conflict (type) do nothing;

-- Whether the session's own process has ended: the same receipts the managed Stop reads.
create function run_session_process_ended(p_estate uuid,p_session uuid,p_after bigint)
returns boolean language sql stable security definer set search_path=public as $$
 select coalesce((backend_exit_evidence(p_estate,p_session,p_after)->>'exitedSeq') is not null,false)
  or exists(select 1 from journal j where j.estate_id=p_estate and j.type='terminal.closed@1'
   and j.payload->>'session_id'=p_session::text and j.actor->>'kind' in ('system','person') and j.seq>p_after)
$$;
revoke all on function run_session_process_ended(uuid,uuid,bigint) from public,anon,authenticated,service_role;

create function attest_task_run_over(p_estate_id uuid,p_run_id uuid,p_session_id uuid,p_command_id uuid,p_actor jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r task_runs; s run_stop_commands; t project_tasks; e journal; v_outcome text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text,4242));
 if p_actor->>'kind' is distinct from 'person' then return jsonb_build_object('recorded',false,'reason_code','person_required'); end if;
 select * into s from run_stop_commands where estate_id=p_estate_id and task_run_id=p_run_id and session_id=p_session_id and command_id=p_command_id for update;
 if not found then return jsonb_build_object('recorded',false,'reason_code','unknown_command'); end if;
 if s.state='stopped' and s.basis='attested' then return jsonb_build_object('recorded',true,'command_id',s.command_id,'task_run_id',p_run_id,
  'task_id',s.task_id,'session_id',p_session_id,'state','stopped','basis','attested','receipt_seq',s.verified_seq,'repeated',true); end if;
 if s.state='stopped' then return jsonb_build_object('recorded',false,'reason_code','already_resolved'); end if;
 select * into r from task_runs where estate_id=p_estate_id and task_run_id=p_run_id for update;
 if not found or r.session_id is distinct from p_session_id then return jsonb_build_object('recorded',false,'reason_code','generation_changed'); end if;
 if not run_session_process_ended(p_estate_id,p_session_id,r.admitted_seq) then
  return jsonb_build_object('recorded',false,'reason_code','session_running'); end if;
 v_outcome:=case when s.reason in ('operator_stop','app_shutdown') then 'cancelled' when s.reason='launch_failure' then 'failed_known' else 'completed' end;
 e:=append_event(p_estate_id,'run.stop_attested@1',p_actor,jsonb_build_object('task_run_id',p_run_id,'task_id',r.task_id,
  'session_id',p_session_id,'command_id',p_command_id,'basis','attested','outcome',v_outcome),'1',r.project_id,p_run_id);
 update run_stop_commands set state='stopped',verified_seq=e.seq,outcome=v_outcome,basis='attested' where command_id=p_command_id;
 if r.state<>'ended' then
  perform append_event(p_estate_id,'run.ended@1',p_actor,
   jsonb_build_object('task_run_id',p_run_id,'task_id',r.task_id,'outcome',v_outcome,'stop_command_id',p_command_id),'1',r.project_id,p_run_id);
 end if;
 select * into t from project_tasks where estate_id=p_estate_id and id=r.task_id for update;
 if found and t.session_id=p_session_id and t.status='running' then
  perform append_event(p_estate_id,'task.moved@1',p_actor,jsonb_build_object('task_id',r.task_id,'to','backlog','task_run_id',p_run_id,
   'stop_command_id',p_command_id,'reason','run_attested_over'),'1',r.project_id,p_run_id);
 end if;
 delete from leases where estate_id=p_estate_id and work_id=r.task_id and owner_session=p_session_id;
 return jsonb_build_object('recorded',true,'command_id',p_command_id,'task_run_id',p_run_id,'task_id',r.task_id,'session_id',p_session_id,
  'state','stopped','basis','attested','outcome',v_outcome,'receipt_seq',e.seq,'repeated',false);
end $$;
revoke all on function attest_task_run_over(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function attest_task_run_over(uuid,uuid,uuid,uuid,jsonb) to service_role;

create function revoke_task_run_attestation(p_estate_id uuid,p_run_id uuid,p_session_id uuid,p_command_id uuid,p_actor jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r task_runs; s run_stop_commands; e journal;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text,4242));
 if p_actor->>'kind' is distinct from 'person' then return jsonb_build_object('revoked',false,'reason_code','person_required'); end if;
 select * into s from run_stop_commands where estate_id=p_estate_id and task_run_id=p_run_id and session_id=p_session_id and command_id=p_command_id for update;
 if not found or s.state<>'stopped' or s.basis is distinct from 'attested' then return jsonb_build_object('revoked',false,'reason_code','not_attested'); end if;
 select * into r from task_runs where estate_id=p_estate_id and task_run_id=p_run_id;
 -- The freed task has moved on: a newer run, or a claim taken after the attestation. Holding it again would take
 -- work away from whoever has it now, so the undo is refused with the reason.
 if exists(select 1 from task_runs n where n.estate_id=p_estate_id and n.task_id=r.task_id and n.run_ordinal>r.run_ordinal)
  or exists(select 1 from leases l where l.estate_id=p_estate_id and l.work_id=r.task_id and l.claimed_seq>s.verified_seq) then
  return jsonb_build_object('revoked',false,'reason_code','task_moved_on'); end if;
 e:=append_event(p_estate_id,'run.stop_attestation_revoked@1',p_actor,jsonb_build_object('task_run_id',p_run_id,'task_id',r.task_id,
  'session_id',p_session_id,'command_id',p_command_id,'undoes',s.verified_seq),'1',r.project_id,p_run_id);
 update run_stop_commands set state='outcome_unknown',verified_seq=null,outcome=null,basis=null where command_id=p_command_id;
 return jsonb_build_object('revoked',true,'command_id',p_command_id,'task_run_id',p_run_id,'task_id',r.task_id,'receipt_seq',e.seq);
end $$;
revoke all on function revoke_task_run_attestation(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function revoke_task_run_attestation(uuid,uuid,uuid,uuid,jsonb) to service_role;

-- Replay: an attested Stop removes the old claim exactly as an observed one does, and only for the exact operational
-- receipt (a raw event cannot manufacture clearance; a revoked attestation is no longer that receipt).
create or replace function apply_task_runs(e journal) returns void
language plpgsql security definer set search_path=public as $$
declare v_run uuid := nullif(e.payload->>'task_run_id','')::uuid;
begin
 if v_run is null then return; end if;
 if e.type='run.started@1' then
  insert into task_runs(task_run_id,estate_id,project_id,task_id,run_ordinal,state,session_id,admitted_seq)
  values(v_run,e.estate_id,e.project_id,(e.payload->>'task_id')::uuid,
   coalesce((e.payload->>'run_ordinal')::int,1),'admitted',nullif(e.payload->>'session_id','')::uuid,e.seq)
  on conflict(task_run_id) do nothing;
 elsif e.type='run.launching@1' then
  update task_runs set state='launching' where estate_id=e.estate_id and task_run_id=v_run and state='admitted';
 elsif e.type in ('run.launch_failed@1','run.stop_requested@1','run.stop_unknown@1') then
  update task_runs set state='ending' where estate_id=e.estate_id and task_run_id=v_run and state in ('admitted','launching','active');
 elsif e.type='run.bound@1' then
  update task_runs set session_id=nullif(e.payload->>'session_id','')::uuid,state='active'
   where estate_id=e.estate_id and task_run_id=v_run and state in ('admitted','launching','active');
 elsif e.type in ('run.stop_observed@1','run.stop_attested@1') then
  if exists(select 1 from run_stop_commands s where s.estate_id=e.estate_id and s.task_run_id=v_run
    and s.session_id=(e.payload->>'session_id')::uuid and s.command_id=(e.payload->>'command_id')::uuid
    and s.state='stopped' and s.verified_seq=e.seq
    and s.basis=case when e.type='run.stop_attested@1' then 'attested' else s.basis end) then
   delete from leases where estate_id=e.estate_id and work_id=(e.payload->>'task_id')::uuid
    and owner_session=(e.payload->>'session_id')::uuid and claimed_seq<=e.seq;
  end if;
 elsif e.type='run.ended@1' then
  update task_runs set state='ended',outcome=coalesce(e.payload->>'outcome','outcome_unknown'),ended_seq=e.seq
   where estate_id=e.estate_id and task_run_id=v_run and state<>'ended';
 end if;
end $$;

-- Schema 93 (this migration) as a private-archive source: the attestation adds no archive event shape, so an archive
-- taken at 93 reads as one taken at 92 (the function of migration 114, with 93 admitted).
-- #region private-archive-source-schema — docs: docs/adr/0079-private-conversation-archives-preserve-history-not-authority.md#decision
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb,'71'::jsonb,'72'::jsonb,'73'::jsonb,'74'::jsonb,'75'::jsonb,'76'::jsonb,'77'::jsonb,'78'::jsonb,'79'::jsonb,'80'::jsonb,'81'::jsonb,'82'::jsonb,'83'::jsonb,'84'::jsonb,'85'::jsonb,'86'::jsonb,'87'::jsonb,'88'::jsonb,'89'::jsonb,'90'::jsonb,'91'::jsonb,'92'::jsonb,'93'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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
