-- 90 (by count; suffix 112) — acts and their inverse: the journal can say who did an act and how to take it back,
-- and an answered question can be reopened. Fabric 0.3.7 wave 2 (docs/evidence/plans/2026-10-15-fabric-simple/README.md,
-- ADR-0160 §2, SCN-168, SCN-169).
--
-- NUMBERS. `schema_version()` counts applied migrations, so this file makes the schema 90. Suffix 109 stays wave 4's
-- controls migration (ADR-0156) and suffixes 110/111 the task pipeline's reservation
-- (`docs/evidence/plans/task-pipeline-persistence-contract.md`); this file takes the next free one, 112.
--
-- WHAT THIS ADDS
--   * `act.recorded@1` (journal-only, projects nothing): the ONE record of an operator act — its actor (the journal row's),
--     the sentence key and words, the inverse command or the reason there is none, and `undoes`, the seq of the act it
--     reverses (`apps/desktop/src/shared/acts.ts`). Two partial indexes serve История's reads: the newest acts first,
--     and the reversals of a set of acts.
--   * `question.answer_withdrawn@1` and `reopen_answered_question`: until now only a question the owner had SET ASIDE
--     could be reopened (`reopen_question`, migration 68). An ANSWERED one could not, so "answer → reopen" had no
--     command. The command is a person's (as `answer_question` is), is idempotent by its command id, takes the question
--     back to `open` under a new revision (so a screen holding the old revision cannot answer blind), and recomputes
--     what the question blocks. The earlier answer stays in the journal and the decision it recorded stays in the
--     project's memory as history; a new answer records a new decision.
--   * `question_resolutions` stops being one row per question: a reopened question is answered again, and that answer
--     is a second resolution with its own command and decision (the unique `command_id` and `decision_id` stay).
--
-- The dispatcher is migration 95's, plus one line.

insert into event_types (type, projects, note) values
  ('act.recorded@1', false, 'an operator act, recorded with its actor, its sentence, the command that takes it back (or why none exists) and the act it reverses (ADR-0160 §2); a journal-only record read by History'),
  ('question.answer_withdrawn@1', true, 'the operator took an answer back: the question is open again under a new revision, the blocked work blocked again');

create index journal_acts_newest on journal (estate_id, seq desc) where type = 'act.recorded@1';
create index journal_acts_reversals on journal (estate_id, (payload->>'undoes')) where type = 'act.recorded@1' and payload->>'undoes' is not null;
create index journal_answer_withdrawn_command on journal (estate_id, (payload->>'command_id')) where type = 'question.answer_withdrawn@1';

alter table question_resolutions drop constraint if exists question_resolutions_question_id_key;
create index if not exists question_resolutions_question on question_resolutions (question_id);

create or replace function apply_question_answer_reopen(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_id   uuid;
  v_task uuid;
begin
  if e.type <> 'question.answer_withdrawn@1' then
    return;
  end if;
  v_id := (e.payload->>'id')::uuid;
  update questions
     set status = 'open', answer = null, chosen_option = null, answered_by = null, answered_by_kind = null,
         settled_basis = null, answered_at = null, decision_id = null, resolution_id = null,
         -- Counted from the journal, not incremented: a rebuild replays this event over rows that already hold its
         -- effect (projectors are upserts), and a revision that is the number of withdrawals so far is the same on
         -- every replay.
         revision = 1 + (select count(*) from journal j
                          where j.estate_id = e.estate_id and j.type = 'question.answer_withdrawn@1'
                            and j.payload->>'id' = v_id::text and j.seq <= e.seq)::integer
   where id = v_id and estate_id = e.estate_id and status = 'answered';
  for v_task in select task_id from question_blocks where question_id = v_id and estate_id = e.estate_id
  loop
    perform recompute_task_blockers(e.estate_id, v_task);
  end loop;
end $$;
revoke execute on function apply_question_answer_reopen(journal) from public, anon, authenticated, service_role;

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
  perform apply_task_sources(e);
  perform apply_work_claims(e);
  perform apply_question_answer_reopen(e);
end;
$$;
revoke execute on function apply_projections(journal) from public, anon, authenticated, service_role;

-- The command. A person only; idempotent by its command id; the question must be answered.
create or replace function reopen_answered_question(
  p_estate_id uuid, p_project_id uuid, p_question_id uuid, p_command_id uuid, p_actor jsonb
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  q       questions;
  v_prior journal;
  v_seq   bigint;
begin
  select * into v_prior from journal
   where estate_id = p_estate_id and type = 'question.answer_withdrawn@1' and payload->>'command_id' = p_command_id::text
   limit 1;
  if v_prior.seq is not null then
    if v_prior.payload->>'id' <> p_question_id::text then
      raise exception 'that command id already reopened a different question' using errcode = 'invalid_parameter_value';
    end if;
    return jsonb_build_object('reopened_seq', v_prior.seq, 'repeated', true);
  end if;
  if coalesce(p_actor->>'kind', '') <> 'person' then
    raise exception 'only a person takes an answer back' using errcode = 'insufficient_privilege';
  end if;
  select * into q from questions where id = p_question_id and estate_id = p_estate_id for update;
  if q.id is null or q.project_id is distinct from p_project_id then
    raise exception 'no such question' using errcode = 'no_data_found';
  end if;
  if q.status <> 'answered' then
    raise exception 'that question is not answered (it is %), so there is no answer to take back', q.status
      using errcode = 'invalid_parameter_value';
  end if;
  select seq into v_seq from append_event(p_estate_id, 'question.answer_withdrawn@1', p_actor,
    jsonb_build_object('id', p_question_id, 'command_id', p_command_id, 'decision_id', q.decision_id,
                       'resolution_id', q.resolution_id), '1', p_project_id);
  return jsonb_build_object('reopened_seq', v_seq, 'revision', q.revision + 1, 'repeated', false);
end $$;
revoke execute on function reopen_answered_question(uuid, uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function reopen_answered_question(uuid, uuid, uuid, uuid, jsonb) to service_role;

-- ── schema 90 as a private-archive source ─────────────────────────────────────────────────────────────────────
-- ADR-0079 decision 5, as every step since 67 did: an archive exported at this schema imports. Migration 108's
-- canonical body with 90 added. Nothing else changes.
-- #region private-archive-source-schema — docs: docs/adr/0079-private-conversation-archives-preserve-history-not-authority.md#decision
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb,'71'::jsonb,'72'::jsonb,'73'::jsonb,'74'::jsonb,'75'::jsonb,'76'::jsonb,'77'::jsonb,'78'::jsonb,'79'::jsonb,'80'::jsonb,'81'::jsonb,'82'::jsonb,'83'::jsonb,'84'::jsonb,'85'::jsonb,'86'::jsonb,'87'::jsonb,'88'::jsonb,'89'::jsonb,'90'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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

-- #endregion private-archive-source-schema
