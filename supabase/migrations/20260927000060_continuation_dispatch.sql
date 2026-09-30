-- Operational dispatch fences survive process crashes. A lease may be stolen
-- before begin, never after begin. The terminal is not a transactional consumer:
-- crossing begin without a completion receipt means UNKNOWN, not safe to retry.
create table continuation_dispatches (
  delivery_id uuid primary key,
  estate_id uuid not null,
  project_id uuid not null,
  task_run_id uuid not null,
  claim_id uuid not null,
  state text not null check (state in ('reserved','write_started','written','failed_before_write','outcome_unknown')),
  lease_until timestamptz not null,
  updated_at timestamptz not null default clock_timestamp()
);
alter table continuation_dispatches enable row level security;
revoke all on continuation_dispatches from public, anon, authenticated, service_role;
grant select on continuation_dispatches to service_role;

-- These events change the delivery projection; dispatch ownership itself is
-- operational authority and is deliberately not reconstructed from old events.
insert into event_types(type, projects, note) values
  ('delivery.failed_before_write@1', true, 'transport proved that no instruction bytes were written'),
  ('delivery.retrying@1', true, 'a fenced retry after proof of no write')
on conflict (type) do nothing;

create or replace function apply_deliveries(e journal)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(e.payload->>'delivery_id', '')::uuid;
begin
  if v_id is null then return; end if;
  if e.type = 'delivery.queued@1' then
    insert into deliveries(delivery_id,estate_id,project_id,task_id,session_id,input_digest,state,queued_seq)
    values(v_id,e.estate_id,e.project_id,(e.payload->>'task_id')::uuid,
      nullif(e.payload->>'session_id','')::uuid,e.payload->>'input_digest','queued',e.seq)
    on conflict(delivery_id) do nothing;
  elsif e.type = 'delivery.written@1' then
    update deliveries set state='written_unconfirmed',written_seq=e.seq
      where estate_id=e.estate_id and delivery_id=v_id and state in ('queued','waiting_ready');
  elsif e.type = 'delivery.accepted@1' then
    update deliveries set state='accepted',ack_source=coalesce(e.payload->>'source','agent'),ack_seq=e.seq
      where estate_id=e.estate_id and delivery_id=v_id and input_digest=e.payload->>'input_digest'
        and (state in ('written_unconfirmed','outcome_unknown')
          or (state in ('queued','waiting_ready') and e.payload->>'write_boundary'='dispatch'));
  elsif e.type = 'delivery.unknown@1' then
    update deliveries set state='outcome_unknown' where estate_id=e.estate_id and delivery_id=v_id
      and state in ('queued','waiting_ready','written_unconfirmed');
  elsif e.type = 'delivery.failed_before_write@1' then
    update deliveries set state='failed_before_write' where estate_id=e.estate_id and delivery_id=v_id
      and state in ('queued','waiting_ready');
  elsif e.type = 'delivery.retrying@1' then
    update deliveries set state='queued' where estate_id=e.estate_id and delivery_id=v_id
      and state='failed_before_write';
  end if;
end $$;

create function continuation_dispatch(
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
    if not found or r.task_run_id<>p_run_id or r.session_id is distinct from p_session_id or r.state='ended' then
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
    if not found or r.task_run_id<>p_run_id or r.session_id is distinct from p_session_id or r.state='ended' then
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
revoke all on function continuation_dispatch(uuid,jsonb,uuid,uuid,uuid,uuid,text,uuid,text,uuid,bigint) from public,anon,authenticated;
grant execute on function continuation_dispatch(uuid,jsonb,uuid,uuid,uuid,uuid,text,uuid,text,uuid,bigint) to service_role;

-- ACK may beat the writer's post-write transaction. Only the bound session can
-- confirm the exact digest, and a durable begin must already exist for an early
-- ACK. Its journal payload preserves this evidence on projection-only replay.
create function acknowledge_delivery(p_estate_id uuid, p_session_id uuid,
  p_delivery_id uuid, p_digest text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d deliveries; c continuation_dispatches; e journal;
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
  return jsonb_build_object('accepted',true,'receipt_seq',e.seq,'repeated',false);
end $$;
revoke all on function acknowledge_delivery(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function acknowledge_delivery(uuid,uuid,uuid,text) to service_role;
