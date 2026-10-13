-- #region resource-wait-store — docs: docs/execution/harness-waves/resource-wait-store.md#server-contract
-- PENDING ONLY. Requires pending107; does not join the active migration chain.
-- Lock order matches managed admission: Estate -> global session -> attempt ->
-- queue scope -> wait row/task. No second Estate or explicit pool FOR UPDATE;
-- foreign keys retain their normal PostgreSQL key-share locking.

create function resource_wait_int(v jsonb, minimum bigint default 0) returns boolean
language plpgsql immutable set search_path=public as $$
declare n numeric;
begin
 if jsonb_typeof(v) is distinct from 'number' then return false; end if;
 n:=v::text::numeric;
 return n>=minimum and n<=9007199254740991 and n=trunc(n);
end $$;
create function resource_wait_scope_valid(s jsonb) returns boolean
language plpgsql immutable set search_path=public as $$
begin
 if jsonb_typeof(s) is distinct from 'object' then return false; end if;
 if (select count(*) from jsonb_object_keys(s))<>3 or not(s ?& array['estateId','hostId','poolId']) then return false; end if;
 return jsonb_typeof(s->'estateId')='string' and s->>'estateId' ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  and jsonb_typeof(s->'hostId')='string' and s->>'hostId' ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
  and jsonb_typeof(s->'poolId')='string' and s->>'poolId' ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$';
end $$;
create function resource_wait_input_valid(i jsonb) returns boolean
language plpgsql immutable set search_path=public as $$
declare k text;
begin
 if jsonb_typeof(i) is distinct from 'object' then return false; end if;
 if (select count(*) from jsonb_object_keys(i))<>15 or not(i ?& array['scope','id','taskId','sessionId','attemptId','ownerId','fence','inputDigest','scopeDigest','conditionKey','resumePoint','action','demand','createdAt','deadlineAt']) then return false; end if;
 if resource_wait_scope_valid(i->'scope') is distinct from true then return false; end if;
 foreach k in array array['id','attemptId','ownerId','conditionKey','resumePoint'] loop
  if jsonb_typeof(i->k) is distinct from 'string' or i->>k !~ '^[A-Za-z0-9_.:-]{1,160}$' then return false; end if;
 end loop;
 foreach k in array array['taskId','sessionId'] loop
  if jsonb_typeof(i->k) is distinct from 'string' or i->>k !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then return false; end if;
 end loop;
 foreach k in array array['inputDigest','scopeDigest'] loop
  if jsonb_typeof(i->k) is distinct from 'string' or i->>k !~ '^[a-f0-9]{64}$' then return false; end if;
 end loop;
 if i->>'action' is distinct from 'managed_task_launch' or not resource_wait_int(i->'fence',1)
  or not resource_wait_int(i->'createdAt') or not resource_wait_int(i->'deadlineAt')
  or (i->>'deadlineAt')::numeric<=(i->>'createdAt')::numeric
  or resource_vector_valid(i->'demand') is distinct from true or not resource_wait_int(i->'demand'->'workerSlots',1) then return false; end if;
 return true;
end $$;

create table resource_wait_scopes (
 estate_id uuid not null, host_id text not null, pool_id text not null,
 max_rows bigint not null check(max_rows between 1 and 9007199254740991),
 last_ordinal bigint not null default 0 check(last_ordinal between 0 and 9007199254740991),
 primary key(estate_id,host_id,pool_id),
 foreign key(host_id,pool_id) references resource_pools(host_id,pool_id)
);
create table resource_wait_rows (
 estate_id uuid not null, host_id text not null, pool_id text not null, id text not null,
 input jsonb not null check(resource_wait_input_valid(input)),
 task_id uuid not null, session_id uuid not null unique, attempt_id text not null unique,
 project_id uuid not null,
 ordinal bigint not null check(ordinal between 1 and 9007199254740991),
 revision bigint not null check(revision between 1 and 9007199254740991),
 state text not null check(state in ('waiting','claimed','dispatch_started','outcome_unknown','dispatched','refused_before_start','cancelled','expired','invalidated')),
 updated_at bigint not null, next_check_at bigint not null, claim jsonb,
 primary key(estate_id,host_id,pool_id,id),
 unique(estate_id,host_id,pool_id,ordinal),
 foreign key(estate_id,host_id,pool_id) references resource_wait_scopes(estate_id,host_id,pool_id)
);
create unique index resource_wait_one_active_task on resource_wait_rows(task_id)
 where state in ('waiting','claimed','dispatch_started','outcome_unknown');
create index resource_wait_fifo on resource_wait_rows(estate_id,host_id,pool_id,ordinal)
 where state in ('waiting','claimed','dispatch_started','outcome_unknown');
