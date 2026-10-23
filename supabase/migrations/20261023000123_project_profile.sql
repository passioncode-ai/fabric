-- 96 (by count; suffix 123): a project's profile, Fabric 0.3.12 wave 2 slice S1
-- (docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md, decisions W2-1 to W2-4).
--
-- NUMBERS. `schema_version()` counts applied migrations, so this file makes the schema 96. The task pipeline's prose
-- reservation held 121 and 122 unexecuted (`docs/evidence/plans/task-pipeline-persistence-contract.md`); this file
-- takes 123, past it, and by that document's collision rule the reservation moves to 124 and 125.
--
-- WHAT THIS ADDS
--   * `project.profiled@1`: an agent (the one onboarding a project, through `fabric_project_profile`) or the person
--     records what a project is: its goal, a one-line summary, its business, its plan (done and next) and its relations
--     to other projects. Every field is optional; a field the event names replaces the projection's value (an empty
--     string clears it), a field it does not name is left as it was. Relations, when named, replace the project's
--     whole list.
--   * The projection: `goal`, `summary`, `business`, `plan`, `profiled_at`, `profiled_by` on `projects`, and
--     `project_relations` (one row per relation the profile names), rebuilt from the journal by
--     `apply_project_profile`, added to the dispatcher as one line (the dispatcher is migration 116's).
--   * Schema 96 as a private-archive source (ADR-0079 decision 5): migration 120's function with 96 admitted.

-- #region project-profile — docs: docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md#decisions-the-questions-the-scenarios-leave-open
insert into event_types (type, projects, note) values
  ('project.profiled@1', true, 'what a project is, recorded by the agent onboarding it or by the person: goal, summary, business, plan and relations, each a field it names; never a secret')
on conflict (type) do nothing;

alter table projects
  add column if not exists goal text,
  add column if not exists summary text,
  add column if not exists business text,
  add column if not exists plan jsonb,
  add column if not exists profiled_at timestamptz,
  add column if not exists profiled_by text;

create table if not exists project_relations (
  estate_id   uuid not null,
  project_id  uuid not null,
  kind        text not null check (kind in ('depends-on', 'used-by', 'same-business', 'talks-to', 'other')),
  target      text not null check (length(target) between 1 and 200),
  note        text check (note is null or length(note) <= 500),
  recorded_at timestamptz not null,
  primary key (estate_id, project_id, kind, target),
  -- Composite, so a row cannot name another estate's project (migration 42's rule).
  foreign key (estate_id, project_id) references projects (estate_id, id) on delete cascade
);
create index if not exists project_relations_project on project_relations(project_id);

alter table project_relations enable row level security;
create policy member_project_relations_read on project_relations
  for select to authenticated
  using (estate_id in (select member_estates()));
-- Supabase's default privileges give new tables to anon and authenticated; a projection is written only by its projector.
revoke all on project_relations from anon;
revoke insert, update, delete, truncate, references, trigger on project_relations from authenticated;
grant select on project_relations to authenticated;
grant select, insert, update, delete on project_relations to service_role;

create or replace function apply_project_profile(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare r jsonb;
begin
  if e.type <> 'project.profiled@1' or e.project_id is null then return; end if;
  update projects set
    goal     = case when e.payload ? 'goal'     then nullif(btrim(e.payload->>'goal'), '')     else goal end,
    summary  = case when e.payload ? 'summary'  then nullif(btrim(e.payload->>'summary'), '')  else summary end,
    business = case when e.payload ? 'business' then nullif(btrim(e.payload->>'business'), '') else business end,
    plan     = case when e.payload ? 'plan'     then (case when jsonb_typeof(e.payload->'plan') = 'object' then e.payload->'plan' else null end) else plan end,
    profiled_at = e.occurred_at,
    profiled_by = coalesce(e.actor->>'id', profiled_by)
  where id = e.project_id and estate_id = e.estate_id;
  if e.payload ? 'relations' and jsonb_typeof(e.payload->'relations') = 'array' then
    delete from project_relations where estate_id = e.estate_id and project_id = e.project_id;
    for r in select value from jsonb_array_elements(e.payload->'relations') loop
      continue when jsonb_typeof(r) <> 'object'
        or coalesce(r->>'kind', '') not in ('depends-on', 'used-by', 'same-business', 'talks-to', 'other')
        or length(coalesce(btrim(r->>'target'), '')) not between 1 and 200;
      insert into project_relations (estate_id, project_id, kind, target, note, recorded_at)
      values (e.estate_id, e.project_id, r->>'kind', btrim(r->>'target'), left(nullif(btrim(r->>'note'), ''), 500), e.occurred_at)
      on conflict (estate_id, project_id, kind, target) do update set note = excluded.note, recorded_at = excluded.recorded_at;
    end loop;
  end if;
end $$;
revoke execute on function apply_project_profile(journal) from public, anon, authenticated, service_role;

create or replace function apply_projections(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform apply_estate_and_projects(e);
  perform apply_project_repo_identity(e);
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
  perform apply_task_sources(e);
  perform apply_work_claims(e);
  perform apply_question_answer_reopen(e);
  perform apply_withdrawn_answer_decision(e);
  perform apply_project_profile(e);
end;
$$;
revoke execute on function apply_projections(journal) from public, anon, authenticated, service_role;
-- #endregion project-profile

-- ── schema 96 as a private-archive source ────────────────────────────────────────────────────────────────────────
-- Schema 96 adds no archive event shape, so an archive taken at 96 reads as one taken at 95 (the function of
-- migration 120, with 96 admitted).
-- #region private-archive-source-schema — docs: docs/adr/0079-private-conversation-archives-preserve-history-not-authority.md#decision
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb,'71'::jsonb,'72'::jsonb,'73'::jsonb,'74'::jsonb,'75'::jsonb,'76'::jsonb,'77'::jsonb,'78'::jsonb,'79'::jsonb,'80'::jsonb,'81'::jsonb,'82'::jsonb,'83'::jsonb,'84'::jsonb,'85'::jsonb,'86'::jsonb,'87'::jsonb,'88'::jsonb,'89'::jsonb,'90'::jsonb,'91'::jsonb,'92'::jsonb,'93'::jsonb,'94'::jsonb,'95'::jsonb,'96'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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
  exception when check_violation then perform ceo_archive_fail('invalid_archive');
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
-- #endregion private-archive-source-schema
