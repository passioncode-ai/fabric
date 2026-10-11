-- Grants come from the journal (the 0.3.2 audit, deferred to 0.4.0 wave 1: A7-014, A2-015, A7-015, A7-016,
-- A7-020, A7-022). Measured before this migration, on the whole chain (apps/desktop/test/grants-journal-db.test.mjs):
--
--   * `grants` was primary state written beside the journal. `policy.ts#issueGrant` appended grant.issued@1 and
--     then inserted the row in a second call; the event named no grant, so a rebuild could not reproduce the
--     table, and an insert that failed (an unknown floor class the renderer sent) left a "granted" event with no
--     grant behind it. `spendGrant` updated `consumed_at` ignoring the error. service_role could write the table
--     directly, so the journal's account and the floor's table could disagree.
--   * the row was written without the project the operator granted for, and reserve_effect lets a NULL
--     project_id serve every project: a grant for one project authorised the same act in all of them.
--   * reserve_effect reserved the OLDEST matching live grant while `evaluate` had checked the one presented and
--     `spendGrant` consumed the one presented, so a decision, its reservation and its spend could name three
--     different grants, and a revoked grant that was presented was allowed whenever another live one existed.
--   * event_types.projects ("does apply_projections have a branch for it?") was true for nine types no projector
--     names, the grant pair among them, which is how the first defect stayed invisible.
--   * rebuild_estate_projections replayed without the estate lock append_event takes, so an append committing
--     mid-rebuild could be overwritten by older events replayed after it.
--
-- THE SHAPE. The host mints the grant id and carries it, with the action class, in grant.issued@1; the event's
-- project_id is the grant's project. `apply_grants` projects issued and consumed INSIDE the append transaction,
-- so a grant the table refuses refuses the append too, and nothing journals a grant that does not exist. The
-- table's DML is revoked from every API role: the projector is the only writer. Restored history is history,
-- not authority (ADR-0077; migration 77 applies the same rule to the hub): at or below a restore boundary no
-- grant is issued and none is spent. A grant.issued@1 written before this migration names no grant; its row was
-- written beside it and stays, so such an event projects nothing.
--
-- NOT HERE: consumption stays at the dispatch fence (ADR-0050 clause 4), as an event, not inside reserve_effect —
-- the audit's "move consumption into the same SQL function" would spend a grant at the reservation and give a
-- crash between permission and act its authority back. The default privileges (A7-023's second half) are left
-- as migration 26 set them; see the wave's report.

-- #region grants-from-the-journal — docs: docs/adr/0028-one-effects-algebra-and-the-floor-lives-in-the-schema.md#decision

-- ── 1 · the projector ───────────────────────────────────────────────────────────────────────────────────────
create or replace function apply_grants(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if e.type not in ('grant.issued@1', 'grant.consumed@1') then
    return;
  end if;
  if exists (select 1 from estate_restore_boundaries b
              where b.target_estate_id = e.estate_id and e.seq <= b.watermark_seq) then
    return;
  end if;
  if e.payload->>'grant_id' is null then
    return;   -- written before grants were projected: the row it describes was inserted beside it
  end if;
  v_id := identity_uuid(e.payload->>'grant_id');
  if v_id is null or v_id::text <> e.payload->>'grant_id' then
    raise exception '% names grant %, which is not a canonical uuid', e.type, e.payload->>'grant_id'
      using errcode = 'check_violation';
  end if;
  case e.type
    when 'grant.issued@1' then
      -- Every value is the event's, so a replay writes what the append wrote. The table's own constraints
      -- (the floor class, a target, an expiry) refuse the append that would journal a grant they refuse.
      insert into grants (id, estate_id, project_id, action_class, floor_class, target, expires_at, issued_by, created_at)
      values (v_id, e.estate_id, e.project_id, e.payload->>'action_class', e.payload->>'floor_class',
              e.payload->>'target', (e.payload->>'expires_at')::timestamptz, identity_uuid(e.payload->>'issued_by'),
              e.occurred_at)
      on conflict (id) do nothing;
      if not exists (select 1 from grants where id = v_id and estate_id = e.estate_id) then
        raise exception 'grant % already exists in another estate', v_id using errcode = 'check_violation';
      end if;
    when 'grant.consumed@1' then
      -- The first spend stands: a dispatch retried for the same command spends nothing twice.
      update grants set consumed_at = coalesce(consumed_at, e.occurred_at)
       where id = v_id and estate_id = e.estate_id;
  end case;
end $$;
revoke execute on function apply_grants(journal) from public, anon, authenticated, service_role;

-- The dispatcher gains ONE line (migration 81's list, plus apply_grants).
create or replace function apply_projections(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform apply_estate_and_projects(e);
  perform apply_task_lifecycle_base(e);
  perform apply_memory_facts(e);
  perform apply_operating_surfaces(e);
  perform apply_goals(e);
  perform apply_move_provenance(e);
  perform apply_project_servers(e);
  perform apply_created_agents(e);
  perform apply_routines(e);
  perform apply_proposals(e);
  perform apply_handoffs(e);
  perform apply_link_needs(e);
  perform apply_questions(e);
  perform apply_question_deferrals(e);
  perform apply_priority(e);
  perform apply_grants(e);
  perform apply_effect_lifecycle(e);
  perform apply_heartbeats(e);
  perform apply_deliveries(e);
  perform apply_task_runs(e);
  perform apply_transcript_capture(e);
  perform apply_ceo_receipt(e);
  perform apply_releases(e);
  perform apply_hub_access(e);
  perform apply_comms(e);
end;
$$;
revoke execute on function apply_projections(journal) from public, anon, authenticated, service_role;

-- ── 2 · the projector is the only writer ────────────────────────────────────────────────────────────────────
revoke insert, update, delete, truncate on grants from anon, authenticated, service_role;
comment on table grants is
  'One-shot authority for one floored class on one target. A projection of grant.issued@1 / grant.consumed@1 (apply_grants); no API role writes it.';

-- ── 3 · the presented grant, and no other ───────────────────────────────────────────────────────────────────
-- Migration 34's body when no grant is named (the oldest usable one, as before); when one is named, exactly that
-- row, locked, or a refusal that says which rule refused. `policy.ts#evaluate` names the grant it checked.
drop function if exists reserve_effect(uuid, uuid, text, text, text, uuid);
create function reserve_effect(
  p_estate_id    uuid,
  p_project_id   uuid,
  p_action_class text,
  p_floor_class  text,
  p_target       text,
  p_command_id   uuid,
  p_grant_id     uuid default null
)
returns grant_reservations
language plpgsql
security definer set search_path = public
as $$
declare
  g grants;
  r grant_reservations;
begin
  if p_grant_id is not null then
    -- The same command asking again keeps the authority it already holds (single use is per command).
    select * into r from grant_reservations
     where estate_id = p_estate_id and grant_id = p_grant_id and command_id = p_command_id
       and state in ('reserved', 'consumed');
    if r.reservation_id is not null then
      return r;
    end if;
    select * into g from grants where id = p_grant_id and estate_id = p_estate_id for update;
    if g.id is null then
      raise exception 'no such grant in this estate' using errcode = 'insufficient_privilege';
    end if;
    if g.floor_class <> p_floor_class or g.target <> p_target then
      raise exception 'that grant does not authorise % on this target', p_floor_class using errcode = 'insufficient_privilege';
    end if;
    if g.action_class is not null and g.action_class <> p_action_class then
      raise exception 'that grant authorises %, not %', g.action_class, p_action_class using errcode = 'insufficient_privilege';
    end if;
    if g.project_id is not null and g.project_id is distinct from p_project_id then
      raise exception 'that grant is confined to another project' using errcode = 'insufficient_privilege';
    end if;
    if g.revoked_at is not null then
      raise exception 'that grant was revoked' using errcode = 'insufficient_privilege';
    end if;
    if g.consumed_at is not null then
      raise exception 'that grant has already been spent' using errcode = 'insufficient_privilege';
    end if;
    if g.expires_at <= now() then
      raise exception 'that grant has expired' using errcode = 'insufficient_privilege';
    end if;
  else
    select * into g
      from grants
     where estate_id = p_estate_id
       and floor_class = p_floor_class
       and target = p_target
       and consumed_at is null
       and revoked_at is null
       and expires_at > now()
       and (project_id is null or project_id is not distinct from p_project_id)
       and (action_class is null or action_class = p_action_class)
       and not exists (
         select 1 from grant_reservations gr
          where gr.grant_id = grants.id
            and gr.state in ('reserved', 'consumed', 'revoked')
            and gr.command_id <> p_command_id
       )
     order by created_at
     for update skip locked
     limit 1;

    if g.id is null then
      select * into r from grant_reservations
       where estate_id = p_estate_id and command_id = p_command_id
         and floor_class = p_floor_class and target = p_target
         and state in ('reserved', 'consumed');
      if r.reservation_id is not null then
        return r;
      end if;
      raise exception 'no live grant matches (%, %, %)', p_floor_class, p_target, p_action_class
        using errcode = 'insufficient_privilege';
    end if;

    select * into r from grant_reservations
     where grant_id = g.id and command_id = p_command_id and state in ('reserved', 'consumed');
    if r.reservation_id is not null then
      return r;
    end if;
  end if;

  begin
    insert into grant_reservations
      (estate_id, project_id, grant_id, command_id, action_class, floor_class, target, state)
    values (p_estate_id, p_project_id, g.id, p_command_id, p_action_class, p_floor_class, p_target, 'reserved')
    returning * into r;
  exception when unique_violation then
    raise exception 'that grant is already reserved by another command'
      using errcode = 'insufficient_privilege';
  end;

  return r;
end $$;
revoke execute on function reserve_effect(uuid, uuid, text, text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function reserve_effect(uuid, uuid, text, text, text, uuid, uuid) to service_role;

-- ── 4 · the register says what the projector does ───────────────────────────────────────────────────────────
-- Journal-only types: each is a receipt or an intent its writer records beside its own state, and no apply_*
-- function names it (grants-journal-db.test.mjs compares the flag with the projector bodies).
update event_types set projects = false
 where type in ('chain.dispatch@1', 'effect.executed@1', 'grant.reservation_released@1', 'policy.decided@1',
                'session.ended@1', 'session.observed@1', 'task.admitted@1');
comment on column event_types.projects is
  'True when an apply_* projector names the type; false for a journal-only receipt. Checked against the projector bodies by apps/desktop/test/grants-journal-db.test.mjs.';

-- ── 5 · a rebuild holds the estate, as an append does ───────────────────────────────────────────────────────
-- Migration 5's body under append_event's lock and lock_timeout: an append waits for the replay (and is retried
-- by packages/journal on 55P03), and a replay waits at most three seconds for an append in flight.
create or replace function rebuild_estate_projections(p_estate_id uuid)
returns void
language plpgsql
security definer set search_path = public
set lock_timeout = '3s'
as $$
declare e journal;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text, 4242));
  for e in select * from journal where estate_id = p_estate_id order by seq loop
    perform apply_projections(e);
  end loop;
end $$;

-- #endregion grants-from-the-journal

-- ── schema 82 as a private-archive source ─────────────────────────────────────────────────────────────────────
-- ADR-0079 decision 5, as every step since 67 did: an archive exported at this schema imports. Migration 90's
-- bodies with 82 added (migration 82, merged before this one, made 80; 90 made 81); nothing else changes.
-- #region private-archive-source-schema — docs: docs/adr/0079-private-conversation-archives-preserve-history-not-authority.md#decision
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb,'71'::jsonb,'72'::jsonb,'73'::jsonb,'74'::jsonb,'75'::jsonb,'76'::jsonb,'77'::jsonb,'78'::jsonb,'79'::jsonb,'80'::jsonb,'81'::jsonb,'82'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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
  exception when check_violation then perform ceo_archive_fail('invalid_archive');  -- not silence: migration 64 refused the envelope, which is this archive's refusal
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

create or replace function ceo_export_private_archive(p_estate_id uuid,p_person_id uuid,p_revision bigint,p_estate_manifest jsonb,p_journal_ndjson text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_events jsonb;v_conversations jsonb;v_messages jsonb;v_operations jsonb;v_archive jsonb;v_count bigint;v_max bigint;
begin
 if not ceo_authorized(p_estate_id,p_person_id,p_revision) then return jsonb_build_object('ok',false,'reason_code','unavailable'); end if;
 begin
  v_events:=ceo_archive_estate_rows(p_estate_manifest,p_journal_ndjson);
  if (p_estate_manifest->>'sourceEstateId')::uuid<>p_estate_id then perform ceo_archive_fail('invalid_archive'); end if;
  select count(*),coalesce(max(seq),0) into v_count,v_max from journal where estate_id=p_estate_id;
  if v_count<>(p_estate_manifest->>'eventCount')::bigint or v_max<>(p_estate_manifest->>'watermarkSeq')::bigint then perform ceo_archive_fail('archive_stale'); end if;
  -- Typed row equality; jsonb semantic equality for actor and payload, never property order.
  if exists(select 1 from jsonb_array_elements(v_events) x left join journal j on j.estate_id=p_estate_id and j.seq=ceo_archive_journal_seq(x->'seq')
    where j.seq is null or j.type<>x->>'type' or j.schema_rev<>x->>'schema_rev' or j.actor<>x->'actor' or j.payload<>x->'payload'
     or j.project_id is distinct from (x->>'project_id')::uuid or j.run_id is distinct from (x->>'run_id')::uuid
     or j.node_id is distinct from (x->>'node_id')::uuid or j.occurred_at<>(x->>'occurred_at')::timestamptz) then
   perform ceo_archive_fail('integrity_mismatch'); end if;

  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'subject_kind',c.subject_kind,'subject_id',c.subject_id,'owner_project_id',c.owner_project_id,
    'created_seq',c.created_seq,'revision',c.revision) order by c.id),'[]') into v_conversations
   from ceo_conversations c where c.estate_id=p_estate_id and c.person_id=p_person_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'conversation_id',m.conversation_id,'ordinal',m.ordinal,'content_id',m.content_id,
    'request_id',m.request_id,'accepted_seq',m.accepted_seq,'envelope',b.envelope,'source_digest',b.canonical_digest,
    'origin',case when pv.content_id is null then jsonb_build_object('estate_id',p_estate_id,'canonical_digest',b.canonical_digest)
      else jsonb_build_object('estate_id',pv.origin_estate_id,'canonical_digest',pv.origin_digest) end)
    order by m.conversation_id,m.ordinal),'[]') into v_messages
   from ceo_messages m left join ceo_private_contents b on b.id=m.content_id and b.estate_id=p_estate_id and b.person_id=p_person_id
   left join ceo_content_provenance pv on pv.content_id=b.id
   where m.estate_id=p_estate_id and m.person_id=p_person_id;
  -- Missing content refuses: absence is not an erasure receipt.
  if exists(select 1 from jsonb_array_elements(v_messages) m where m->'envelope' is null or m->'envelope'='null'::jsonb) then perform ceo_archive_fail('invalid_archive'); end if;
  select coalesce(jsonb_agg(case when o.kind='send' then jsonb_build_object('operation_id',o.operation_id,'kind','send','message_id',o.receipt->>'message_id')
    else jsonb_build_object('operation_id',o.operation_id,'kind','open')||ceo_archive_open_intent(o.intent)||jsonb_build_object('receipt',
     jsonb_build_object('conversation_id',o.receipt->>'conversation_id','revision',(o.receipt->>'revision')::bigint,'receipt_seq',(o.receipt->>'receipt_seq')::bigint)) end
    order by o.operation_id),'[]') into v_operations
   from ceo_operations o where o.estate_id=p_estate_id and o.person_id=p_person_id and o.kind in ('open','send');
  if exists(select 1 from ceo_operations o where o.estate_id=p_estate_id and o.person_id=p_person_id and o.kind not in ('open','send')) then
   perform ceo_archive_fail('invalid_archive'); end if;
  if jsonb_array_length(v_conversations)>256 or jsonb_array_length(v_messages)>4096 or jsonb_array_length(v_operations)>8192 then perform ceo_archive_fail('too_large'); end if;
  perform ceo_archive_coverage(p_estate_id,p_person_id,v_conversations,v_messages);

  v_archive:=jsonb_build_object('schema','CeoPrivateArchive@1','archive_id',gen_random_uuid(),'source_schema_version',schema_version(),'owner_person_id',p_person_id,
   'estate_archive',p_estate_manifest,'retention','no-deletion-v1','conversations',v_conversations,'messages',v_messages,'operations',v_operations,
   'tombstones','[]'::jsonb,'archive_digest',repeat('0',64));
  v_archive:=jsonb_set(v_archive,'{archive_digest}',to_jsonb(ceo_private_archive_digest(v_archive)));
  -- Everything this export claims is checked by the same rules an import applies.
  perform ceo_private_archive_validate(v_archive);
  if octet_length(v_archive::text)>8388608 then perform ceo_archive_fail('too_large'); end if;
  return jsonb_build_object('ok',true,'archive',v_archive);
 exception when check_violation then
  -- Not silence: a read-only refusal, returned as its code; nothing to roll back.
  return jsonb_build_object('ok',false,'reason_code',case when sqlerrm in
   ('invalid_json','too_large','invalid_archive','integrity_mismatch','unsupported_schema','archive_stale','idempotency_conflict','not_found','unavailable')
   then sqlerrm else 'unavailable' end);
 end;
end $$;
-- #endregion private-archive-source-schema
