-- A0: restored history cannot appoint or reappoint an owner. No private import.
-- Applied migration56/59 bytes are preserved. No retrospective marker inference.
create table estate_restore_boundaries (
 target_estate_id uuid primary key,
 source_estate_id uuid not null,
 mode text not null default 'legacy_unverified' check(mode='legacy_unverified'),
 watermark_seq bigint not null check(watermark_seq between 0 and 9007199254740991),
 event_count integer not null check(event_count>=0),
 owner_event_seqs bigint[] not null,
 recorded_at timestamptz not null default clock_timestamp(),
 check(target_estate_id<>source_estate_id),
 check(array_position(owner_event_seqs,null) is null),
 check(0<all(owner_event_seqs)),
 check(watermark_seq>=all(owner_event_seqs)),
 check(cardinality(owner_event_seqs)<=event_count)
);
alter table estate_restore_boundaries enable row level security;
revoke all on estate_restore_boundaries from public,anon,authenticated,service_role;

create function immutable_estate_restore_boundary() returns trigger
language plpgsql set search_path=public as $$
begin raise exception 'Restore boundary is immutable' using errcode='insufficient_privilege'; end $$;
create trigger estate_restore_boundary_immutable before update or delete on estate_restore_boundaries
 for each row execute function immutable_estate_restore_boundary();

-- Only the trusted restore body may create the boundary. This helper cannot be
-- invoked through service_role RPC and never reads a user-supplied marker flag.
create function record_estate_restore_boundary(p_target uuid,p_source uuid,p_events jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare x jsonb; watermark bigint:=0; owners bigint[]:='{}'; previous bigint:=0; s bigint;
begin
 if p_target is null or p_source is null or p_target=p_source or jsonb_typeof(p_events) is distinct from 'array' then
  raise exception 'Invalid restore boundary' using errcode='check_violation'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_target::text,4242));
 if exists(select 1 from journal where estate_id=p_target) or exists(select 1 from estate_restore_boundaries where target_estate_id=p_target) then
  raise exception 'Restore target is not empty' using errcode='check_violation'; end if;
 for x in select value from jsonb_array_elements(p_events) loop
  -- PostgREST exports JSON numbers; node-postgres exports bigint as decimal
  -- strings. Both normalize to the same exact bounded bigint, never a float.
  if jsonb_typeof(x) is distinct from 'object' or not coalesce(jsonb_typeof(x->'seq') in ('number','string'),false)
   or not coalesce(x->>'seq' ~ '^[1-9][0-9]*$',false) then
   raise exception 'Invalid restore sequence' using errcode='check_violation'; end if;
  if (x->>'seq')::numeric>9007199254740991 then raise exception 'Invalid restore sequence' using errcode='check_violation'; end if;
  s:=(x->>'seq')::bigint;
  if s<=previous then raise exception 'Unordered restore sequence' using errcode='check_violation'; end if;
  previous:=s;watermark:=s;
  if x->>'type'='estate.created@1' then owners:=array_append(owners,s); end if;
 end loop;
 insert into estate_restore_boundaries(target_estate_id,source_estate_id,watermark_seq,event_count,owner_event_seqs)
  values(p_target,p_source,watermark,jsonb_array_length(p_events),owners);
end $$;

