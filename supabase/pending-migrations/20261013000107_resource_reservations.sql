-- #region local-resource-reservation — docs: docs/execution/harness-waves/resource-reservation.md#authority-and-state
-- Pending, NOT part of the active migration chain. COM-03 applied104; preserve reserved105–106.
-- Internal Fabric authority, not a portable contract. The trusted host configures the pool
-- and reports observations. Agents/renderer cannot write these operational tables or RPCs.
-- Lock order: Estate -> session/reservation identity -> pool row -> task locks. A pool
-- transaction never takes another Estate's lock. Release follows the same order.

create function resource_vector_valid(v jsonb) returns boolean
language plpgsql immutable set search_path=public as $$
declare k text; n numeric;
begin
 if v is null or jsonb_typeof(v)<>'object' or (select count(*) from jsonb_object_keys(v))<>4 then return false; end if;
 foreach k in array array['workerSlots','memoryBytes','diskBytes','cpuMilliCores'] loop
  if jsonb_typeof(v->k) is distinct from 'number' then return false; end if;
  n:=(v->>k)::numeric;
  if n<0 or n>9007199254740991 or n<>trunc(n) then return false; end if;
 end loop;
 return true;
end $$;

create table resource_pools (
 host_id text not null check(length(host_id) between 1 and 128),
 pool_id text not null check(length(pool_id) between 1 and 128),
 policy_revision text not null check(length(policy_revision) between 1 and 128),
 capacity jsonb not null check(resource_vector_valid(capacity)),
 max_age_ms bigint not null check(max_age_ms between 1 and 9007199254740991),
 observed jsonb check(observed is null or resource_vector_valid(observed)),
 observed_at timestamptz,
 primary key(host_id,pool_id),
 check((observed is null)=(observed_at is null))
);
create table resource_reservations (
 reservation_id text primary key,
 estate_id uuid not null,
 task_id uuid not null,
 task_run_id uuid not null unique,
 session_id uuid not null unique,
 run_ordinal integer not null,
 host_id text not null,
 pool_id text not null,
 parent_id text references resource_reservations(reservation_id),
 binding jsonb not null,
 demand jsonb not null check(resource_vector_valid(demand)),
 own_demand jsonb not null check(resource_vector_valid(own_demand)),
 admitted_seq bigint not null,
 state text not null default 'held' check(state in ('held','released')),
 released_seq bigint,
 foreign key(host_id,pool_id) references resource_pools(host_id,pool_id),
 check((state='released')=(released_seq is not null))
);
create index resource_reservations_pool on resource_reservations(host_id,pool_id) where state='held';
create index resource_reservations_parent on resource_reservations(parent_id) where state='held';
-- Bound recovery keyset reads to the trusted scope without sorting all held work.
create index resource_reservations_recovery on resource_reservations(estate_id,host_id,pool_id,admitted_seq) where state='held';
alter table resource_pools enable row level security;
alter table resource_reservations enable row level security;
revoke all on resource_pools,resource_reservations from public,anon,authenticated,service_role;
grant select on resource_pools,resource_reservations to service_role;
-- The explicit read grant works even when a service role has no global BYPASSRLS.
-- Renderer/API roles retain no table privileges; writes remain security-definer RPCs.
create policy resource_pools_service_read on resource_pools for select to service_role using(true);
create policy resource_reservations_service_read on resource_reservations for select to service_role using(true);

-- Explicit trusted configuration only. No implicit machine-wide pool/default and no
-- caller-selected capacity on admission. A policy cannot change beneath held work.
create function configure_resource_pool(p_host text,p_pool text,p_revision text,p_capacity jsonb,p_max_age_ms bigint)
returns boolean language plpgsql security definer set search_path=public as $$
declare previous resource_pools;
begin
 if p_host is null or p_host !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' or p_pool is null or p_pool !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
  or p_revision is null or p_revision !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' or not resource_vector_valid(p_capacity)
  or p_max_age_ms is null or p_max_age_ms not between 1 and 9007199254740991 then return false; end if;
 insert into resource_pools(host_id,pool_id,policy_revision,capacity,max_age_ms)
 values(p_host,p_pool,p_revision,p_capacity,p_max_age_ms) on conflict do nothing;
 select * into previous from resource_pools where host_id=p_host and pool_id=p_pool for update;
 if previous.policy_revision=p_revision and previous.capacity=p_capacity and previous.max_age_ms=p_max_age_ms then return true; end if;
 if previous.policy_revision=p_revision or exists(select 1 from resource_reservations where host_id=p_host and pool_id=p_pool and state='held') then return false; end if;
 update resource_pools set policy_revision=p_revision,capacity=p_capacity,max_age_ms=p_max_age_ms,observed=null,observed_at=null
 where host_id=p_host and pool_id=p_pool;
 return true;
