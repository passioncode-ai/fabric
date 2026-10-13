-- Run only in the owned disposable runner database, before or after correction.
-- Original SQL: expected exit 1 at stale-writer assertion. Corrected SQL: exit 0.
-- The transaction rolls back every fixture row; no production database is allowed.
begin;
do $$ begin
 if current_database() !~ '^fabric_dispatch_test_[a-z0-9_]+$' then
  raise exception 'requires owned disposable resource fixture';
 end if;
end $$;
set local role service_role;
do $$
declare capacity constant jsonb := '{"workerSlots":2,"memoryBytes":100,"diskBytes":100,"cpuMilliCores":100}';
begin
 if not configure_resource_pool('n024-negative-host','n024-negative-pool','new-policy',capacity,60000) then
  raise exception 'fixture could not establish initial policy';
 end if;
 if configure_resource_pool('n024-negative-host','n024-negative-pool','old-policy',capacity,60000) then
  raise exception 'stale five-argument writer rolled back the newer policy';
 end if;
end $$;
rollback;