create function restore_estate_internal(
  p_target_estate uuid,
  p_source_estate uuid,
  p_name          text,
  p_events        jsonb
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  e          jsonb;
  v_event    journal;
  n          int := 0;
  v_existing int;
  v_projects int;
  v_landed   int;
begin
  if p_target_estate is null or p_source_estate is null then
    return jsonb_build_object('restored',false,'reason_code','unreadable');
  end if;
  if p_target_estate = p_source_estate then
    return jsonb_build_object('restored', false, 'reason_code', 'same_estate',
      'says', 'a restore never writes back into the estate it was taken from',
      'remedy', 'Restore into a new estate and compare the two.');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_target_estate::text, 4242));

  -- NEVER OVER LIVE DATA. Checked under the lock, so two restores cannot both
  -- find the target empty.
  select count(*) into v_existing from journal where estate_id = p_target_estate;
  if v_existing > 0 then
    return jsonb_build_object('restored', false, 'reason_code', 'not_empty',
      'says', format('that estate already holds %s events', v_existing),
      'remedy', 'A restore creates an estate; it does not merge into one.');
  end if;

  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    return jsonb_build_object('restored', false, 'reason_code', 'unreadable',
      'says', 'the archive body is not an array of events');
  end if;

  -- The marker is primary restore evidence, committed atomically with history.
  -- It MUST exist before estate.created reaches the membership-producing arm.
  perform record_estate_restore_boundary(p_target_estate,p_source_estate,p_events);

  insert into estates (id, name)
  values (p_target_estate, coalesce(p_name, 'restored estate'))
  on conflict (id) do nothing;

  -- Inserted with their ORIGINAL seq, then projected in that order. A restore
  -- that re-minted sequence numbers would produce an estate whose history reads
  -- the same and whose receipts point at nothing.
  for e in select * from jsonb_array_elements(p_events)
  loop
    insert into journal (estate_id, seq, type, schema_rev, actor, project_id, run_id, node_id, payload, occurred_at)
    values (
      p_target_estate,
      (e->>'seq')::bigint,
      e->>'type',
      coalesce(e->>'schema_rev', '1'),
      coalesce(e->'actor', '{}'::jsonb),
      nullif(e->>'project_id', '')::uuid,
      nullif(e->>'run_id', '')::uuid,
      nullif(e->>'node_id', '')::uuid,
      coalesce(e->'payload', '{}'::jsonb),
      coalesce((e->>'occurred_at')::timestamptz, now())
    )
    returning * into v_event;
    perform apply_projections(v_event);
    n := n + 1;
  end loop;

  -- AND IT LANDED. Every projection table is keyed by the ENTITY'S OWN id,
  -- globally rather than per estate, so a restore standing beside its source
  -- collides with it row for row — and the projector's `on conflict do nothing`
  -- turns that into silence. Measured 2026-09-10: a restore beside its source
  -- reported `restored: true, events: 2` and produced an estate with no project
  -- and no task in it. A success that produced nothing is the worst answer
  -- available, because the operator stops looking.
  --
  -- Checked on the one thing an archive can always be held to: every project it
  -- says was created must exist in the target afterwards. Raising rolls the
  -- whole transaction back, so a refused restore leaves the target as empty as
  -- it found it.
  select count(distinct e2->'payload'->>'id') into v_projects
    from jsonb_array_elements(p_events) e2
   where e2->>'type' = 'project.created@1';
  select count(*) into v_landed from projects where estate_id = p_target_estate;
  if v_landed < v_projects then
    raise exception using
      errcode = 'check_violation',
      message = format(
        'restore collided: the archive declares %s project(s) and %s landed. Projection rows are keyed by the entity id GLOBALLY, so an estate restored beside its source silently collides with it. Restore into a database that does not already hold this estate.',
        v_projects, v_landed);
  end if;

  return jsonb_build_object('restored', true, 'estate_id', p_target_estate,
    'events', n, 'source_estate_id', p_source_estate, 'projects', v_landed);
end;
$$;


-- Compatibility entry point: still trusted service-only, not Person-authorized
-- or a verified portable archive receipt. Its original receipt shape is retained.
create or replace function restore_estate(p_target_estate uuid,p_source_estate uuid,p_name text,p_events jsonb)
returns jsonb language sql security definer set search_path=public as $$
 select restore_estate_internal(p_target_estate,p_source_estate,p_name,p_events)
$$;

