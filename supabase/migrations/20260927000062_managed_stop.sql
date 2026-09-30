-- HAR04. Stop intent is not an exit; only a trusted host observation clears
-- ownership. Operational receipts survive projection replay and are never
-- constructed from agent claims or raw run.stop.* journal payloads.
create table run_stop_commands (
  command_id uuid primary key,
  estate_id uuid not null,
  project_id uuid not null,
  task_run_id uuid not null unique,
  task_id uuid not null,
  session_id uuid not null,
  reason text not null check(reason in ('operator_stop','app_shutdown','natural_exit','launch_failure')),
  state text not null check(state in ('requested','outcome_unknown','stopped')),
  requested_seq bigint not null,
  observation_seq bigint,
  verified_seq bigint,
  outcome text check(outcome in ('completed','failed_known','cancelled')),
  basis text check(basis in ('observed','never_spawned')),
  observation jsonb,
  check((state='stopped')=(verified_seq is not null)),
  check(state<>'stopped' or (outcome is not null and basis is not null))
);
alter table run_stop_commands enable row level security;
revoke all on run_stop_commands from public,anon,authenticated,service_role;
grant select on run_stop_commands to service_role;
insert into event_types(type,projects,note) values
 ('run.stop_requested@1',true,'a durable request to stop an exact execution generation'),
 ('run.stop_unknown@1',true,'termination or finalization is not proved; ownership remains held'),
 ('run.stop_observed@1',true,'trusted host proved execution cannot continue; explicit observed or never-spawned basis')
on conflict(type) do nothing;

create function run_has_verified_stop(p_estate uuid,p_run uuid,p_session uuid,p_seq bigint default 9223372036854775807)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from run_stop_commands s where s.estate_id=p_estate and s.task_run_id=p_run
  and s.session_id=p_session and s.state='stopped' and s.verified_seq<=p_seq)
$$;
revoke all on function run_has_verified_stop(uuid,uuid,uuid,bigint) from public,anon,authenticated,service_role;

-- Proof of the validated pre-spawn compensation is operational too. A raw
-- journal payload launch_failure:true is a claim, not permission to start again.
create table run_launch_compensations (
  task_run_id uuid primary key,
  estate_id uuid not null,
  session_id uuid not null,
  receipt_seq bigint not null
);
alter table run_launch_compensations enable row level security;
revoke all on run_launch_compensations from public,anon,authenticated,service_role;
grant select on run_launch_compensations to service_role;

