-- The Board's «На следующий раз» and «+ Добавить тему» (SCR-41, L3b of
-- docs/evidence/plans/2026-09-29-launch-ui-plan.md).
--
-- SETTING A QUESTION ASIDE DOES NOT SETTLE IT. The question stays `open`: it still blocks the
-- tasks it blocked and it can still be answered. What the owner records is a REASON and the
-- fact that it waits for next time, in a table of its own — so every rule that reads
-- `questions.status` (the blocking set, the answer command, the priority) is untouched, and
-- the board simply reads the set-aside questions under their own heading.
--
-- A TOPIC THE OWNER WRITES IS A QUESTION ON THE PROJECT, asked by that person. It is answered
-- by the same `answer_question`, so its outcome becomes the project's decision exactly as an
-- agent's question does; there is no second kind of board item to keep in step.
--
-- Three commands are the only writers (`check-commands.mjs`), each idempotent on its own
-- command id: a retry after a lost response returns the first receipt.

insert into event_types (type, projects, note) values
  ('question.deferred@1', true, 'the owner set an open question aside for next time, with a reason; it stays open and keeps blocking'),
  ('question.reopened@1', true, 'a question the owner had set aside returned to the board');

-- The identity a deferral names includes its estate (migration 42's shape): a row naming another
-- estate's question or project is refused by the database, not merely by the command.
alter table questions add constraint questions_estate_identity unique (estate_id, id);

create table question_deferrals (
  question_id      uuid primary key,
  estate_id        uuid not null,
  project_id       uuid not null,
  reason           text not null check (length(btrim(reason)) > 0),
  deferred_at      timestamptz not null,
  deferred_by_kind text not null check (deferred_by_kind = 'person'),
  deferred_by_id   text not null,
  deferred_seq     bigint not null,
  foreign key (estate_id, question_id) references questions (estate_id, id),
  foreign key (estate_id, project_id) references projects (estate_id, id)
);
comment on table question_deferrals is
  'Open questions the owner set aside for next time. Present only while the question is open and set aside; returning it, answering it or withdrawing it removes the row.';

-- One row per command, so a retry is the same command rather than a second act.
create table question_deferral_commands (
  command_id  uuid primary key,
  estate_id   uuid not null,
  question_id uuid not null,
  action      text not null check (action in ('defer', 'reopen')),
  seq         bigint not null,
  recorded_at timestamptz not null default now()
);

create or replace function apply_question_deferrals(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  case e.type
    when 'question.deferred@1' then
      insert into question_deferrals (question_id, estate_id, project_id, reason, deferred_at,
                                      deferred_by_kind, deferred_by_id, deferred_seq)
      select q.id, q.estate_id, q.project_id, e.payload->>'reason', e.occurred_at,
             e.actor->>'kind', e.actor->>'id', e.seq
        from questions q
       where q.id = (e.payload->>'id')::uuid and q.estate_id = e.estate_id and q.status = 'open'
      on conflict (question_id) do nothing;
    when 'question.reopened@1' then
      delete from question_deferrals where question_id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
    -- A settled question is not waiting for next time.
    when 'question.answered@1', 'question.withdrawn@1' then
      delete from question_deferrals where question_id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
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
end;
$$;

-- Set one open question aside, with a reason.
create or replace function defer_question(
  p_estate_id uuid, p_project_id uuid, p_question_id uuid, p_command_id uuid, p_reason text, p_actor jsonb
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  existing question_deferral_commands;
  q        questions;
  v_seq    bigint;
begin
  select * into existing from question_deferral_commands where command_id = p_command_id;
  if existing.command_id is not null then
    if existing.question_id <> p_question_id or existing.action <> 'defer' then
      raise exception 'that command id already did something to a different question' using errcode = 'invalid_parameter_value';
    end if;
    return jsonb_build_object('deferred_seq', existing.seq, 'repeated', true);
  end if;
  if coalesce(p_actor->>'kind', '') <> 'person' then
    raise exception 'only a person sets a question aside' using errcode = 'insufficient_privilege';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'a question is set aside with a reason' using errcode = 'invalid_parameter_value';
  end if;
  select * into q from questions where id = p_question_id and estate_id = p_estate_id for update;
  if q.id is null or q.project_id is distinct from p_project_id then
    raise exception 'no such question' using errcode = 'no_data_found';
  end if;
  if q.status <> 'open' then
    raise exception 'that question is already %, and a settled question is not set aside', q.status using errcode = 'invalid_parameter_value';
  end if;
  if exists (select 1 from question_deferrals where question_id = p_question_id) then
    raise exception 'that question is already set aside' using errcode = 'invalid_parameter_value';
  end if;
  select seq into v_seq from append_event(p_estate_id, 'question.deferred@1', p_actor,
    jsonb_build_object('id', p_question_id, 'reason', p_reason), '1', p_project_id);
  insert into question_deferral_commands (command_id, estate_id, question_id, action, seq)
  values (p_command_id, p_estate_id, p_question_id, 'defer', v_seq);
  return jsonb_build_object('deferred_seq', v_seq, 'repeated', false);
end $$;

-- Return a set-aside question to the board.
create or replace function reopen_question(
  p_estate_id uuid, p_project_id uuid, p_question_id uuid, p_command_id uuid, p_actor jsonb
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  existing question_deferral_commands;
  q        questions;
  v_seq    bigint;
begin
  select * into existing from question_deferral_commands where command_id = p_command_id;
  if existing.command_id is not null then
    if existing.question_id <> p_question_id or existing.action <> 'reopen' then
      raise exception 'that command id already did something to a different question' using errcode = 'invalid_parameter_value';
    end if;
    return jsonb_build_object('reopened_seq', existing.seq, 'repeated', true);
  end if;
  if coalesce(p_actor->>'kind', '') <> 'person' then
    raise exception 'only a person returns a question to the board' using errcode = 'insufficient_privilege';
  end if;
  select * into q from questions where id = p_question_id and estate_id = p_estate_id for update;
  if q.id is null or q.project_id is distinct from p_project_id then
    raise exception 'no such question' using errcode = 'no_data_found';
  end if;
  if not exists (select 1 from question_deferrals where question_id = p_question_id) then
    raise exception 'that question is not set aside' using errcode = 'invalid_parameter_value';
  end if;
  select seq into v_seq from append_event(p_estate_id, 'question.reopened@1', p_actor,
    jsonb_build_object('id', p_question_id), '1', p_project_id);
  insert into question_deferral_commands (command_id, estate_id, question_id, action, seq)
  values (p_command_id, p_estate_id, p_question_id, 'reopen', v_seq);
  return jsonb_build_object('reopened_seq', v_seq, 'repeated', false);
end $$;

-- A topic the owner writes: an open question on the project, asked by that person.
create or replace function ask_topic(
  p_estate_id uuid, p_project_id uuid, p_question_id uuid, p_command_id uuid, p_text text, p_note text, p_actor jsonb
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  existing questions;
  v_seq    bigint;
begin
  select * into existing from questions where asked_command_id = p_command_id;
  if existing.id is not null then
    return jsonb_build_object('question_id', existing.id, 'asked_seq', existing.seq, 'repeated', true);
  end if;
  if coalesce(p_actor->>'kind', '') <> 'person' then
    raise exception 'a board topic is written by a person' using errcode = 'insufficient_privilege';
  end if;
  if p_text is null or length(btrim(p_text)) = 0 then
    raise exception 'a topic needs its text' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (select 1 from projects where id = p_project_id and estate_id = p_estate_id) then
    raise exception 'no such project' using errcode = 'no_data_found';
  end if;
  select seq into v_seq from append_event(p_estate_id, 'question.asked@1', p_actor,
    jsonb_build_object('id', p_question_id, 'project_id', p_project_id, 'text', p_text,
      'why_blocked', nullif(btrim(coalesce(p_note, '')), ''), 'kind', 'decision',
      'options', '[]'::jsonb, 'command_id', p_command_id),
    '1', p_project_id);
  return jsonb_build_object('question_id', p_question_id, 'asked_seq', v_seq, 'repeated', false);
end $$;

-- Grants and RLS in migration 4's shape (P21: a missing grant looks exactly like an empty table).
alter table question_deferrals enable row level security;
alter table question_deferral_commands enable row level security;
create policy member_question_deferrals_read on question_deferrals
  for select to authenticated
  using (estate_id in (select member_estates()));
grant select on question_deferrals to authenticated;
grant select on question_deferrals, question_deferral_commands to service_role;
revoke insert, update, delete on question_deferrals, question_deferral_commands from anon, authenticated, service_role;
revoke all on question_deferral_commands from anon, authenticated;

grant execute on function defer_question(uuid, uuid, uuid, uuid, text, jsonb) to service_role;
grant execute on function reopen_question(uuid, uuid, uuid, uuid, jsonb) to service_role;
grant execute on function ask_topic(uuid, uuid, uuid, uuid, text, text, jsonb) to service_role;
revoke execute on function defer_question(uuid, uuid, uuid, uuid, text, jsonb) from anon, authenticated, public;
revoke execute on function reopen_question(uuid, uuid, uuid, uuid, jsonb) from anon, authenticated, public;
revoke execute on function ask_topic(uuid, uuid, uuid, uuid, text, text, jsonb) from anon, authenticated, public;

-- Schema 68 as a private-archive source (ADR-0079 decision 5: later schemas need explicit
-- qualification). Migration 68 changes no archived table; an ordinary journal from schema 68 may
-- carry question.deferred@1 and question.reopened@1, which only a schema that registers them can
-- restore. An export now names the schema it was taken from, 68; import accepts archives from 66,
-- 67 and 68 and refuses any other source. The bodies below are migration 67's, changed only at
-- those two points.
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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

  v_archive:=jsonb_build_object('schema','CeoPrivateArchive@1','archive_id',gen_random_uuid(),'source_schema_version',68,'owner_person_id',p_person_id,
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