alter table resource_wait_scopes enable row level security;
alter table resource_wait_rows enable row level security;
revoke all on resource_wait_scopes,resource_wait_rows from public,anon,authenticated,service_role;

create function resource_wait_record(r resource_wait_rows) returns jsonb
language sql immutable set search_path=public as $$
 select jsonb_build_object('input',r.input,'ordinal',r.ordinal,'revision',r.revision,'state',r.state,
  'updatedAt',r.updated_at,'nextCheckAt',r.next_check_at,'claim',r.claim)
$$;
create function resource_wait_never_started(i jsonb) returns boolean
language sql volatile security definer set search_path=public as $$
 select exists(select 1 from project_tasks t where t.id=(i->>'taskId')::uuid
  and t.estate_id=(i->'scope'->>'estateId')::uuid and t.project_id is not null
  and t.status in ('backlog','open') and t.session_id is null)
 and not exists(select 1 from task_runs where task_id=(i->>'taskId')::uuid or session_id=(i->>'sessionId')::uuid)
 and not exists(select 1 from project_tasks where session_id=(i->>'sessionId')::uuid)
 and not exists(select 1 from resource_reservations where session_id=(i->>'sessionId')::uuid or binding->>'attemptId'=i->>'attemptId')
 and not exists(select 1 from journal where type in ('terminal.opened@1','terminal.closed@1','session.enrolled@1') and payload->>'session_id'=i->>'sessionId')
 and not exists(select 1 from journal where type in ('task.admitted@1','run.started@1')
  and (payload->>'task_id'=i->>'taskId' or payload->>'session_id'=i->>'sessionId'))
$$;
create function configure_resource_wait_queue(p_scope jsonb,p_max_rows bigint) returns boolean
language plpgsql security definer set search_path=public as $$
declare e uuid; h text; p text; total bigint;
begin
 if resource_wait_scope_valid(p_scope) is distinct from true or p_max_rows is null or p_max_rows not between 1 and 9007199254740991 then return false; end if;
 e:=(p_scope->>'estateId')::uuid; h:=p_scope->>'hostId'; p:=p_scope->>'poolId';
 perform pg_advisory_xact_lock(hashtextextended(e::text,4242));
 if not exists(select 1 from resource_pools where host_id=h and pool_id=p) then return false; end if;
 insert into resource_wait_scopes(estate_id,host_id,pool_id,max_rows) values(e,h,p,p_max_rows) on conflict do nothing;
 perform 1 from resource_wait_scopes where estate_id=e and host_id=h and pool_id=p for update;
 select count(*) into total from resource_wait_rows where estate_id=e and host_id=h and pool_id=p;
 if p_max_rows<total then return false; end if;
 update resource_wait_scopes set max_rows=p_max_rows where estate_id=e and host_id=h and pool_id=p;
 return true;
end $$;