end $$;

-- observed is total external/host usage, conservatively charged in addition to reservations.
-- No overlap credit is accepted until a sampler can bind it to exact reservation identities.
create function observe_resource_pool(p_host text,p_pool text,p_revision text,p_observed jsonb,p_at timestamptz)
returns boolean language plpgsql security definer set search_path=public as $$
declare pool resource_pools;
begin
 select * into pool from resource_pools where host_id=p_host and pool_id=p_pool for update;
 if not found or pool.policy_revision is distinct from p_revision or not resource_vector_valid(p_observed)
  or p_at is null or p_at>clock_timestamp() or (p_at=pool.observed_at and p_observed<>pool.observed) or (pool.observed_at is not null and p_at<pool.observed_at) then return false; end if;
 update resource_pools set observed=p_observed,observed_at=p_at where host_id=p_host and pool_id=p_pool;
 return true;
end $$;

create function resource_pool_problem(p_host text,p_pool text,p_revision text,p_extra jsonb)
returns text language plpgsql security definer set search_path=public as $$
declare pool resource_pools; k text; held numeric;
begin
 select * into pool from resource_pools where host_id=p_host and pool_id=p_pool for update;
 if not found then return 'resource_pool_unknown'; end if;
 if pool.policy_revision is distinct from p_revision then return 'resource_policy_changed'; end if;
 if pool.observed is null or pool.observed_at>clock_timestamp()
  or extract(epoch from clock_timestamp()-pool.observed_at)*1000>pool.max_age_ms then return 'resource_reading_unknown'; end if;
 foreach k in array array['workerSlots','memoryBytes','diskBytes','cpuMilliCores'] loop
  select coalesce(sum((demand->>k)::numeric),0) into held from resource_reservations
   where host_id=p_host and pool_id=p_pool and state='held' and parent_id is null;
  if held+(pool.observed->>k)::numeric+(p_extra->>k)::numeric>(pool.capacity->>k)::numeric then return 'resource_capacity'; end if;
 end loop;
 return null;
end $$;

insert into event_types(type,projects,note) values
 ('resource.reserved@1',true,'local reservation binding marker; operational ledger, never this payload, grants capacity')
on conflict(type) do nothing;