create function run_ownership_unresolved(p_estate uuid,p_run uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select coalesce((select not (r.state='ended' and (
  run_has_verified_stop(r.estate_id,r.task_run_id,r.session_id) or exists(
   select 1 from run_launch_compensations c where c.estate_id=r.estate_id and c.task_run_id=r.task_run_id
    and c.session_id=r.session_id and c.receipt_seq=r.ended_seq and r.outcome='failed_known')))
  from task_runs r where r.estate_id=p_estate and r.task_run_id=p_run),true)
$$;
revoke all on function run_ownership_unresolved(uuid,uuid) from public,anon,authenticated,service_role;

create function request_task_run_stop(p_estate_id uuid,p_run_id uuid,p_session_id uuid,p_command_id uuid,p_actor jsonb,
 p_person_id uuid default null,p_revision bigint default null,p_reason text default 'operator_stop')
returns jsonb language plpgsql security definer set search_path=public as $$
declare r task_runs; held leases; s run_stop_commands; e journal;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text,4242));
 if p_command_id is null or p_session_id is null or p_run_id is null or p_reason is null
  or p_reason not in ('operator_stop','app_shutdown','natural_exit','launch_failure') then
  return jsonb_build_object('requested',false,'reason_code','invalid_request'); end if;
 perform pg_advisory_xact_lock(hashtextextended(p_command_id::text,6062));
 if coalesce(p_actor->>'kind','') not in ('person','system') then
  return jsonb_build_object('requested',false,'reason_code','untrusted_actor'); end if;
 if p_actor->>'kind'='person' then
  perform 1 from memberships where estate_id=p_estate_id and person_id=p_person_id and revision=p_revision for share;
  if not found then return jsonb_build_object('requested',false,'reason_code','authority_changed'); end if;
 end if;
 select * into s from run_stop_commands where command_id=p_command_id;
 if found and (s.estate_id<>p_estate_id or s.task_run_id<>p_run_id or s.session_id<>p_session_id) then
  return jsonb_build_object('requested',false,'reason_code','identity_conflict'); end if;
 select * into r from task_runs where estate_id=p_estate_id and task_run_id=p_run_id for update;
 if not found then return jsonb_build_object('requested',false,'reason_code','not_found'); end if;
 if r.session_id is distinct from p_session_id then return jsonb_build_object('requested',false,'reason_code','generation_changed'); end if;
 select * into s from run_stop_commands where estate_id=p_estate_id and task_run_id=p_run_id;
 -- A lost receipt remains readable after newer work starts; this grants no signal.
 if found then return jsonb_build_object('requested',true,'command_id',s.command_id,'task_run_id',p_run_id,'task_id',r.task_id,
  'session_id',p_session_id,'state',s.state,'reason',s.reason,'basis',s.basis,'outcome',s.outcome,'receipt_seq',case when s.state='stopped' then s.verified_seq else s.requested_seq end,'repeated',true); end if;
 if exists(select 1 from task_runs where estate_id=p_estate_id and task_id=r.task_id and run_ordinal>r.run_ordinal) then
  return jsonb_build_object('requested',false,'reason_code','generation_changed'); end if;
 select * into held from leases where estate_id=p_estate_id and work_id=r.task_id for update;
 if not found or held.owner_session<>p_session_id then return jsonb_build_object('requested',false,'reason_code','lease_changed'); end if;
 e:=append_event(p_estate_id,'run.stop_requested@1',p_actor,jsonb_build_object('task_run_id',p_run_id,'task_id',r.task_id,
  'session_id',p_session_id,'command_id',p_command_id,'reason',p_reason),'1',r.project_id,p_run_id);
 insert into run_stop_commands(command_id,estate_id,project_id,task_run_id,task_id,session_id,reason,state,requested_seq)
 values(p_command_id,p_estate_id,r.project_id,p_run_id,r.task_id,p_session_id,p_reason,'requested',e.seq);
 return jsonb_build_object('requested',true,'command_id',p_command_id,'task_run_id',p_run_id,'task_id',r.task_id,
  'session_id',p_session_id,'state','requested','reason',p_reason,'basis',null,'receipt_seq',e.seq,'repeated',false);
end $$;