create function resource_wait_insert(p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare i jsonb:=p_input; s jsonb; e uuid; h text; p text; r resource_wait_rows; q resource_wait_scopes;
 t project_tasks; ms bigint; k text;
begin
 if resource_wait_input_valid(i) is distinct from true then return jsonb_build_object('ok',false); end if;
 -- Canonical integral JSON avoids decimal-scale differences in later wire receipts.
 foreach k in array array['fence','createdAt','deadlineAt'] loop i:=jsonb_set(i,array[k],to_jsonb((i->>k)::numeric::bigint)); end loop;
 s:=i->'scope'; e:=(s->>'estateId')::uuid; h:=s->>'hostId'; p:=s->>'poolId';
 perform pg_advisory_xact_lock(hashtextextended(e::text,4242));
 perform pg_advisory_xact_lock(hashtextextended(i->>'sessionId',6061));
 perform pg_advisory_xact_lock(hashtextextended(i->>'attemptId',6108));
 select * into q from resource_wait_scopes where estate_id=e and host_id=h and pool_id=p for update;
 if not found then return jsonb_build_object('ok',false); end if;
 select * into r from resource_wait_rows where estate_id=e and host_id=h and pool_id=p and id=i->>'id';
 if found then
  if r.input<>i then return jsonb_build_object('ok',false); end if;
  return jsonb_build_object('ok',true,'record',resource_wait_record(r));
 end if;
 if exists(select 1 from resource_wait_rows where session_id=(i->>'sessionId')::uuid or attempt_id=i->>'attemptId'
  or (task_id=(i->>'taskId')::uuid and state in ('waiting','claimed','dispatch_started','outcome_unknown')))
  or q.last_ordinal>=9007199254740991
  or (select count(*) from resource_wait_rows where estate_id=e and host_id=h and pool_id=p)>=q.max_rows then
  return jsonb_build_object('ok',false); end if;
 ms:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
 if (i->>'createdAt')::bigint>ms or (i->>'deadlineAt')::bigint<=ms then return jsonb_build_object('ok',false); end if;
 select * into t from project_tasks where estate_id=e and id=(i->>'taskId')::uuid for update;
 if resource_wait_never_started(i) is distinct from true then return jsonb_build_object('ok',false); end if;
 update resource_wait_scopes set last_ordinal=last_ordinal+1 where estate_id=e and host_id=h and pool_id=p returning * into q;
 insert into resource_wait_rows(estate_id,host_id,pool_id,id,input,task_id,session_id,attempt_id,project_id,ordinal,revision,state,updated_at,next_check_at)
 values(e,h,p,i->>'id',i,(i->>'taskId')::uuid,(i->>'sessionId')::uuid,i->>'attemptId',t.project_id,q.last_ordinal,1,'waiting',ms,ms) returning * into r;
 return jsonb_build_object('ok',true,'record',resource_wait_record(r));
end $$;

create function resource_wait_read(p_scope jsonb,p_id text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r resource_wait_rows;
begin
 if resource_wait_scope_valid(p_scope) is distinct from true or p_id is null or p_id !~ '^[A-Za-z0-9_.:-]{1,160}$' then return jsonb_build_object('ok',false); end if;
 select * into r from resource_wait_rows where estate_id=(p_scope->>'estateId')::uuid and host_id=p_scope->>'hostId' and pool_id=p_scope->>'poolId' and id=p_id;
 return jsonb_build_object('ok',true,'record',case when found then resource_wait_record(r) else null end);
end $$;
create function resource_wait_page(p_scope jsonb,p_limit integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare rows jsonb; more boolean;
begin
 if resource_wait_scope_valid(p_scope) is distinct from true or p_limit is null or p_limit not between 1 and 100
  or not exists(select 1 from resource_wait_scopes where estate_id=(p_scope->>'estateId')::uuid and host_id=p_scope->>'hostId' and pool_id=p_scope->>'poolId') then return jsonb_build_object('ok',false); end if;
 -- One statement snapshot, including unknown/begun heads. Never SKIP LOCKED.
 with bounded as (select r from resource_wait_rows r where estate_id=(p_scope->>'estateId')::uuid
  and host_id=p_scope->>'hostId' and pool_id=p_scope->>'poolId'
  and state in ('waiting','claimed','dispatch_started','outcome_unknown') order by ordinal limit p_limit+1),
 numbered as (select r,row_number() over(order by (r).ordinal) n from bounded)
 select coalesce(jsonb_agg(resource_wait_record(r) order by (r).ordinal) filter(where n<=p_limit),'[]'::jsonb),coalesce(bool_or(n>p_limit),false)
 into rows,more from numbered;
 return jsonb_build_object('ok',true,'rows',rows,'more',more);
end $$;

create function resource_wait_cas(p_scope jsonb,p_id text,p_revision bigint,p_next jsonb) returns boolean
language plpgsql security definer set search_path=public as $$
declare r resource_wait_rows; i jsonb; e uuid; h text; p text; ms bigint; target text; c jsonb; k text; n numeric; run task_runs;
begin
 if resource_wait_scope_valid(p_scope) is distinct from true or p_id is null or p_revision is null or p_revision not between 1 and 9007199254740990
  or jsonb_typeof(p_next) is distinct from 'object' then return false; end if;
 if (select count(*) from jsonb_object_keys(p_next))<>7 or not(p_next ?& array['input','ordinal','revision','state','updatedAt','nextCheckAt','claim']) then return false; end if;
 if resource_wait_input_valid(p_next->'input') is distinct from true or jsonb_typeof(p_next->'state') is distinct from 'string' then return false; end if;
 foreach k in array array['ordinal','revision','updatedAt','nextCheckAt'] loop
  if not resource_wait_int(p_next->k,case when k in ('ordinal','revision') then 1 else 0 end) then return false; end if;
 end loop;
 e:=(p_scope->>'estateId')::uuid; h:=p_scope->>'hostId'; p:=p_scope->>'poolId';
 perform pg_advisory_xact_lock(hashtextextended(e::text,4242));
 select * into r from resource_wait_rows where estate_id=e and host_id=h and pool_id=p and id=p_id;
 if not found then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended(r.session_id::text,6061));
 perform pg_advisory_xact_lock(hashtextextended(r.attempt_id,6108));
 perform 1 from resource_wait_scopes where estate_id=e and host_id=h and pool_id=p for update;
 select * into r from resource_wait_rows where estate_id=e and host_id=h and pool_id=p and id=p_id for update;
 ms:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
 if r.revision<>p_revision or (p_next->>'revision')::bigint<>p_revision+1 or (p_next->>'ordinal')::bigint<>r.ordinal
  or p_next->'input'<>r.input or p_next->'input'->'scope'<>p_scope
  or (p_next->>'updatedAt')::bigint<r.updated_at or (p_next->>'updatedAt')::bigint>ms then return false; end if;
 target:=p_next->>'state'; c:=p_next->'claim';
 if c<>'null'::jsonb then
  if jsonb_typeof(c) is distinct from 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(c))<>2 or not(c ?& array['workerId','until']) then return false; end if;
  if jsonb_typeof(c->'workerId') is distinct from 'string' or c->>'workerId' !~ '^[A-Za-z0-9_.:-]{1,160}$'
   or not resource_wait_int(c->'until') then return false; end if;
 end if;
 if r.state in ('dispatched','refused_before_start','cancelled','expired','invalidated','outcome_unknown') then return false; end if;
 if target='claimed' then
  if r.state not in ('waiting','claimed') or (r.state='claimed' and (r.claim->>'until')::bigint>ms)
   or r.next_check_at>ms or (r.input->>'deadlineAt')::bigint<=ms or c='null'::jsonb
   or (c->>'until')::bigint<=ms or (c->>'until')::bigint>ms+300000
   or (p_next->>'nextCheckAt')::bigint<>r.next_check_at
   or exists(select 1 from resource_wait_rows where estate_id=e and host_id=h and pool_id=p
    and state in ('waiting','claimed','dispatch_started','outcome_unknown') and ordinal<r.ordinal) then return false; end if;
 elsif target='dispatch_started' then
  if r.state<>'claimed' or c is distinct from r.claim or (r.claim->>'until')::bigint<=ms
   or (r.input->>'deadlineAt')::bigint<=ms or (p_next->>'nextCheckAt')::bigint<>r.next_check_at
   or exists(select 1 from resource_wait_rows where estate_id=e and host_id=h and pool_id=p
    and state in ('waiting','claimed','dispatch_started','outcome_unknown') and ordinal<r.ordinal)
   or resource_wait_never_started(r.input) is distinct from true then return false; end if;
 elsif target='waiting' then
  if r.state<>'claimed' or c<>'null'::jsonb then return false; end if;
 elsif target in ('cancelled','expired','invalidated') then
  if r.state not in ('waiting','claimed') or c<>'null'::jsonb
   or (target='expired' and (r.input->>'deadlineAt')::bigint>ms) then return false; end if;
 elsif target in ('dispatched','refused_before_start','outcome_unknown') then
  if r.state<>'dispatch_started' or c is distinct from r.claim or (p_next->>'nextCheckAt')::bigint<>r.next_check_at then return false; end if;
  if target='dispatched' then
   select * into run from task_runs where estate_id=e and task_id=r.task_id and session_id=r.session_id order by run_ordinal desc limit 1;
   if not found or run.state<>'active' then return false; end if;
  elsif target='refused_before_start' then
   -- Absence of a run is safe only while the task/session has never been admitted.
   -- Otherwise require exact compensated generation plus released/no reservation.
   if resource_wait_never_started(r.input) is distinct from true then
    select * into run from task_runs where estate_id=e and task_id=r.task_id and session_id=r.session_id order by run_ordinal desc limit 1;
    if not found or run.state<>'ended' or run.outcome<>'failed_known'
     or not exists(select 1 from run_launch_compensations c where c.estate_id=e and c.task_run_id=run.task_run_id and c.session_id=r.session_id and c.receipt_seq=run.ended_seq)
     or exists(select 1 from resource_reservations where session_id=r.session_id and state<>'released') then return false; end if;
   end if;
  end if;
 else return false;
 end if;
 update resource_wait_rows set revision=p_revision+1,state=target,updated_at=(p_next->>'updatedAt')::bigint,
  next_check_at=(p_next->>'nextCheckAt')::bigint,claim=nullif(c,'null'::jsonb)
  where estate_id=e and host_id=h and pool_id=p and id=p_id;
 return true;
end $$;

revoke all on function resource_wait_int(jsonb,bigint),resource_wait_scope_valid(jsonb),resource_wait_input_valid(jsonb),
 resource_wait_record(resource_wait_rows),resource_wait_never_started(jsonb),configure_resource_wait_queue(jsonb,bigint),
 resource_wait_insert(jsonb),resource_wait_read(jsonb,text),resource_wait_page(jsonb,integer),resource_wait_cas(jsonb,text,bigint,jsonb)
 from public,anon,authenticated,service_role;
grant execute on function configure_resource_wait_queue(jsonb,bigint),resource_wait_insert(jsonb),resource_wait_read(jsonb,text),
 resource_wait_page(jsonb,integer),resource_wait_cas(jsonb,text,bigint,jsonb) to service_role;
-- #endregion resource-wait-store
