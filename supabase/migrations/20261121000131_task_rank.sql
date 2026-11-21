-- 104 (by count; suffix 131): the order of a project's queue, the owner's rank and an agent's proposal
-- (docs/evidence/specs/2026-11-21-task-rank.md, ADR-0208).
--
-- NUMBERS. `schema_version()` counts applied migrations, so this file makes the schema 104. The task pipeline's prose
-- reservation held 131 and 132 unexecuted (`docs/evidence/plans/task-pipeline-persistence-contract.md`); this file
-- takes 131, and by that document's collision rule the reservation moves to 132 and 133.
--
-- WHAT THIS ADDS
--   * `task.ranked@1 {task_id, rank}`: the person places a task in its project's queue. `rank` is a number, lower
--     first, fractional so that one move between two tasks is one event. Projected into `project_tasks.rank` only when
--     the event's actor is a person: an agent cannot order the owner's queue, and the same event written by anyone
--     else changes nothing (the journal keeps it; a projection never refuses what the journal accepted, ADR-0014).
--   * `task.rank.proposed@1 {task_id, after_task_id, why}`: an agent (the CEO) proposes a place, after the named task
--     or first when `after_task_id` is null. Kept as `project_tasks.rank_proposal` until the person decides.
--   * `task.rank.declined@1 {task_id}`: the person declines the proposal. Accepting it is a `task.ranked@1`, which
--     clears the proposal too, as does any place the person gives the task himself.
--   * `task.prioritised@1`, `goal_id` and `position` are untouched: order inside a goal stays what it was.
--
-- The order itself (ready before blocked, the rank inherited through `blocks` and `follows`, the critical path) is
-- computed by the readers from `rank` and `task_links` (`apps/desktop/src/shared/taskRank.ts`); nothing here stores it.

-- #region task-rank — docs: docs/evidence/specs/2026-11-21-task-rank.md#2-the-events
insert into event_types (type, projects, note) values
  ('task.ranked@1', true, 'the person placed a task in its project''s queue: a rank, lower first; projected only when a person wrote it (ADR-0208)'),
  ('task.rank.proposed@1', true, 'an agent proposed a place for a task in its project''s queue, after a named task or first, with why; the person accepts or declines (ADR-0208)'),
  ('task.rank.declined@1', true, 'the person declined an agent''s proposed place for a task (ADR-0208)')
on conflict (type) do nothing;

alter table project_tasks
  add column if not exists rank double precision,
  add column if not exists rank_proposal jsonb;
create index if not exists project_tasks_rank on project_tasks (project_id, rank) where rank is not null;
comment on column project_tasks.rank is
  'The owner''s place for the task in its project''s queue, lower first; null when he never placed it. A projection of task.ranked@1 written by a person (apply_task_rank).';
comment on column project_tasks.rank_proposal is
  'An agent''s open proposal of a place: {after_task_id, why, by, by_kind, at, seq}; null when there is none or the person decided. A projection of task.rank.proposed@1 (apply_task_rank).';

create or replace function apply_task_rank(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_task  text := e.payload->>'task_id';
  v_after text := e.payload->>'after_task_id';
  v_uuid  constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
  if e.type not in ('task.ranked@1', 'task.rank.proposed@1', 'task.rank.declined@1') then return; end if;
  -- A payload that names no task changes nothing: the journal took it, so the projection must not raise on it.
  if v_task is null or v_task !~ v_uuid then return; end if;

  if e.type = 'task.ranked@1' then
    if coalesce(e.actor->>'kind', '') <> 'person' then return; end if;
    if jsonb_typeof(e.payload->'rank') is distinct from 'number' then return; end if;
    update project_tasks
       set rank = (e.payload->>'rank')::double precision, rank_proposal = null
     where id = v_task::uuid and estate_id = e.estate_id;

  elsif e.type = 'task.rank.proposed@1' then
    -- The person places a task; a proposal is somebody else's.
    if coalesce(e.actor->>'kind', '') = 'person' then return; end if;
    if v_after is not null and v_after !~ v_uuid then return; end if;
    update project_tasks
       set rank_proposal = jsonb_build_object(
             'after_task_id', v_after,
             'why', left(coalesce(nullif(btrim(e.payload->>'why'), ''), ''), 500),
             'by', e.actor->>'id', 'by_kind', e.actor->>'kind', 'at', e.occurred_at, 'seq', e.seq)
     where id = v_task::uuid and estate_id = e.estate_id;

  else
    if coalesce(e.actor->>'kind', '') <> 'person' then return; end if;
    update project_tasks set rank_proposal = null
     where id = v_task::uuid and estate_id = e.estate_id;
  end if;
end $$;
revoke execute on function apply_task_rank(journal) from public, anon, authenticated, service_role;

-- The dispatcher: migration 124's, plus one line.
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
  perform apply_project_repo_kind(e);
  perform apply_withdrawn_answer_chain(e);
  perform apply_question_resolution(e);
  perform apply_comms_reply_delivery(e);
  perform apply_projection_times(e);
  perform apply_task_rank(e);
end;
$$;
revoke execute on function apply_projections(journal) from public, anon, authenticated, service_role;
-- #endregion task-rank

-- ── schema 104 as a private-archive source ───────────────────────────────────────────────────────────────────────
-- Every schema step admits itself as a private-archive source (migration 127's rule). Schema 104 adds no archive event
-- shape, so an archive taken at 104 reads as one taken at 103: the function is migration 131's with 104 admitted.
-- #region private-archive-source-schema — docs: docs/adr/0079-private-conversation-archives-preserve-history-not-authority.md#decision
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb,'71'::jsonb,'72'::jsonb,'73'::jsonb,'74'::jsonb,'75'::jsonb,'76'::jsonb,'77'::jsonb,'78'::jsonb,'79'::jsonb,'80'::jsonb,'81'::jsonb,'82'::jsonb,'83'::jsonb,'84'::jsonb,'85'::jsonb,'86'::jsonb,'87'::jsonb,'88'::jsonb,'89'::jsonb,'90'::jsonb,'91'::jsonb,'92'::jsonb,'93'::jsonb,'94'::jsonb,'95'::jsonb,'96'::jsonb,'97'::jsonb,'98'::jsonb,'99'::jsonb,'100'::jsonb,'101'::jsonb,'102'::jsonb,'103'::jsonb,'104'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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