create function record_task_run_stop_observation(p_estate_id uuid,p_run_id uuid,p_session_id uuid,p_command_id uuid,p_observation jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r task_runs; t project_tasks; held leases; s run_stop_commands; e journal; closed journal; k text; safe jsonb:='{}';
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
 select * into closed from journal where estate_id=p_estate_id and type='terminal.closed@1' and payload->>'session_id'=p_session_id::text
  and actor->>'kind' in ('system','person') and seq>r.admitted_seq order by seq desc limit 1;
 if not found then complete:=false; else safe:=safe||jsonb_build_object('terminalClosedSeq',closed.seq); end if;
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
revoke all on function request_task_run_stop(uuid,uuid,uuid,uuid,jsonb,uuid,bigint,text) from public,anon,authenticated;
revoke all on function record_task_run_stop_observation(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function request_task_run_stop(uuid,uuid,uuid,uuid,jsonb,uuid,bigint,text) to service_role;
grant execute on function record_task_run_stop_observation(uuid,uuid,uuid,uuid,jsonb) to service_role;

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
 elsif e.type='run.stop_observed@1' then
  -- Replay may resurrect an older claim. Remove it only for the exact verified
  -- operational receipt; a raw event cannot manufacture clearance.
  if exists(select 1 from run_stop_commands s where s.estate_id=e.estate_id and s.task_run_id=v_run
    and s.session_id=(e.payload->>'session_id')::uuid and s.command_id=(e.payload->>'command_id')::uuid
    and s.state='stopped' and s.verified_seq=e.seq) then
   delete from leases where estate_id=e.estate_id and work_id=(e.payload->>'task_id')::uuid
    and owner_session=(e.payload->>'session_id')::uuid and claimed_seq<=e.seq;
  end if;
 elsif e.type='run.ended@1' then
  update task_runs set state='ended',outcome=coalesce(e.payload->>'outcome','outcome_unknown'),ended_seq=e.seq
   where estate_id=e.estate_id and task_run_id=v_run and state<>'ended';
 end if;
end $$;

create or replace function admit_task_launch(p_estate_id uuid,p_task_id uuid,p_actor jsonb,p_session_id uuid,
 p_trigger text default 'operator',p_person_id uuid default null,p_revision bigint default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare t project_tasks; r task_runs; held leases; receipt journal; prior journal; v_run uuid; v_ordinal int; blockers int;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text,4242));
 -- Session identity is global; different Estates must not race its reuse.
 if p_session_id is not null then perform pg_advisory_xact_lock(hashtextextended(p_session_id::text,6061)); end if;
 if p_session_id is null or p_task_id is null then
  return jsonb_build_object('admitted',false,'reason_code','invalid_identity','says','A task and session identity are required.');
 end if;
 if p_actor->>'kind'='person' then
  perform 1 from memberships where estate_id=p_estate_id and person_id=p_person_id and revision=p_revision for share;
  if not found then return jsonb_build_object('admitted',false,'reason_code','authority_changed','says','Membership changed; refresh before launching.'); end if;
 end if;
 select * into t from project_tasks where estate_id=p_estate_id and id=p_task_id for update;
 if not found then return jsonb_build_object('admitted',false,'reason_code','not_found','says','No such task in this Estate.'); end if;
 -- The journal retains the original identity even after legacy session rebinding.
 select * into prior from journal where type='task.admitted@1' and payload->>'session_id'=p_session_id::text order by seq limit 1;
 if found then
  if prior.estate_id<>p_estate_id or prior.payload->>'task_id'<>p_task_id::text then
   return jsonb_build_object('admitted',false,'reason_code','identity_conflict','says','This session identity already belongs to another task.');
  end if;
  select * into r from task_runs where estate_id=p_estate_id and task_run_id=(prior.payload->>'task_run_id')::uuid;
  if not found then return jsonb_build_object('admitted',false,'reason_code','missing_run','says','Admission exists but its run is unavailable.'); end if;
  return jsonb_build_object('admitted',true,'task_run_id',r.task_run_id,'task_id',p_task_id,'project_id',r.project_id,
   'instruction',coalesce(prior.payload->>'instruction',t.instruction),'option_id',coalesce(prior.payload->>'option_id',t.option_id),
   'session_id',p_session_id,'state',r.state,'repeated',true,'receipt_seq',prior.seq,'run_ordinal',r.run_ordinal);
 end if;
 if exists(select 1 from task_runs where session_id=p_session_id) then
  return jsonb_build_object('admitted',false,'reason_code','identity_conflict','says','This session identity is already in use.');
 end if;
 if t.status in ('done','cancelled','finished','abandoned') then
  return jsonb_build_object('admitted',false,'reason_code','terminal','says','A closed task cannot start again.');
 end if;
 if exists(select 1 from task_runs where estate_id=p_estate_id and task_id=p_task_id and run_ownership_unresolved(estate_id,task_run_id)) then
  return jsonb_build_object('admitted',false,'reason_code','run_unresolved','says','The previous execution has not been proved stopped.');
 end if;
 if t.status='running' then return jsonb_build_object('admitted',false,'reason_code','already_running','says','This task is already running.'); end if;
 perform recompute_task_blockers(p_estate_id,p_task_id);
 select count(*) into blockers from question_blocks qb join questions q on q.estate_id=qb.estate_id and q.id=qb.question_id
  where qb.estate_id=p_estate_id and qb.task_id=p_task_id and q.answered_at is null;
 if blockers>0 then return jsonb_build_object('admitted',false,'reason_code','blocked','open_blockers',blockers,'says','Answer the blocking questions first.'); end if;
 select * into held from leases where estate_id=p_estate_id and work_id=p_task_id for update;
 if found and not exists(select 1 from task_runs where estate_id=p_estate_id and task_id=p_task_id and session_id=held.owner_session and not run_ownership_unresolved(estate_id,task_run_id)) then return jsonb_build_object('admitted',false,'reason_code','lease_held','says','Another launch owns this task.'); end if;
 delete from leases where estate_id=p_estate_id and work_id=p_task_id;
 insert into leases(estate_id,project_id,work_id,owner_session,idempotency_key,expires_at,write_scopes,claimed_seq)
 values(p_estate_id,t.project_id,p_task_id,p_session_id,p_session_id::text,clock_timestamp()+interval '10 minutes',array['task'],coalesce(t.seq,0));
 select coalesce(max(run_ordinal),0)+1 into v_ordinal from task_runs where estate_id=p_estate_id and task_id=p_task_id;
 v_run:=gen_random_uuid();
 perform append_event(p_estate_id,'run.started@1',p_actor,jsonb_build_object('task_run_id',v_run,'task_id',p_task_id,'run_ordinal',v_ordinal,'session_id',p_session_id),'1',t.project_id);
 select * into receipt from append_event(p_estate_id,'task.admitted@1',p_actor,
  jsonb_build_object('task_id',p_task_id,'session_id',p_session_id,'trigger',p_trigger,'task_run_id',v_run,'launch_protocol','managed-v1','instruction',t.instruction,'option_id',t.option_id),'1',t.project_id,v_run);
 return jsonb_build_object('admitted',true,'task_run_id',v_run,'task_id',p_task_id,'project_id',t.project_id,'instruction',t.instruction,
  'option_id',t.option_id,'session_id',p_session_id,'state','admitted','repeated',false,'receipt_seq',receipt.seq,'run_ordinal',v_ordinal);
end $$;

create or replace function begin_task_run_launch(p_estate_id uuid,p_run_id uuid,p_session_id uuid,p_actor jsonb,
 p_person_id uuid default null,p_revision bigint default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r task_runs; t project_tasks; held leases;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text,4242));
 if p_actor->>'kind'='person' then
  perform 1 from memberships where estate_id=p_estate_id and person_id=p_person_id and revision=p_revision for share;
  if not found then return jsonb_build_object('granted',false,'reason_code','authority_changed','says','Membership changed before spawn.'); end if;
 end if;
 select * into r from task_runs where estate_id=p_estate_id and task_run_id=p_run_id for update;
 if not found then return jsonb_build_object('granted',false,'reason_code','not_found'); end if;
 if r.session_id is distinct from p_session_id or exists(select 1 from task_runs where estate_id=p_estate_id and task_id=r.task_id and run_ordinal>r.run_ordinal) then
  return jsonb_build_object('granted',false,'reason_code','generation_changed','state',r.state);
 end if;
 if exists(select 1 from task_runs where estate_id=p_estate_id and task_id=r.task_id and task_run_id<>p_run_id and run_ownership_unresolved(estate_id,task_run_id)) then
  return jsonb_build_object('granted',false,'reason_code','run_unresolved');
 end if;
 if r.state<>'admitted' then return jsonb_build_object('granted',false,'reason_code','spawn_consumed','state',r.state,'repeated',true); end if;
 select * into t from project_tasks where estate_id=p_estate_id and id=r.task_id for update;
 if not found or t.status in ('done','cancelled','finished','abandoned','running') then return jsonb_build_object('granted',false,'reason_code','task_changed'); end if;
 perform recompute_task_blockers(p_estate_id,r.task_id);
 if exists(select 1 from question_blocks qb join questions q on q.estate_id=qb.estate_id and q.id=qb.question_id where qb.estate_id=p_estate_id and qb.task_id=r.task_id and q.answered_at is null) then
  return jsonb_build_object('granted',false,'reason_code','blocked');
 end if;
 select * into held from leases where estate_id=p_estate_id and work_id=r.task_id for update;
 if not found or held.owner_session is distinct from p_session_id then return jsonb_build_object('granted',false,'reason_code','lease_changed'); end if;
 -- A still-unconsumed admission can renew only the same owner's lease.
 update leases set expires_at=clock_timestamp()+interval '10 minutes' where estate_id=p_estate_id and work_id=r.task_id and owner_session=p_session_id;
 perform append_event(p_estate_id,'run.launching@1',p_actor,jsonb_build_object('task_run_id',p_run_id,'task_id',r.task_id,'session_id',p_session_id),'1',r.project_id,p_run_id);
 return jsonb_build_object('granted',true,'task_run_id',p_run_id,'session_id',p_session_id,'state','launching','repeated',false);
