-- HAR-R0-03: admission, the one-shot spawn boundary, binding and compensation.
-- A lease timeout never proves process death. All transitions serialize with
-- append_event using the Estate lock before row locks.
insert into event_types(type, projects, note) values
 ('run.launching@1', true, 'the admitted generation consumed its single spawn permission'),
 ('run.launch_failed@1', true, 'a launch may have started a process; ownership remains unresolved')
on conflict(type) do nothing;

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
 elsif e.type='run.launch_failed@1' then
  update task_runs set state='ending' where estate_id=e.estate_id and task_run_id=v_run and state in ('admitted','launching','active');
 elsif e.type='run.bound@1' then
  update task_runs set session_id=nullif(e.payload->>'session_id','')::uuid,state='active'
   where estate_id=e.estate_id and task_run_id=v_run and state in ('admitted','launching','active');
 elsif e.type='run.ended@1' then
  update task_runs set state='ended',outcome=coalesce(e.payload->>'outcome','outcome_unknown'),ended_seq=e.seq
   where estate_id=e.estate_id and task_run_id=v_run and state<>'ended';
 end if;
end $$;

-- Drop the old overload, otherwise PostgREST can select an unfenced overload.
drop function admit_task_launch(uuid,uuid,jsonb,uuid,text);
create function admit_task_launch(p_estate_id uuid,p_task_id uuid,p_actor jsonb,p_session_id uuid,
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
 if exists(select 1 from task_runs where estate_id=p_estate_id and task_id=p_task_id and (state<>'ended' or outcome='outcome_unknown')) then
  return jsonb_build_object('admitted',false,'reason_code','run_unresolved','says','The previous execution has not been proved stopped.');
 end if;
 if t.status='running' then return jsonb_build_object('admitted',false,'reason_code','already_running','says','This task is already running.'); end if;
 perform recompute_task_blockers(p_estate_id,p_task_id);
 select count(*) into blockers from question_blocks qb join questions q on q.estate_id=qb.estate_id and q.id=qb.question_id
  where qb.estate_id=p_estate_id and qb.task_id=p_task_id and q.answered_at is null;
 if blockers>0 then return jsonb_build_object('admitted',false,'reason_code','blocked','open_blockers',blockers,'says','Answer the blocking questions first.'); end if;
 select * into held from leases where estate_id=p_estate_id and work_id=p_task_id for update;
 if found and not exists(select 1 from task_runs where estate_id=p_estate_id and task_id=p_task_id and session_id=held.owner_session and state='ended' and outcome<>'outcome_unknown') then return jsonb_build_object('admitted',false,'reason_code','lease_held','says','Another launch owns this task.'); end if;
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

create function begin_task_run_launch(p_estate_id uuid,p_run_id uuid,p_session_id uuid,p_actor jsonb,
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
 if exists(select 1 from task_runs where estate_id=p_estate_id and task_id=r.task_id and task_run_id<>p_run_id and (state<>'ended' or outcome='outcome_unknown')) then
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
 if exists(select 1 from task_runs where estate_id=p_estate_id and task_id=r.task_id and task_run_id<>p_run_id and (state<>'ended' or outcome='outcome_unknown')) then
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

create function fail_task_launch(p_estate_id uuid,p_run_id uuid,p_session_id uuid,p_actor jsonb,p_process_started boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r task_runs; held leases;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text,4242));
 select * into r from task_runs where estate_id=p_estate_id and task_run_id=p_run_id for update;
 if not found then return jsonb_build_object('compensated',false,'reason_code','not_found'); end if;
 if p_process_started is null or r.session_id is distinct from p_session_id or exists(select 1 from task_runs where estate_id=p_estate_id and task_id=r.task_id and run_ordinal>r.run_ordinal) then
  return jsonb_build_object('compensated',false,'reason_code','generation_changed');
 end if;
 if r.state='ended' then
  if r.outcome='failed_known' and exists(select 1 from journal where estate_id=p_estate_id and seq=r.ended_seq and payload->>'launch_failure'='true') then
   return jsonb_build_object('compensated',true,'task_run_id',p_run_id,'session_id',p_session_id,'state','ended','outcome',r.outcome,'repeated',true);
  end if;
  return jsonb_build_object('compensated',false,'reason_code','ended','state','ended','outcome',r.outcome);
 end if;
 select * into held from leases where estate_id=p_estate_id and work_id=r.task_id for update;
 if not found or held.owner_session is distinct from p_session_id then return jsonb_build_object('compensated',false,'reason_code','lease_changed'); end if;
 if not p_process_started then
  if r.state <> 'launching' or exists(select 1 from journal where estate_id=p_estate_id and type='terminal.opened@1' and payload->>'session_id'=p_session_id::text) then
   return jsonb_build_object('compensated',false,'reason_code','process_evidence','state',r.state);
  end if;
  perform append_event(p_estate_id,'run.ended@1',p_actor,jsonb_build_object('task_run_id',p_run_id,'task_id',r.task_id,'outcome','failed_known','launch_failure',true),'1',r.project_id,p_run_id);
  delete from leases where estate_id=p_estate_id and work_id=r.task_id and owner_session=p_session_id;
  return jsonb_build_object('compensated',true,'task_run_id',p_run_id,'session_id',p_session_id,'state','ended','outcome','failed_known','repeated',false);
 end if;
 if r.state='ending' then return jsonb_build_object('compensated',true,'task_run_id',p_run_id,'session_id',p_session_id,'state','ending','repeated',true); end if;
 perform append_event(p_estate_id,'run.launch_failed@1',p_actor,jsonb_build_object('task_run_id',p_run_id,'task_id',r.task_id,'session_id',p_session_id,'process_started',true),'1',r.project_id,p_run_id);
 return jsonb_build_object('compensated',true,'task_run_id',p_run_id,'session_id',p_session_id,'state','ending','repeated',false);
end $$;

revoke execute on function admit_task_launch(uuid,uuid,jsonb,uuid,text,uuid,bigint) from public,anon,authenticated;
revoke execute on function begin_task_run_launch(uuid,uuid,uuid,jsonb,uuid,bigint) from public,anon,authenticated;
revoke execute on function bind_task_run(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke execute on function fail_task_launch(uuid,uuid,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function admit_task_launch(uuid,uuid,jsonb,uuid,text,uuid,bigint) to service_role;
grant execute on function begin_task_run_launch(uuid,uuid,uuid,jsonb,uuid,bigint) to service_role;
grant execute on function bind_task_run(uuid,uuid,uuid,jsonb) to service_role;
grant execute on function fail_task_launch(uuid,uuid,uuid,jsonb,boolean) to service_role;
-- Projection and lease writes occur only in trusted commands, not direct clients.
revoke insert,update,delete,truncate on task_runs,leases from anon,authenticated,service_role;

-- Read Run ownership as of the claim's journal sequence. Rebuild may replay
-- over final-state rows; a later known ending cannot authorise an earlier claim.
create function task_has_unresolved_run_at(p_estate uuid,p_task uuid,p_owner uuid,p_seq bigint)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from task_runs r where r.estate_id=p_estate and r.task_id=p_task
  and r.admitted_seq<=p_seq and (r.ended_seq is null or r.ended_seq>p_seq or r.outcome='outcome_unknown')
  and (p_owner is null or coalesce((select nullif(j.payload->>'session_id','')::uuid from journal j
    where j.estate_id=p_estate and j.type in ('run.started@1','run.bound@1')
      and j.payload->>'task_run_id'=r.task_run_id::text and j.seq<=p_seq
    order by j.seq desc limit 1),r.session_id) is distinct from p_owner))
$$;
revoke all on function task_has_unresolved_run_at(uuid,uuid,uuid,bigint) from public,anon,authenticated,service_role;

-- Extend the canonical claim/release projector; other arms retain migration53 semantics.
create or replace function apply_operating_surfaces(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  case e.type
    -- the ladder post-fix: the legacy body wrote its old vocabulary a statement
    -- ago in this same transaction; rows never rest with it.
    when 'task.started@1' then
      update project_tasks set status = 'running' where id = (e.payload->>'id')::uuid and status = 'open'
             and estate_id = e.estate_id;
    when 'task.finished@1' then
      update project_tasks set status = 'done' where id = (e.payload->>'id')::uuid and status = 'finished'
             and estate_id = e.estate_id;
    when 'task.abandoned@1' then
      -- Not a mere normalisation: the legacy branch guards on status='open',
      -- which no longer exists at rest, so an orphaned RUNNING task would never
      -- close at all — the reconcile suite caught exactly that. This branch IS
      -- the abandon now; the guard still protects a real outcome from damage.
      update project_tasks
        set status = 'cancelled',
            abandoned_reason = coalesce(abandoned_reason, e.payload->>'reason', 'unknown'),
            closed_reason    = coalesce(closed_reason, abandoned_reason, e.payload->>'reason', 'unknown'),
            finished_at      = coalesce(finished_at, e.occurred_at)
        where id = (e.payload->>'id')::uuid
          and status in ('abandoned','backlog','running','review')
             and estate_id = e.estate_id;

    when 'task.created@1' then
      insert into project_tasks (id, estate_id, project_id, instruction, option_id,
                                 status, title, task_type, section, preset,
                                 origin_kind, origin_ref, started_at, seq)
      values ((e.payload->>'id')::uuid, e.estate_id, e.project_id,
              coalesce(e.payload->>'instruction', e.payload->>'title'),
              coalesce(e.payload->>'option_id', ''),
              'backlog',
              e.payload->>'title', e.payload->>'task_type', e.payload->>'section', e.payload->>'preset',
              e.payload->'origin'->>'kind', e.payload->'origin'->>'ref',
              e.occurred_at, e.seq)
      on conflict (id) do nothing;
    when 'task.assigned@1' then
      update project_tasks
        set assigned_by = e.payload->>'assigned_by',
            assigned_to = e.payload->>'assigned_to'
        where id = (e.payload->>'task_id')::uuid
             and estate_id = e.estate_id;
    when 'task.moved@1' then
      update project_tasks set status = e.payload->>'to'
        where id = (e.payload->>'task_id')::uuid
          and status in ('backlog','running','review','done','cancelled')
             and estate_id = e.estate_id;
    when 'task.closed@1' then
      update project_tasks
        set status = case when e.payload->>'outcome' = 'done' then 'done' else 'cancelled' end,
            closed_reason = e.payload->>'reason',
            finished_at = e.occurred_at
        where id = (e.payload->>'task_id')::uuid
             and estate_id = e.estate_id;
    when 'task.linked@1' then
      -- One concern, one function (CLAUDE.md). The arm used to hold the DAG
      -- rule inline and could not see the REL, so a provenance edge was tested
      -- against a dependency graph.
      perform apply_task_link(e);
    when 'task.note.added@1' then
      insert into task_notes (id, estate_id, project_id, task_id, author_kind, author_id, body_md, seq, created_at)
      values ((e.payload->>'note_id')::uuid, e.estate_id, e.project_id,
              (e.payload->>'task_id')::uuid, e.actor->>'kind', e.actor->>'id',
              e.payload->>'body_md', e.seq, e.occurred_at)
      on conflict (id) do nothing;
    when 'task.note.promoted@1' then
      update task_notes set promoted_fact_id = (e.payload->>'fact_id')::uuid
        where id = (e.payload->>'note_id')::uuid and promoted_fact_id is null
             and estate_id = e.estate_id;
    when 'task.brief.edited@1' then
      update project_tasks
        set brief_what     = case when e.payload->>'section' = 'what'     then e.payload->>'body_md' else brief_what end,
            brief_why      = case when e.payload->>'section' = 'why'      then e.payload->>'body_md' else brief_why end,
            brief_expected = case when e.payload->>'section' = 'expected' then e.payload->>'body_md' else brief_expected end,
            brief_author   = (e.actor->>'kind') || ':' || (e.actor->>'id'),
            brief_draft    = case when brief_draft is null and e.actor->>'kind' = 'agent'
                                  then jsonb_build_object('section', e.payload->>'section', 'body_md', e.payload->>'body_md')
                                  else brief_draft end
        where id = (e.payload->>'task_id')::uuid
             and estate_id = e.estate_id;

    when 'work.claimed@1' then
      if not exists(select 1 from project_tasks t where t.id=(e.payload->>'work')::uuid
        and t.estate_id=e.estate_id and t.project_id=e.project_id) then return; end if;
      -- Claims are attempts, read back after append. An expired/missing lease
      -- never proves that another generation stopped. Derive ownership from
      -- replayed Run receipts; caller booleans such as force/confirmed are not
      -- evidence. This also covers raw append_event callers and historical
      -- unsafe claim attempts during projection rebuild.
      if task_has_unresolved_run_at(e.estate_id,(e.payload->>'work')::uuid,(e.payload->>'owner')::uuid,e.seq) then return; end if;
      insert into leases (work_id, estate_id, project_id, owner_session,
                          idempotency_key, expires_at, write_scopes, claimed_seq)
      values ((e.payload->>'work')::uuid, e.estate_id, e.project_id,
              (e.payload->>'owner')::uuid, e.payload->>'idempotency_key',
              (e.payload->>'expires_at')::timestamptz,
              coalesce(array(select jsonb_array_elements_text(e.payload->'write_scopes')), '{}'),
              e.seq)
      on conflict (work_id) do update
        set owner_session = excluded.owner_session,
            idempotency_key = excluded.idempotency_key,
            expires_at = excluded.expires_at,
            write_scopes = excluded.write_scopes,
            claimed_seq = excluded.claimed_seq
        -- deterministic on replay: the takeover is judged against the event's
        -- own clock, never the wall clock.
        where leases.estate_id=e.estate_id and leases.expires_at <= e.occurred_at;
    when 'work.renewed@1' then
      update leases set expires_at = (e.payload->>'expires_at')::timestamptz
        where work_id = (e.payload->>'work')::uuid
          and owner_session = (e.payload->>'owner')::uuid
             and estate_id = e.estate_id;
    when 'work.released@1' then
      -- Releasing a coordination claim is not an observed process Stop. Keep
      -- managed ownership until its Run has a known terminal receipt.
      if task_has_unresolved_run_at(e.estate_id,(e.payload->>'work')::uuid,null,e.seq) then return; end if;
      delete from leases
        where work_id = (e.payload->>'work')::uuid
          and owner_session = (e.payload->>'owner')::uuid
             and estate_id = e.estate_id;

    when 'task.prioritised@1' then
      update project_tasks
        set goal_id = (e.payload->>'goal_id')::uuid,
            position = (e.payload->>'position')::integer
        where id = (e.payload->>'task_id')::uuid
             and estate_id = e.estate_id;

    when 'agent.registered@1' then
      -- Still nothing, and step 6 decided so ON PURPOSE rather than deferring
      -- again. The registry is `apps/desktop/src/shared/agents.ts`: code, not
      -- rows, because a row would let an agent be added at runtime and that is
      -- M17's job, which is not scheduled. A table nobody writes to is a schema
      -- pretending to be a feature. Return trigger: the first agent that must
      -- exist without a release.

    else
      null;
  end case;
end;
$$;

-- Last DB check before OS spawn; it never grants or renews spawn permission.
create function validate_task_run_launch(p_estate_id uuid,p_run_id uuid,p_session_id uuid,p_actor jsonb,
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
 if exists(select 1 from task_runs where estate_id=p_estate_id and task_id=r.task_id and task_run_id<>p_run_id and (state<>'ended' or outcome='outcome_unknown')) then
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

revoke all on function validate_task_run_launch(uuid,uuid,uuid,jsonb,uuid,bigint) from public,anon,authenticated;
grant execute on function validate_task_run_launch(uuid,uuid,uuid,jsonb,uuid,bigint) to service_role;

create or replace function acknowledge_delivery(p_estate_id uuid, p_session_id uuid,
  p_delivery_id uuid, p_digest text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d deliveries; c continuation_dispatches; e journal; r task_runs; t project_tasks;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text,4242));
  select * into d from deliveries where estate_id=p_estate_id and delivery_id=p_delivery_id;
  if not found or d.session_id is distinct from p_session_id or p_session_id is null
    then
    return jsonb_build_object('accepted',false,'reason_code','unknown_delivery');
  end if;
  if d.input_digest is distinct from p_digest then
    return jsonb_build_object('accepted',false,'reason_code','digest_mismatch');
  end if;
  if d.state='accepted' then
    return jsonb_build_object('accepted',true,'receipt_seq',d.ack_seq,'repeated',true);
  end if;
  select * into c from continuation_dispatches where delivery_id=p_delivery_id and estate_id=p_estate_id;
  if d.state not in ('written_unconfirmed','outcome_unknown') and not
    (d.state in ('queued','waiting_ready') and coalesce(c.state='write_started',false)) then
    return jsonb_build_object('accepted',false,'reason_code','not_written');
  end if;
  e:=append_event(p_estate_id,'delivery.accepted@1',jsonb_build_object('kind','agent','id',p_session_id),
    jsonb_build_object('delivery_id',p_delivery_id,'input_digest',p_digest,'source','agent',
      'task_id',d.task_id,'write_boundary','dispatch'), '1',d.project_id,null);
  select * into r from task_runs where estate_id=p_estate_id and task_run_id=c.task_run_id;
  select * into t from project_tasks where estate_id=p_estate_id and id=d.task_id for update;
  if r.task_run_id is not null and t.id is not null and r.task_id=t.id and r.session_id=p_session_id
    and t.session_id=p_session_id and r.state='active' and t.status in ('backlog','review')
    and not exists(select 1 from task_runs where estate_id=p_estate_id and task_id=t.id and run_ordinal>r.run_ordinal)
    and not exists(select 1 from question_blocks qb join questions q on q.estate_id=qb.estate_id and q.id=qb.question_id
      where qb.estate_id=p_estate_id and qb.task_id=t.id and q.answered_at is null) then
    perform append_event(p_estate_id,'task.moved@1',jsonb_build_object('kind','agent','id',p_session_id),
      jsonb_build_object('task_id',t.id,'to','running','task_run_id',r.task_run_id,'delivery_id',p_delivery_id),
      '1',r.project_id,r.task_run_id);
  end if;
  return jsonb_build_object('accepted',true,'receipt_seq',e.seq,'repeated',false);
end $$;