create function admit_resource_task_launch(p_estate_id uuid,p_task_id uuid,p_actor jsonb,p_session_id uuid,
 p_host text,p_pool text,p_binding jsonb,p_demand jsonb,p_own_demand jsonb,p_parent text default null,
 p_trigger text default 'operator',p_person_id uuid default null,p_revision bigint default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare held resource_reservations; parent resource_reservations; answer jsonb; problem text; k text; used numeric; rid text;
 zero constant jsonb:='{"workerSlots":0,"memoryBytes":0,"diskBytes":0,"cpuMilliCores":0}';
begin
 perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text,4242));
 if p_session_id is null or p_task_id is null or p_estate_id is null or not resource_vector_valid(p_demand) or not resource_vector_valid(p_own_demand)
  or jsonb_typeof(p_binding) is distinct from 'object' then
  return jsonb_build_object('admitted',false,'reason_code','resource_input_invalid'); end if;
 if (select count(*) from jsonb_object_keys(p_binding))<>8 then return jsonb_build_object('admitted',false,'reason_code','resource_input_invalid'); end if;
 foreach k in array array['reservationId','attemptId','ownerId','role','inputDigest','scopeDigest','localPolicyRevision'] loop
  if jsonb_typeof(p_binding->k) is distinct from 'string' or (p_binding->>k) !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
   return jsonb_build_object('admitted',false,'reason_code','resource_input_invalid'); end if;
 end loop;
 if p_binding->>'role' not in ('builder','reviewer','test') or p_binding->>'inputDigest' !~ '^[a-f0-9]{64}$'
  or p_binding->>'scopeDigest' !~ '^[a-f0-9]{64}$' then return jsonb_build_object('admitted',false,'reason_code','resource_input_invalid'); end if;
 if jsonb_typeof(p_binding->'fence') is distinct from 'number' then return jsonb_build_object('admitted',false,'reason_code','resource_input_invalid'); end if;
 if (p_binding->>'fence')::numeric not between 1 and 9007199254740991 or (p_binding->>'fence')::numeric<>trunc((p_binding->>'fence')::numeric) then return jsonb_build_object('admitted',false,'reason_code','resource_input_invalid'); end if;
 -- JSONB preserves numeric scale (1.0), while the typed caller sends fence as
 -- canonical integer text (1). Normalize only after the safe-integer check,
 -- before retry comparison and storage, so release/cancel name the same fence.
 p_binding:=jsonb_set(p_binding,'{fence}',to_jsonb((p_binding->>'fence')::numeric::bigint));
 foreach k in array array['workerSlots','memoryBytes','diskBytes','cpuMilliCores'] loop
  if (p_own_demand->>k)::numeric>(p_demand->>k)::numeric then return jsonb_build_object('admitted',false,'reason_code','resource_input_invalid'); end if;
 end loop;
 if (p_own_demand->>'workerSlots')::numeric<1 then return jsonb_build_object('admitted',false,'reason_code','resource_input_invalid'); end if;
 rid:=p_binding->>'reservationId';
 -- Same global session lock as ordinary admission prevents two pools charging one attempt.
 -- Pool first is unnecessary here: this lock does not acquire another Estate or pool.
 perform pg_advisory_xact_lock(hashtextextended(p_session_id::text,6061));
 perform pg_advisory_xact_lock(hashtextextended(rid,6107));
 select * into held from resource_reservations where session_id=p_session_id or reservation_id=rid;
 if found then
  if held.estate_id is distinct from p_estate_id or held.task_id is distinct from p_task_id or held.session_id is distinct from p_session_id or held.host_id is distinct from p_host or held.pool_id is distinct from p_pool
   or held.binding<>p_binding or held.demand<>p_demand or held.own_demand<>p_own_demand or held.parent_id is distinct from p_parent then
   return jsonb_build_object('admitted',false,'reason_code','resource_identity_conflict'); end if;
  answer:=admit_task_launch(p_estate_id,p_task_id,p_actor,p_session_id,p_trigger,p_person_id,p_revision);
  if answer->>'admitted'<>'true' then return answer; end if;
  return answer||jsonb_build_object('resource_reservation',jsonb_build_object('reservation_id',rid,'state',held.state,'run_ordinal',held.run_ordinal));
 end if;
 -- Already admitted via a legacy path must not be retroactively upgraded into a second authority.
 if exists(select 1 from journal where type='task.admitted@1' and payload->>'session_id'=p_session_id::text) then
  return jsonb_build_object('admitted',false,'reason_code','resource_admission_missing'); end if;
 problem:=resource_pool_problem(p_host,p_pool,p_binding->>'localPolicyRevision',case when p_parent is null then p_demand else zero end);
 if problem is not null then return jsonb_build_object('admitted',false,'reason_code',problem); end if;
 if p_parent is not null then
  select * into parent from resource_reservations where reservation_id=p_parent for update;
  if not found or parent.state<>'held' or parent.estate_id<>p_estate_id or parent.host_id<>p_host or parent.pool_id<>p_pool
   or parent.binding->>'ownerId'<>p_binding->>'ownerId' or parent.binding->>'localPolicyRevision'<>p_binding->>'localPolicyRevision'
   or not run_ownership_unresolved(parent.estate_id,parent.task_run_id) then
   return jsonb_build_object('admitted',false,'reason_code','resource_parent_invalid'); end if;
  -- A parent's demand is an envelope for itself and descendants; children subdivide it.
  -- No increase to the root's pool charge is possible through nested reservations.
  foreach k in array array['workerSlots','memoryBytes','diskBytes','cpuMilliCores'] loop
   select coalesce(sum((demand->>k)::numeric),0) into used from resource_reservations where parent_id=p_parent and state='held';
   if used+(parent.own_demand->>k)::numeric+(p_demand->>k)::numeric>(parent.demand->>k)::numeric then
    return jsonb_build_object('admitted',false,'reason_code','resource_parent_capacity'); end if;
  end loop;
 end if;
 answer:=admit_task_launch(p_estate_id,p_task_id,p_actor,p_session_id,p_trigger,p_person_id,p_revision);
 if answer->>'admitted'<>'true' then return answer; end if;
 insert into resource_reservations(reservation_id,estate_id,task_id,task_run_id,session_id,run_ordinal,host_id,pool_id,parent_id,binding,demand,own_demand,admitted_seq)
 values(rid,p_estate_id,p_task_id,(answer->>'task_run_id')::uuid,p_session_id,(answer->>'run_ordinal')::int,p_host,p_pool,p_parent,p_binding,p_demand,p_own_demand,(answer->>'receipt_seq')::bigint);
 perform append_event(p_estate_id,'resource.reserved@1',p_actor,jsonb_build_object('task_run_id',answer->>'task_run_id','task_id',p_task_id,'session_id',p_session_id,'reservation_id',rid),'1',(answer->>'project_id')::uuid,(answer->>'task_run_id')::uuid);
 return answer||jsonb_build_object('resource_reservation',jsonb_build_object('reservation_id',rid,'state','held','run_ordinal',(answer->>'run_ordinal')::int));