end $$;

create or replace function bind_task_run(p_estate_id uuid,p_run_id uuid,p_session_id uuid,p_actor jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r task_runs; held leases; t project_tasks; was_active boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text,4242));
 -- Session identity is global; different Estates must not race its reuse.
 if p_session_id is not null then perform pg_advisory_xact_lock(hashtextextended(p_session_id::text,6061)); end if;
 select * into r from task_runs where estate_id=p_estate_id and task_run_id=p_run_id for update;
 if not found then return jsonb_build_object('bound',false,'reason_code','not_found'); end if;
 if r.state in ('ended','ending') then return jsonb_build_object('bound',false,'reason_code',r.state); end if;
 if p_session_id is null or exists(select 1 from task_runs where estate_id=p_estate_id and task_id=r.task_id and run_ordinal>r.run_ordinal) then
  return jsonb_build_object('bound',false,'reason_code','generation_changed');
 end if;
 if exists(select 1 from task_runs where estate_id=p_estate_id and task_id=r.task_id and task_run_id<>p_run_id and run_ownership_unresolved(estate_id,task_run_id)) then
  return jsonb_build_object('bound',false,'reason_code','run_unresolved');
 end if;
 select * into held from leases where estate_id=p_estate_id and work_id=r.task_id for update;
 if not found or held.owner_session is distinct from r.session_id then return jsonb_build_object('bound',false,'reason_code','lease_changed'); end if;
 if r.state='admitted' and exists(select 1 from journal where estate_id=p_estate_id and type='task.admitted@1' and run_id=p_run_id and payload->>'launch_protocol'='managed-v1') then
  return jsonb_build_object('bound',false,'reason_code','launch_not_begun');
 end if;
 if r.state in ('launching','active') and r.session_id is distinct from p_session_id then return jsonb_build_object('bound',false,'reason_code','session_conflict'); end if;
 select * into t from project_tasks where estate_id=p_estate_id and id=r.task_id for update;
 if not found or t.status in ('done','cancelled','finished','abandoned') then return jsonb_build_object('bound',false,'reason_code','task_changed'); end if;
 was_active:=r.state='active';
 if was_active and t.session_id=p_session_id then return jsonb_build_object('bound',true,'task_run_id',p_run_id,'task_id',r.task_id,'session_id',p_session_id,'state','active','repeated',true); end if;
 if exists(select 1 from task_runs where session_id=p_session_id and task_run_id<>p_run_id) then return jsonb_build_object('bound',false,'reason_code','session_conflict'); end if;
 -- Legacy admitted rows used a pre-spawn ID. Only its exact owner can move it.
 update leases set owner_session=p_session_id,expires_at=clock_timestamp()+interval '10 minutes'
  where estate_id=p_estate_id and work_id=r.task_id and owner_session=r.session_id;
 if not was_active then perform append_event(p_estate_id,'run.bound@1',p_actor,jsonb_build_object('task_run_id',p_run_id,'task_id',r.task_id,'session_id',p_session_id),'1',r.project_id,p_run_id); end if;
 perform append_event(p_estate_id,'task.session.attached@1',p_actor,jsonb_build_object('id',r.task_id,'task_run_id',p_run_id,'session_id',p_session_id),'1',r.project_id,p_run_id);
 return jsonb_build_object('bound',true,'task_run_id',p_run_id,'task_id',r.task_id,'session_id',p_session_id,'state','active','repeated',was_active);
