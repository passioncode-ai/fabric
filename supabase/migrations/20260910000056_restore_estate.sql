-- A restore creates a NEW estate, and that is the fence (FA-06).
--
-- WHAT EXISTED BEFORE THIS. `storageContract.ts` computes what the declared
-- mirror holds, refuses to call it a backup, and names the absences — two of
-- thirty-odd tables carried, `goals`, `questions`, `routines` and the tasks
-- themselves NOT among them. That honesty is the reason this file is additive
-- rather than a correction: the mirror was never claiming to be this.
--
-- WHY A NEW ESTATE RATHER THAN A GENERATION COLUMN. The card asks that an old
-- writer and an old grant execute nothing after a restore. S02 already scopes
-- every read and every write by estate, and S03 scopes every authority decision
-- the same way — so a restore into a NEW estate id is fenced by the mechanism
-- the whole product already runs on, rather than by a second one written for
-- this feature. An old lease names the old estate. An old grant names the old
-- estate. Neither can reach the copy, and nobody had to remember to check.
--
-- AND IT NEVER WRITES OVER ANYTHING. The target must be empty. A restore that
-- could merge into a live estate is a restore that can destroy one, and the
-- failure would arrive as a mixture rather than as an error.

create or replace function restore_estate(
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

comment on function restore_estate(uuid, uuid, text, jsonb) is
  'FA-06. Replays an archived journal into a NEW, empty estate. Refuses a non-empty target and refuses to write back into the source; the new estate id is the fence that stops old leases and old grants reaching the copy.';

revoke execute on function restore_estate(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function restore_estate(uuid, uuid, text, jsonb) to service_role;