end $$;

-- Marker replay may require the ledger, but can never recreate its authority. A restored
-- resource admission without operational state refuses rather than silently using legacy mode.
create function resource_launch_problem(p_estate uuid,p_run uuid,p_session uuid) returns text
language plpgsql security definer set search_path=public as $$
declare held resource_reservations; problem text;
begin
 select * into held from resource_reservations where task_run_id=p_run;
 if not found then
  if exists(select 1 from journal where estate_id=p_estate and type='resource.reserved@1' and payload->>'task_run_id'=p_run::text) then return 'resource_reservation_unknown'; end if;
  return null;
 end if;
 if held.estate_id is distinct from p_estate or held.session_id is distinct from p_session or held.state<>'held' then return 'resource_reservation_changed'; end if;
 problem:=resource_pool_problem(held.host_id,held.pool_id,held.binding->>'localPolicyRevision','{"workerSlots":0,"memoryBytes":0,"diskBytes":0,"cpuMilliCores":0}');
 return problem;
end $$;

-- Preserve the exact migration62 authority/generation protocol under these wrappers.
alter function begin_task_run_launch(uuid,uuid,uuid,jsonb,uuid,bigint) rename to begin_task_run_launch_before_resources;
alter function validate_task_run_launch(uuid,uuid,uuid,jsonb,uuid,bigint) rename to validate_task_run_launch_before_resources;
revoke all on function begin_task_run_launch_before_resources(uuid,uuid,uuid,jsonb,uuid,bigint),validate_task_run_launch_before_resources(uuid,uuid,uuid,jsonb,uuid,bigint) from public,anon,authenticated,service_role;
create function begin_task_run_launch(p_estate_id uuid,p_run_id uuid,p_session_id uuid,p_actor jsonb,p_person_id uuid default null,p_revision bigint default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare problem text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text,4242));
 problem:=resource_launch_problem(p_estate_id,p_run_id,p_session_id);
 if problem is not null then return jsonb_build_object('granted',false,'reason_code',problem); end if;
 return begin_task_run_launch_before_resources(p_estate_id,p_run_id,p_session_id,p_actor,p_person_id,p_revision);
end $$;
create function validate_task_run_launch(p_estate_id uuid,p_run_id uuid,p_session_id uuid,p_actor jsonb,p_person_id uuid default null,p_revision bigint default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare problem text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text,4242));
 problem:=resource_launch_problem(p_estate_id,p_run_id,p_session_id);
 if problem is not null then return jsonb_build_object('valid',false,'reason_code',problem); end if;
 return validate_task_run_launch_before_resources(p_estate_id,p_run_id,p_session_id,p_actor,p_person_id,p_revision);
end $$;

create function release_resource_reservation(p_estate uuid,p_reservation text,p_run uuid,p_session uuid,p_fence text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare held resource_reservations; r task_runs;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_estate::text,4242));
 select * into held from resource_reservations where reservation_id=p_reservation;
 if not found or held.estate_id is distinct from p_estate or held.task_run_id is distinct from p_run or held.session_id is distinct from p_session or held.binding->>'fence' is distinct from p_fence then
  return jsonb_build_object('released',false,'reason_code','resource_identity_conflict'); end if;
 perform 1 from resource_pools where host_id=held.host_id and pool_id=held.pool_id for update;
 select * into held from resource_reservations where reservation_id=p_reservation for update;
 if held.state='released' then return jsonb_build_object('released',true,'repeated',true,'receipt_seq',held.released_seq); end if;
 if exists(select 1 from resource_reservations where parent_id=p_reservation and state='held') then
  return jsonb_build_object('released',false,'reason_code','resource_children_held'); end if;
 select * into r from task_runs where estate_id=p_estate and task_run_id=p_run;
 if not found or r.session_id is distinct from p_session or r.run_ordinal<>held.run_ordinal or run_ownership_unresolved(p_estate,p_run) then
  return jsonb_build_object('released',false,'reason_code','resource_execution_unresolved'); end if;
 update resource_reservations set state='released',released_seq=r.ended_seq where reservation_id=p_reservation;
 return jsonb_build_object('released',true,'repeated',false,'receipt_seq',r.ended_seq);
