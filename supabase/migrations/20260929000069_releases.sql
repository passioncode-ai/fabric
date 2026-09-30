-- Releases with their basis (ADR-0084; L8 of docs/evidence/plans/2026-09-29-launch-ui-plan.md,
-- the launch design's `launch-releases`).
--
-- A RELEASE IS A RECORD OF A PROJECT: a name (the version as people say it), where it applies,
-- a summary, the tasks that went in and the decisions behind it. VERIFICATION IS A SECOND
-- RECORD with an outcome and a receipt; a release with none is a candidate, because the plan is
-- never the result. A ROLLBACK IS A NEW RELEASE naming the one it replaces — the earlier record
-- is never edited, and reads «rolled back» because a later record says so.
--
-- Two commands are the only writers (`check-commands.mjs`), each idempotent on its command id.
-- Tasks and decisions are references, checked by the command to belong to the same estate and
-- project; the release copies none of their text.

insert into event_types (type, projects, note) values
  ('release.recorded@1', true, 'a person recorded a release of the project: its name, environment, the tasks that went in and the decisions behind it'),
  ('release.verified@1', true, 'a person recorded the verification of a release: accepted or failed, with the receipt that backs it');

create table releases (
  id                   uuid primary key,
  estate_id            uuid not null,
  project_id           uuid not null,
  name                 text not null check (length(btrim(name)) > 0),
  environment          text not null check (length(btrim(environment)) > 0),
  summary              text,
  task_ids             uuid[] not null default '{}',
  decision_ids         uuid[] not null default '{}',
  rolls_back           uuid,
  recorded_at          timestamptz not null,
  recorded_by_kind     text not null check (recorded_by_kind = 'person'),
  recorded_by_id       text not null,
  recorded_seq         bigint not null,
  verified_outcome     text check (verified_outcome in ('accepted', 'failed')),
  verification_receipt text,
  verified_at          timestamptz,
  verified_by_id       text,
  verified_seq         bigint,
  unique (estate_id, id),
  foreign key (estate_id, project_id) references projects (estate_id, id),
  foreign key (estate_id, rolls_back) references releases (estate_id, id),
  check (rolls_back is distinct from id),
  check ((verified_outcome is null) = (verified_seq is null))
);
create index releases_project on releases (estate_id, project_id, recorded_seq desc);
comment on table releases is
  'Releases of a project, one row per release.recorded@1; the verification columns carry the latest release.verified@1. A rollback is its own row naming the release it replaces.';

-- One row per command, so a retry is the same command rather than a second act.
create table release_commands (
  command_id  uuid primary key,
  estate_id   uuid not null,
  release_id  uuid not null,
  action      text not null check (action in ('record', 'verify')),
  seq         bigint not null,
  recorded_at timestamptz not null default now()
);

create or replace function apply_releases(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  case e.type
    when 'release.recorded@1' then
      insert into releases (id, estate_id, project_id, name, environment, summary, task_ids, decision_ids,
                            rolls_back, recorded_at, recorded_by_kind, recorded_by_id, recorded_seq)
      values ((e.payload->>'id')::uuid, e.estate_id, e.project_id, e.payload->>'name', e.payload->>'environment',
              nullif(btrim(coalesce(e.payload->>'summary', '')), ''),
              coalesce((select array_agg(v::uuid) from jsonb_array_elements_text(e.payload->'task_ids') v), '{}'),
              coalesce((select array_agg(v::uuid) from jsonb_array_elements_text(e.payload->'decision_ids') v), '{}'),
              (e.payload->>'rolls_back')::uuid, e.occurred_at, e.actor->>'kind', e.actor->>'id', e.seq)
      on conflict (id) do nothing;
    -- The latest verification stands; an earlier one replayed after it changes nothing.
    when 'release.verified@1' then
      update releases
         set verified_outcome = e.payload->>'outcome', verification_receipt = e.payload->>'receipt',
             verified_at = e.occurred_at, verified_by_id = e.actor->>'id', verified_seq = e.seq
       where id = (e.payload->>'id')::uuid and estate_id = e.estate_id
         and (verified_seq is null or verified_seq < e.seq);
    else null;
  end case;
end $$;

-- The dispatcher gains ONE line; the concern is the function above.
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
  perform apply_effect_lifecycle(e);
  perform apply_heartbeats(e);
  perform apply_deliveries(e);
  perform apply_task_runs(e);
  perform apply_transcript_capture(e);
  perform apply_ceo_receipt(e);
  perform apply_releases(e);
end;
$$;

-- Record a release of a project, or a rollback naming the release it replaces.
create or replace function record_release(
  p_estate_id uuid, p_project_id uuid, p_release_id uuid, p_command_id uuid,
  p_name text, p_environment text, p_summary text, p_task_ids uuid[], p_decision_ids uuid[],
  p_rolls_back uuid, p_actor jsonb
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  existing release_commands;
  v_tasks     uuid[] := coalesce((select array_agg(distinct t) from unnest(p_task_ids) t), '{}');
  v_decisions uuid[] := coalesce((select array_agg(distinct d) from unnest(p_decision_ids) d), '{}');
  v_seq       bigint;
begin
  select * into existing from release_commands where command_id = p_command_id;
  if existing.command_id is not null then
    if existing.release_id <> p_release_id or existing.action <> 'record' then
      raise exception 'that command id already recorded a different release' using errcode = 'invalid_parameter_value';
    end if;
    return jsonb_build_object('release_id', existing.release_id, 'recorded_seq', existing.seq, 'repeated', true);
  end if;
  if coalesce(p_actor->>'kind', '') <> 'person' then
    raise exception 'only a person records a release' using errcode = 'insufficient_privilege';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'a release needs its name' using errcode = 'invalid_parameter_value';
  end if;
  if p_environment is null or length(btrim(p_environment)) = 0 then
    raise exception 'a release names the environment it applies to' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (select 1 from projects where id = p_project_id and estate_id = p_estate_id) then
    raise exception 'no such project' using errcode = 'no_data_found';
  end if;
  if exists (select 1 from releases where id = p_release_id) then
    raise exception 'that release is already recorded; a change is a new release' using errcode = 'invalid_parameter_value';
  end if;
  if (select count(*) from project_tasks where estate_id = p_estate_id and project_id = p_project_id and id = any(v_tasks))
     <> cardinality(v_tasks) then
    raise exception 'a task named by the release is not a task of this project' using errcode = 'invalid_parameter_value';
  end if;
  if (select count(*) from memory_facts where estate_id = p_estate_id and project_id = p_project_id and kind = 'decision' and id = any(v_decisions))
     <> cardinality(v_decisions) then
    raise exception 'a decision named by the release is not a decision of this project' using errcode = 'invalid_parameter_value';
  end if;
  if p_rolls_back is not null and not exists (
    select 1 from releases where id = p_rolls_back and estate_id = p_estate_id and project_id = p_project_id) then
    raise exception 'a rollback names a release of this project that it rolls back' using errcode = 'invalid_parameter_value';
  end if;
  select seq into v_seq from append_event(p_estate_id, 'release.recorded@1', p_actor,
    jsonb_build_object('id', p_release_id, 'name', btrim(p_name), 'environment', btrim(p_environment),
      'summary', nullif(btrim(coalesce(p_summary, '')), ''), 'task_ids', to_jsonb(v_tasks),
      'decision_ids', to_jsonb(v_decisions), 'rolls_back', p_rolls_back, 'command_id', p_command_id),
    '1', p_project_id);
  insert into release_commands (command_id, estate_id, release_id, action, seq)
  values (p_command_id, p_estate_id, p_release_id, 'record', v_seq);
  return jsonb_build_object('release_id', p_release_id, 'recorded_seq', v_seq, 'repeated', false);
end $$;

-- Record the verification of a release: accepted or failed, with its receipt.
create or replace function verify_release(
  p_estate_id uuid, p_project_id uuid, p_release_id uuid, p_command_id uuid,
  p_outcome text, p_receipt text, p_actor jsonb
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  existing release_commands;
  v_seq    bigint;
begin
  select * into existing from release_commands where command_id = p_command_id;
  if existing.command_id is not null then
    if existing.release_id <> p_release_id or existing.action <> 'verify' then
      raise exception 'that command id already did something to a different release' using errcode = 'invalid_parameter_value';
    end if;
    return jsonb_build_object('verified_seq', existing.seq, 'repeated', true);
  end if;
  if coalesce(p_actor->>'kind', '') <> 'person' then
    raise exception 'only a person records a verification' using errcode = 'insufficient_privilege';
  end if;
  if p_outcome is null or p_outcome not in ('accepted', 'failed') then
    raise exception 'a verification outcome is accepted or failed' using errcode = 'invalid_parameter_value';
  end if;
  if p_receipt is null or length(btrim(p_receipt)) = 0 then
    raise exception 'a verification carries its receipt' using errcode = 'invalid_parameter_value';
  end if;
  perform 1 from releases where id = p_release_id and estate_id = p_estate_id and project_id = p_project_id for update;
  if not found then
    raise exception 'no such release' using errcode = 'no_data_found';
  end if;
  select seq into v_seq from append_event(p_estate_id, 'release.verified@1', p_actor,
    jsonb_build_object('id', p_release_id, 'outcome', p_outcome, 'receipt', btrim(p_receipt)), '1', p_project_id);
  insert into release_commands (command_id, estate_id, release_id, action, seq)
  values (p_command_id, p_estate_id, p_release_id, 'verify', v_seq);
  return jsonb_build_object('verified_seq', v_seq, 'repeated', false);
end $$;

-- Grants and RLS in migration 4's shape (P21: a missing grant looks exactly like an empty table).
alter table releases enable row level security;
alter table release_commands enable row level security;
create policy member_releases_read on releases
  for select to authenticated
  using (estate_id in (select member_estates()));
grant select on releases to authenticated;
grant select on releases, release_commands to service_role;
revoke insert, update, delete on releases, release_commands from anon, authenticated, service_role;
revoke all on release_commands from anon, authenticated;

grant execute on function record_release(uuid, uuid, uuid, uuid, text, text, text, uuid[], uuid[], uuid, jsonb) to service_role;
grant execute on function verify_release(uuid, uuid, uuid, uuid, text, text, jsonb) to service_role;
revoke execute on function record_release(uuid, uuid, uuid, uuid, text, text, text, uuid[], uuid[], uuid, jsonb) from anon, authenticated, public;
revoke execute on function verify_release(uuid, uuid, uuid, uuid, text, text, jsonb) from anon, authenticated, public;

-- Schema 69 as a private-archive source (ADR-0079 decision 5: later schemas need explicit
-- qualification). Migration 69 changes no archived table; an ordinary journal from schema 69 may
-- carry release.recorded@1 and release.verified@1, which only a schema that registers them can
-- restore. An export now names the schema it was taken from, 69; import accepts archives from 66
-- to 69 and refuses any other source. The bodies below are migration 68's, changed only at those
-- two points.
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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

  v_archive:=jsonb_build_object('schema','CeoPrivateArchive@1','archive_id',gen_random_uuid(),'source_schema_version',69,'owner_person_id',p_person_id,
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