create or replace function apply_estate_and_projects(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_next_primary uuid;
begin
  case e.type
    when 'estate.created@1' then
      insert into estates (id, name, created_at)
      values (e.estate_id, coalesce(e.payload->>'name', 'unnamed estate'), e.occurred_at)
      on conflict (id) do update set name = excluded.name;
      -- AN ESTATE IS CREATED WITH AN OWNER, or it is created unreachable (FA-07).
      --
      -- MEASURED 2026-09-10: a brand new estate got no membership at all, so the
      -- identity port could not establish a subject and a fresh install would
      -- not start. Migration 58 seeds the estates that already existed; this is
      -- the same fact for every one created from here on.
      --
      -- The owner travels IN THE EVENT rather than being assumed, so the record
      -- says who founded the estate. A legacy event naming nobody leaves it
      -- without one — visible immediately at the identity boundary, which is
      -- where it matters — rather than inventing an owner nobody appointed.
      --
      -- Guarded on the person EXISTING, because a projector may not refuse: a
      -- foreign key violation here would abort a replay and leave an estate that
      -- cannot be rebuilt, which is the failure operating-surfaces.md 4.1 exists
      -- to prevent.
      -- Archived ownership is historical attribution, never a new membership.
      -- Exact durable marker survives rebuild; caller flags/GUCs are irrelevant.
      if not exists (select 1 from estate_restore_boundaries b
          where b.target_estate_id=e.estate_id and e.seq=any(b.owner_event_seqs))
         and e.payload->>'owner_person_id' is not null
         and exists (select 1 from persons where id = (e.payload->>'owner_person_id')::uuid) then
        insert into memberships (person_id, estate_id, role, changed_by)
        values ((e.payload->>'owner_person_id')::uuid, e.estate_id, 'owner', 'estate.created@1')
        on conflict (person_id, estate_id) do nothing;
      end if;
    when 'project.created@1' then
      insert into projects (id, estate_id, name, purpose, repo_path, created_at,
                            memory_backend, default_agent)
      values ((e.payload->>'id')::uuid, e.estate_id,
              e.payload->>'name', e.payload->>'purpose', e.payload->>'repo_path',
              e.occurred_at,
              coalesce(e.payload->>'memory_backend', 'local'),
              coalesce(e.payload->>'default_agent', 'claude-code'))
      on conflict (id) do update
        set name = excluded.name, purpose = excluded.purpose,
            repo_path = excluded.repo_path,
            memory_backend = excluded.memory_backend,
            default_agent = excluded.default_agent;
    when 'project.updated@1' then
      update projects
        set name      = coalesce(e.payload->>'name', name),
            purpose   = case when e.payload ? 'purpose'   then e.payload->>'purpose'   else purpose end,
            repo_path = case when e.payload ? 'repo_path' then e.payload->>'repo_path' else repo_path end,
            config_revision = e.seq
        where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
    when 'project.settings.updated@1' then
      update projects
        set memory_backend = coalesce(e.payload->>'memory_backend', memory_backend),
            default_agent  = coalesce(e.payload->>'default_agent', default_agent),
            config_revision = e.seq
        where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
    when 'project.archived@1' then
      update projects
        set status = 'archived', archived_at = e.occurred_at
        where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
    when 'project.repo.attached@1' then
      insert into project_repos (id, estate_id, project_id, path, label, is_primary, attached_at)
      values ((e.payload->>'id')::uuid, e.estate_id, e.project_id,
              e.payload->>'path', e.payload->>'label',
              coalesce((e.payload->>'is_primary')::boolean, false), e.occurred_at)
      on conflict (id) do update set path = excluded.path, label = excluded.label;
      if not exists (select 1 from project_repos where project_id = e.project_id and is_primary) then
        update project_repos set is_primary = true where id = (e.payload->>'id')::uuid
               and estate_id = e.estate_id;
      end if;
      update projects
        set repo_path = (select path from project_repos
                          where project_id = e.project_id and is_primary limit 1)
        where id = e.project_id
             and estate_id = e.estate_id;
    when 'project.repo.detached@1' then
      delete from project_repos where id = (e.payload->>'id')::uuid and project_id = e.project_id
             and estate_id = e.estate_id;
      if not exists (select 1 from project_repos where project_id = e.project_id and is_primary) then
        select id into v_next_primary from project_repos
          where project_id = e.project_id order by attached_at limit 1;
        if v_next_primary is not null then
          update project_repos set is_primary = true where id = v_next_primary
                 and estate_id = e.estate_id;
        end if;
      end if;
      update projects
        set repo_path = (select path from project_repos
                          where project_id = e.project_id and is_primary limit 1)
        where id = e.project_id
             and estate_id = e.estate_id;
    when 'project.configured@1' then
      -- ONE revision for everything the settings panel owns (UX28-11). The
      -- panel used to send `project.updated@1` and then, conditionally,
      -- `project.settings.updated@1` — two appends, two sequences, and the
      -- header's revision belonging to whichever landed last. Presence, not
      -- truthiness: an empty purpose is a decision, and `coalesce` on it would
      -- silently keep the old words.
      --
      -- `repo_path` IS ABSENT ON PURPOSE, and this is UX28-11's exclusion in
      -- structural form: a repository is ATTACHED through the opened-root
      -- boundary (`project.repo.attached@1` above), never set as a string by a
      -- settings save. There is no arm here for it to travel through.
      update projects
        set name          = coalesce(e.payload->>'name', name),
            purpose       = case when e.payload ? 'purpose' then e.payload->>'purpose' else purpose end,
            default_agent = coalesce(e.payload->>'default_agent', default_agent),
            config_revision = e.seq
        where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
    else
      null;
  end case;
end $$;

-- A missing marker cannot identify an old restore. This reader reports unknown,
-- never guesses from event timestamps, names, payloads or existing memberships.
create function read_estate_restore_boundary(p_estate_id uuid,p_person_id uuid,p_revision bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b estate_restore_boundaries;
begin
 if not ceo_authorized(p_estate_id,p_person_id,p_revision) then
  return jsonb_build_object('ok',false,'reason_code','unavailable'); end if;
 select * into b from estate_restore_boundaries where target_estate_id=p_estate_id;
 if not found then return jsonb_build_object('ok',true,'status','not_recorded','prior_restore','unknown','private_import','unavailable'); end if;
 return jsonb_build_object('ok',true,'status','recorded','mode',b.mode,'source_estate_id',b.source_estate_id,
  'target_estate_id',b.target_estate_id,'watermark_seq',b.watermark_seq,'event_count',b.event_count,
  'owner_event_count',cardinality(b.owner_event_seqs),'private_import','unavailable');
end $$;

revoke execute on function immutable_estate_restore_boundary() from public,anon,authenticated,service_role;
revoke execute on function record_estate_restore_boundary(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
revoke execute on function restore_estate_internal(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
revoke execute on function apply_estate_and_projects(journal) from public,anon,authenticated,service_role;
revoke execute on function restore_estate(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function restore_estate(uuid,uuid,text,jsonb) to service_role;
revoke execute on function read_estate_restore_boundary(uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function read_estate_restore_boundary(uuid,uuid,bigint) to service_role;
comment on table estate_restore_boundaries is
 'A0 immutable primary restore marker, before archival projection. Legacy-unverified only; no automatic backfill or private-import authority.';
comment on function restore_estate(uuid,uuid,text,jsonb) is
 'Trusted service-only legacy restore into a new empty Estate. Preserves historical bytes/IDs, records an unverified boundary, and never assigns membership from archived estate.created events.';
