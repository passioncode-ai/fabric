-- 94 (by count; suffix 116): a withdrawn answer is no longer a current decision. Fabric 0.3.7 release review,
-- iteration 1 (docs/evidence/reviews/0.3.7/iteration-1/2026-10-20-data.md, DA-1 and DA-6).
--
-- NUMBERS. `schema_version()` counts applied migrations, so this file makes the schema 94. The task pipeline's
-- reservation (`docs/evidence/plans/task-pipeline-persistence-contract.md`) held 116/117 unexecuted; by its collision
-- rule it moves to 117/118 in this change, and this file takes 116.
--
-- WHAT WAS WRONG (DA-1). `answer_question` (migration 35) records the answer as a `memory.project.recorded@1` fact of
-- kind `decision`. Migration 112 let a person take the answer back (`question.answer_withdrawn@1`, also История's undo
-- of «answer»), and its projector reopened the question and wrote nothing about that fact: it kept `valid_to = null`,
-- so the context pack (`contextPack.ts`, which hands agents every fact with `valid_to is null`) kept serving a decision
-- that was taken back as present truth, and answering again left two current decisions for one question. Migration
-- 112's own header promised the old decision would stay "as history"; measured, it stayed as the present.
--
-- WHAT THIS ADDS
--   * `memory_facts.withdrawn_seq`: the journal seq of the withdrawal that ended a fact. A fact's window used to close
--     only when a later fact REPLACED it (`superseded_by`, migration 12's shape check); a withdrawn answer is not
--     replaced by anything, it is taken back, so the shape now admits exactly one of the two as the closer. Nothing
--     else about a fact changes, and every fact recorded so far keeps its shape.
--   * `apply_withdrawn_answer_decision`, a projector of `question.answer_withdrawn@1`: it closes the decision the
--     withdrawn answer recorded (the payload's `decision_id`; for a payload without one, every current decision fact
--     the question's answers recorded before the withdrawal), at the withdrawal's time. Replay-safe: it touches only
--     a fact still current and recorded before the withdrawal, so a rebuild over existing rows changes nothing and a
--     re-answer's new decision, recorded after it, stays current. A fact a correction had already closed stays as the
--     correction left it.
--   * The same projector run once over the withdrawals already in the journal, so a database that took answers back
--     at schema 90 to 93 is corrected by this upgrade, not only by a later rebuild.
--   * DA-6: three indexes for the agent's history read (`shared/sessionHistory.ts`: one estate, the events naming a
--     session as `payload->>session_id`, `payload->>owner` or `actor->>id`, newest first). The read was one OR filter,
--     and it walked the estate's journal backwards on its primary key until it had 201 matches: for a quiet session,
--     the whole estate's journal, every 10 s. It is now three reads, one per key, each served by its index in seq order
--     and stopping at 201 rows; the app merges them.
--   * Schema 94 as a private-archive source (ADR-0079 decision 5): migration 115's function with 94 admitted.
--
-- The dispatcher is migration 113's, plus one line.

-- ── the column and the fact's shape ──────────────────────────────────────────────────────────────────────────────
-- #region withdrawn-answer-closes-decision — docs: docs/ux/scenarios.md#scn-169-undo-an-act-or-read-why-it-cannot-be-undone
alter table memory_facts add column if not exists withdrawn_seq bigint;

alter table memory_facts drop constraint if exists memory_facts_supersession_shape;
alter table memory_facts add constraint memory_facts_supersession_shape
  check ((valid_to is null and superseded_by is null and withdrawn_seq is null)
      or (valid_to is not null and ((superseded_by is null) <> (withdrawn_seq is null))));

comment on column memory_facts.valid_to is
  'When this stopped being true. Null means it still is. Never set alone: a later fact replaced it (superseded_by), '
  'or a person took back the answer that recorded it (withdrawn_seq). Exactly one of the two.';
comment on column memory_facts.withdrawn_seq is
  'The journal seq of the question.answer_withdrawn@1 that ended this decision (migration 116). Null unless a '
  'withdrawal, not a later fact, closed the window.';

create or replace function apply_withdrawn_answer_decision(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_question text;
  v_decision uuid;
begin
  if e.type <> 'question.answer_withdrawn@1' then
    return;
  end if;
  v_question := e.payload->>'id';
  v_decision := nullif(e.payload->>'decision_id', '')::uuid;
  update memory_facts f
     set valid_to = e.occurred_at, withdrawn_seq = e.seq
   where f.estate_id = e.estate_id
     and f.valid_to is null
     and f.seq < e.seq
     and f.kind = 'decision'
     and f.source_ref = 'question:' || v_question
     and (v_decision is null or f.id = v_decision);
end $$;
revoke execute on function apply_withdrawn_answer_decision(journal) from public, anon, authenticated, service_role;

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
end;
$$;
revoke execute on function apply_projections(journal) from public, anon, authenticated, service_role;

-- The withdrawals already in the journal, in the order they happened.
do $$
declare e journal;
begin
  for e in select * from journal where type = 'question.answer_withdrawn@1' order by seq loop
    perform apply_withdrawn_answer_decision(e);
  end loop;
end $$;
-- #endregion withdrawn-answer-closes-decision

-- ── DA-6: the agent's history read ───────────────────────────────────────────────────────────────────────────────
-- `readSessionHistory` reads one estate's events naming a session, newest first, 201 rows, once per key. Each key has
-- its index ending in `seq desc`, so each read is an index range already in the order asked and stops at its limit.
-- Measured on a disposable PostgreSQL 17 at 200 000 events: one OR filter is a backward primary-key scan that
-- removes 199 860 rows whatever indexes exist, because the planner cannot read three indexes in one order; the three
-- keyed reads are index scans of their own matches. `session_id` and `owner` are partial (most events carry neither;
-- an equality on the key implies it is not null, so the planner uses them); `actor->>id` is on every event.
create index if not exists journal_by_session_id on journal (estate_id, (payload->>'session_id'), seq desc)
  where payload->>'session_id' is not null;
create index if not exists journal_by_owner on journal (estate_id, (payload->>'owner'), seq desc)
  where payload->>'owner' is not null;
create index if not exists journal_by_actor_id on journal (estate_id, (actor->>'id'), seq desc);

-- ── schema 94 as a private-archive source ────────────────────────────────────────────────────────────────────────
-- Schema 94 adds no archive event shape, so an archive taken at 94 reads as one taken at 93 (the function of
-- migration 115, with 94 admitted).
-- #region private-archive-source-schema — docs: docs/adr/0079-private-conversation-archives-preserve-history-not-authority.md#decision
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb,'71'::jsonb,'72'::jsonb,'73'::jsonb,'74'::jsonb,'75'::jsonb,'76'::jsonb,'77'::jsonb,'78'::jsonb,'79'::jsonb,'80'::jsonb,'81'::jsonb,'82'::jsonb,'83'::jsonb,'84'::jsonb,'85'::jsonb,'86'::jsonb,'87'::jsonb,'88'::jsonb,'89'::jsonb,'90'::jsonb,'91'::jsonb,'92'::jsonb,'93'::jsonb,'94'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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