end $$;

-- Never-begun cancellation is an explicit trusted command, not an expiry heuristic.
-- Under the same Estate lock as begin, absence of any consumed spawn permission proves
-- no managed process was authorized. Record operational compensation before release.
create function cancel_resource_admission(p_estate uuid,p_reservation text,p_run uuid,p_session uuid,p_fence text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare held resource_reservations; r task_runs; lease leases; ending journal;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_estate::text,4242));
 select * into held from resource_reservations where reservation_id=p_reservation;
 if not found or held.estate_id is distinct from p_estate or held.task_run_id is distinct from p_run
  or held.session_id is distinct from p_session or held.binding->>'fence' is distinct from p_fence then
  return jsonb_build_object('released',false,'reason_code','resource_identity_conflict'); end if;
 perform 1 from resource_pools where host_id=held.host_id and pool_id=held.pool_id for update;
 if held.state='released' then return release_resource_reservation(p_estate,p_reservation,p_run,p_session,p_fence); end if;
 if exists(select 1 from resource_reservations where parent_id=p_reservation and state='held') then
  return jsonb_build_object('released',false,'reason_code','resource_children_held'); end if;
 select * into r from task_runs where estate_id=p_estate and task_run_id=p_run for update;
 select * into lease from leases where estate_id=p_estate and work_id=held.task_id for update;
 if r.task_run_id is null or r.state<>'admitted' or r.session_id is distinct from p_session or r.run_ordinal<>held.run_ordinal
  or lease.owner_session is distinct from p_session or exists(select 1 from task_runs where estate_id=p_estate and task_id=held.task_id and run_ordinal>held.run_ordinal)
  or exists(select 1 from journal where estate_id=p_estate and run_id=p_run and type in ('run.launching@1','run.bound@1','run.launch_failed@1'))
  or exists(select 1 from journal where estate_id=p_estate and type in ('terminal.opened@1','terminal.closed@1') and payload->>'session_id'=p_session::text) then
  return jsonb_build_object('released',false,'reason_code','resource_execution_unresolved'); end if;
 select * into ending from append_event(p_estate,'run.ended@1','{"kind":"system","id":"resource-admission-canceller"}',
  jsonb_build_object('task_run_id',p_run,'task_id',held.task_id,'outcome','failed_known','launch_failure',true),'1',r.project_id,p_run);
 insert into run_launch_compensations(task_run_id,estate_id,session_id,receipt_seq) values(p_run,p_estate,p_session,ending.seq);
 delete from leases where estate_id=p_estate and work_id=held.task_id and owner_session=p_session;
 return release_resource_reservation(p_estate,p_reservation,p_run,p_session,p_fence);
end $$;

-- Helpers and bypassable pre-resource gates are never callable by a database client.
revoke all on function resource_vector_valid(jsonb),resource_pool_problem(text,text,text,jsonb),resource_launch_problem(uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function configure_resource_pool(text,text,text,jsonb,bigint),observe_resource_pool(text,text,text,jsonb,timestamptz),admit_resource_task_launch(uuid,uuid,jsonb,uuid,text,text,jsonb,jsonb,jsonb,text,text,uuid,bigint),release_resource_reservation(uuid,text,uuid,uuid,text),begin_task_run_launch(uuid,uuid,uuid,jsonb,uuid,bigint),validate_task_run_launch(uuid,uuid,uuid,jsonb,uuid,bigint) from public,anon,authenticated;
grant execute on function configure_resource_pool(text,text,text,jsonb,bigint),observe_resource_pool(text,text,text,jsonb,timestamptz),admit_resource_task_launch(uuid,uuid,jsonb,uuid,text,text,jsonb,jsonb,jsonb,text,text,uuid,bigint),release_resource_reservation(uuid,text,uuid,uuid,text),begin_task_run_launch(uuid,uuid,uuid,jsonb,uuid,bigint),validate_task_run_launch(uuid,uuid,uuid,jsonb,uuid,bigint) to service_role;
revoke all on function cancel_resource_admission(uuid,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function cancel_resource_admission(uuid,text,uuid,uuid,text) to service_role;
-- #endregion local-resource-reservation
