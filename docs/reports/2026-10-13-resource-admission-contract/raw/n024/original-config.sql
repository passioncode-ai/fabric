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