end $$;

create or replace function validate_task_run_launch(p_estate_id uuid,p_run_id uuid,p_session_id uuid,p_actor jsonb,
 p_person_id uuid default null,p_revision bigint default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r task_runs; t project_tasks; held leases;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text,4242));
 if p_actor->>'kind'='person' then
  perform 1 from memberships where estate_id=p_estate_id and person_id=p_person_id and revision=p_revision for share;
  if not found then return jsonb_build_object('valid',false,'reason_code','authority_changed','says','Membership changed before spawn.'); end if;
 end if;
 select * into r from task_runs where estate_id=p_estate_id and task_run_id=p_run_id for update;
 if not found then return jsonb_build_object('valid',false,'reason_code','not_found'); end if;
 if r.session_id is distinct from p_session_id or exists(select 1 from task_runs where estate_id=p_estate_id and task_id=r.task_id and run_ordinal>r.run_ordinal) then
  return jsonb_build_object('valid',false,'reason_code','generation_changed','state',r.state);
 end if;
 if exists(select 1 from task_runs where estate_id=p_estate_id and task_id=r.task_id and task_run_id<>p_run_id and run_ownership_unresolved(estate_id,task_run_id)) then
  return jsonb_build_object('valid',false,'reason_code','run_unresolved');
 end if;
 if r.state<>'launching' then return jsonb_build_object('valid',false,'reason_code','not_launching','state',r.state,'repeated',true); end if;
 select * into t from project_tasks where estate_id=p_estate_id and id=r.task_id for update;
 if not found or t.status in ('done','cancelled','finished','abandoned','running') then return jsonb_build_object('valid',false,'reason_code','task_changed'); end if;
 perform recompute_task_blockers(p_estate_id,r.task_id);
 if exists(select 1 from question_blocks qb join questions q on q.estate_id=qb.estate_id and q.id=qb.question_id where qb.estate_id=p_estate_id and qb.task_id=r.task_id and q.answered_at is null) then
  return jsonb_build_object('valid',false,'reason_code','blocked');
 end if;
 select * into held from leases where estate_id=p_estate_id and work_id=r.task_id for update;
 if not found or held.owner_session is distinct from p_session_id then return jsonb_build_object('valid',false,'reason_code','lease_changed'); end if;
 return jsonb_build_object('valid',true,'task_run_id',p_run_id,'session_id',p_session_id,'state','launching');
end $$;

create or replace function task_has_unresolved_run_at(p_estate uuid,p_task uuid,p_owner uuid,p_seq bigint)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from task_runs r where r.estate_id=p_estate and r.task_id=p_task
  and r.admitted_seq<=p_seq and not (run_has_verified_stop(r.estate_id,r.task_run_id,r.session_id,p_seq) or exists(select 1 from run_launch_compensations c where c.estate_id=r.estate_id and c.task_run_id=r.task_run_id and c.session_id=r.session_id and c.receipt_seq=r.ended_seq and c.receipt_seq<=p_seq and r.outcome='failed_known'))
  and (p_owner is null or coalesce((select nullif(j.payload->>'session_id','')::uuid from journal j
    where j.estate_id=p_estate and j.type in ('run.started@1','run.bound@1')
      and j.payload->>'task_run_id'=r.task_run_id::text and j.seq<=p_seq
    order by j.seq desc limit 1),r.session_id) is distinct from p_owner))
$$;

-- No new delivery can cross its begin boundary once Stop fences the Run.
create or replace function continuation_dispatch(
  p_estate_id uuid, p_actor jsonb, p_delivery_id uuid, p_task_id uuid,
  p_run_id uuid, p_session_id uuid, p_digest text, p_claim_id uuid, p_action text,
  p_person_id uuid default null, p_revision bigint default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare d deliveries; c continuation_dispatches; r task_runs; v_state text;
begin
  -- Same lock order as append_event and run lifecycle: estate first.
  perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text,4242));
  if p_estate_id is null or p_delivery_id is null or p_task_id is null or p_run_id is null
      or p_session_id is null or p_action is null or p_claim_id is null or p_digest is null or p_digest !~ '^[0-9a-f]{32}$' then
    raise exception 'invalid dispatch identity';
  end if;
  select * into d from deliveries where delivery_id=p_delivery_id;
  if found and (d.estate_id<>p_estate_id or d.task_id<>p_task_id
      or d.session_id is distinct from p_session_id or d.input_digest<>p_digest) then
    return jsonb_build_object('state','identity_conflict','granted',false);
  end if;
  select * into c from continuation_dispatches where delivery_id=p_delivery_id;
  if c.delivery_id is not null and (c.estate_id<>p_estate_id or c.task_run_id<>p_run_id) then
    return jsonb_build_object('state','identity_conflict','granted',false);
  end if;
  if d.state='accepted' then return jsonb_build_object('state','accepted','granted',false); end if;
  if d.state='written_unconfirmed' then return jsonb_build_object('state','written','granted',false); end if;
  if d.state='outcome_unknown' then return jsonb_build_object('state','outcome_unknown','granted',false); end if;

  if p_action in ('claim','begin') and p_actor->>'kind'='person' then
    perform 1 from memberships where estate_id=p_estate_id
      and person_id=p_person_id and revision=p_revision for share;
    if not found then return jsonb_build_object('state','authority_changed','granted',false); end if;
  end if;
  if p_action='claim' then
    -- Old queued receipts may have already crossed the old unfenced write.
    if d.delivery_id is not null and c.delivery_id is null then
      perform append_event(p_estate_id,'delivery.unknown@1',p_actor,
        jsonb_build_object('delivery_id',p_delivery_id,'task_id',p_task_id,'session_id',p_session_id),
        '1',d.project_id,p_run_id);
      return jsonb_build_object('state','outcome_unknown','granted',false);
    end if;
    if c.state in ('write_started','outcome_unknown','written') then
      return jsonb_build_object('state',case when c.state='written' then 'written' else 'outcome_unknown' end,'granted',false);
    end if;
    if c.state='reserved' and c.lease_until>clock_timestamp() then
      return jsonb_build_object('state','reserved','granted',false);
    end if;
    select * into r from task_runs where estate_id=p_estate_id and task_id=p_task_id
      order by run_ordinal desc limit 1;
    if not found or r.task_run_id<>p_run_id or r.session_id is distinct from p_session_id or r.state<>'active' then
      return jsonb_build_object('state','target_changed','granted',false);
    end if;
    if d.delivery_id is null then
      perform append_event(p_estate_id,'delivery.queued@1',p_actor,
        jsonb_build_object('delivery_id',p_delivery_id,'task_id',p_task_id,'session_id',p_session_id,'input_digest',p_digest),
        '1',r.project_id,p_run_id);
    elsif d.state='failed_before_write' then
      perform append_event(p_estate_id,'delivery.retrying@1',p_actor,
        jsonb_build_object('delivery_id',p_delivery_id,'task_id',p_task_id),'1',r.project_id,p_run_id);
    end if;
    insert into continuation_dispatches(delivery_id,estate_id,project_id,task_run_id,claim_id,state,lease_until)
      values(p_delivery_id,p_estate_id,r.project_id,p_run_id,p_claim_id,'reserved',clock_timestamp()+interval '60 seconds')
      on conflict(delivery_id) do update set claim_id=p_claim_id,state='reserved',
        lease_until=clock_timestamp()+interval '60 seconds',updated_at=clock_timestamp();
    return jsonb_build_object('state','reserved','granted',true);
  end if;

  if c.claim_id is distinct from p_claim_id or c.estate_id is distinct from p_estate_id or c.task_run_id is distinct from p_run_id then
    return jsonb_build_object('state','fenced','granted',false);
  end if;
  if p_action='begin' then
    if c.state<>'reserved' or c.lease_until<=clock_timestamp() then
      return jsonb_build_object('state','fenced','granted',false);
    end if;
    select * into r from task_runs where estate_id=p_estate_id and task_id=p_task_id
      order by run_ordinal desc limit 1;
    if not found or r.task_run_id<>p_run_id or r.session_id is distinct from p_session_id or r.state<>'active' then
      return jsonb_build_object('state','target_changed','granted',false);
    end if;
    update continuation_dispatches set state='write_started',updated_at=clock_timestamp() where delivery_id=p_delivery_id;
    return jsonb_build_object('state','write_started','granted',true);
  end if;
  if p_action not in ('written','failed_before_write','outcome_unknown') then raise exception 'invalid dispatch action'; end if;
  if c.state not in ('reserved','write_started') or (p_action='written' and c.state<>'write_started') then
    return jsonb_build_object('state',c.state,'granted',false);
  end if;
  v_state:=p_action;
  perform append_event(p_estate_id,case p_action when 'written' then 'delivery.written@1'
    when 'failed_before_write' then 'delivery.failed_before_write@1' else 'delivery.unknown@1' end,p_actor,
    jsonb_build_object('delivery_id',p_delivery_id,'task_id',p_task_id,'session_id',p_session_id),
    '1',d.project_id,p_run_id);
  update continuation_dispatches set state=v_state,updated_at=clock_timestamp() where delivery_id=p_delivery_id;
  return jsonb_build_object('state',v_state,'granted',false);
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
   or exists(select 1 from journal where estate_id=p_estate_id and type in ('terminal.opened@1','terminal.closed@1') and payload->>'session_id'=p_session_id::text)
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
