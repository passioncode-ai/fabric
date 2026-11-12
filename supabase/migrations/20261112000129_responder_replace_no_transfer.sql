-- 102 (by count; suffix 129): `com.responder_replace` without a transfer works (the hyperframes thread, 2026-11-12).
--
-- NUMBERS. `schema_version()` counts applied migrations, so this file makes the schema 102.
--
-- WHAT. `board_responder_replace` walked its transferred requests with `foreach x in array (select array_agg(...))`.
-- With no `transfer` the aggregate is NULL, and PL/pgSQL refuses FOREACH over NULL with SQLSTATE 22004, which the board
-- service answers as `invalid_arguments` «The board could not take a value in these arguments». So every takeover of a
-- slot without a transfer failed since migration 107; the DB suite only replaced with one. The function below is
-- migration 124's, with that one loop reading an empty array instead of NULL. Nothing else changes.
--
-- WHY THE ARCHIVE FUNCTION. Every schema step admits itself as a private-archive source (migration 127's rule): the
-- second function is migration 128's `ceo_private_archive_canonical` with 102 added to the admitted list, nothing else.
-- #region responder-replace-no-transfer — docs: docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md#5-leases-fences-and-the-clock
create or replace function board_responder_replace(p_estate uuid, p_holder jsonb, p_project uuid, p_args jsonb, p_digest text)
returns jsonb language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare s jsonb := p_args; v_refusal jsonb; v_gate jsonb; v_cap text; v_grant uuid; slot board_responder_slots; v_gen bigint; v_old uuid;
        v_enrollment uuid := gen_random_uuid(); v_receipt jsonb; v_epoch integer; v_key text; x text; r board_requests; v_attempt uuid;
        v_transfer uuid[] := '{}'; v_summary text; v_evidence jsonb; v_fence jsonb; v_digest text; v_transferred jsonb := '[]'::jsonb;
begin
  v_refusal := board_responder_refusal(p_estate, p_holder, p_project, s, p_digest, array['idempotency', 'capability', 'expectedGeneration', 'transfer']);
  if v_refusal is not null then return v_refusal; end if;
  v_refusal := board_idempotency_refusal(s);
  if v_refusal is not null then return v_refusal; end if;
  v_cap := s->>'capability';
  if coalesce(v_cap, '') !~ '^[a-z][a-z0-9._-]{1,127}$' then return board_refusal('invalid_arguments', 'Name the capability whose slot you take.'); end if;
  if jsonb_typeof(s->'expectedGeneration') is distinct from 'number' or (s->>'expectedGeneration') !~ '^[0-9]{1,16}$' then
    return board_refusal('invalid_arguments', 'expectedGeneration is the slot generation com.status showed you.');
  end if;
  if s ? 'transfer' then
    if jsonb_typeof(s->'transfer') is distinct from 'object' or exists (select 1 from jsonb_object_keys(s->'transfer') k where k not in ('requests', 'checkpoint'))
       or jsonb_typeof(s->'transfer'->'requests') is distinct from 'array' or jsonb_array_length(s->'transfer'->'requests') not between 1 and 64
       or (select count(*) <> count(distinct value) from jsonb_array_elements_text(s->'transfer'->'requests'))
       or jsonb_typeof(s->'transfer'->'checkpoint') is distinct from 'object'
       or exists (select 1 from jsonb_object_keys(s->'transfer'->'checkpoint') k where k not in ('summary', 'evidence'))
       or jsonb_typeof(s->'transfer'->'checkpoint'->'summary') is distinct from 'string'
       or length(s->'transfer'->'checkpoint'->>'summary') not between 1 and 2000
       or jsonb_typeof(coalesce(s->'transfer'->'checkpoint'->'evidence', '[]'::jsonb)) is distinct from 'array'
       or jsonb_array_length(coalesce(s->'transfer'->'checkpoint'->'evidence', '[]'::jsonb)) > 8 then
      return board_refusal('invalid_arguments', 'A transfer names 1 to 64 accepted requests and a checkpoint summary.');
    end if;
    for x in select value from jsonb_array_elements_text(s->'transfer'->'requests') loop
      if not board_is_uuid(x) then return board_refusal('invalid_arguments', 'A transferred request must be an accepted request of this Project and capability.'); end if;
      v_transfer := v_transfer || x::uuid;
    end loop;
    v_summary := s->'transfer'->'checkpoint'->>'summary';
    v_evidence := coalesce(s->'transfer'->'checkpoint'->'evidence', '[]'::jsonb);
  end if;
  v_grant := board_grant_for(p_estate, p_holder, p_project, v_cap);
  if v_grant is null then
    return board_refusal('not_authorized', format('The operator has not let this agent answer %s requests for this project: the operator grants it in Fabric, Settings → Agent access. Until then a com.reply on the request is still your answer: a reply from the request''s target answers it, so reply with the answer itself.', v_cap));
  end if;
  perform board_slot_lock(p_estate, p_project, v_cap);
  -- ADR-0149 §5's order (wave-2 fix 6): the slot, then the request rows this command may move, then the key, then
  -- (inside the append) the estate. Taken before the gate, so a takeover never holds the estate lock while it waits for
  -- a row a cancel or the tick holds (they take the row first), nor the Project's epoch row a self-addressed cancel needs.
  perform 1 from board_requests where estate_id = p_estate and target_project = p_project and capability = v_cap
     and state in ('claimed', 'in_progress') order by submitted_seq for update;
  v_epoch := (s->'idempotency'->>'epoch')::integer; v_key := s->'idempotency'->>'key';
  v_gate := board_epoch_gate(p_estate, p_project, 'responder_replace', v_epoch, v_key, p_digest, true);
  if not (v_gate ? 'fresh') then return v_gate; end if;
  select * into slot from board_responder_slots where estate_id = p_estate and project_id = p_project and capability = v_cap for update;
  if coalesce(slot.generation, 0) <> (s->>'expectedGeneration')::bigint then
    return board_refusal('revision_conflict', format('The slot is at generation %s, not %s; read com.status and decide again.', coalesce(slot.generation, 0), s->>'expectedGeneration'));
  end if;
  -- Every transferred request is checked before the first write.
  for r in select * from board_requests where estate_id = p_estate and message_id = any (v_transfer) order by submitted_seq for update loop
    if r.target_project <> p_project or r.capability <> v_cap or r.state <> 'accepted' then
      return board_refusal('invalid_arguments', 'A transferred request must be an accepted request of this Project and capability.');
    end if;
  end loop;
  if (select count(*) from board_requests where estate_id = p_estate and message_id = any (v_transfer)) <> cardinality(v_transfer) then
    return board_refusal('invalid_arguments', 'A transferred request must be an accepted request of this Project and capability.');
  end if;
  v_gen := coalesce(slot.generation, 0) + 1;
  select id into v_old from board_enrollments where estate_id = p_estate and id = slot.holder_enrollment and released_seq is null;
  perform board_append(p_estate, 'comms.responder_enrolled@1', board_actor(p_holder), jsonb_strip_nulls(jsonb_build_object(
    'enrollment_id', v_enrollment, 'project_id', p_project, 'capability', v_cap, 'generation', v_gen,
    'session_id', p_holder->>'session_id', 'came_in', p_holder->>'came_in', 'agent', p_holder->>'agent', 'binding_id', p_holder->>'binding_id',
    'grant_id', v_grant, 'principal', board_holder_principal(p_holder), 'cause', 'replace', 'replaced_enrollment_id', v_old,
    'transfer', case when cardinality(v_transfer) > 0 then to_jsonb(v_transfer) end)));
  update board_responder_slots set lease_until = board_lease_until() where estate_id = p_estate and project_id = p_project and capability = v_cap;
  perform board_replacement_effects(p_estate, p_project, v_cap, v_gen, 'stale', board_actor(p_holder));
  -- The transfer: each accepted request continues under a new attempt of the new generation, and the checkpoint is
  -- posted as a fenced reply on its thread, history its participants read.
  -- Migration 129: an empty transfer is an empty array, never NULL; FOREACH over NULL raised SQLSTATE 22004.
  foreach x in array coalesce((select array_agg(v::text) from unnest(v_transfer) v), '{}'::text[]) loop
    v_attempt := gen_random_uuid();
    perform board_move(p_estate, x::uuid, 'replace', 'accepted', (select effect from board_requests where estate_id = p_estate and message_id = x::uuid),
      'replaced', board_actor(p_holder), jsonb_build_object('generation', v_gen, 'attempt_id', v_attempt, 'enrollment_id', v_enrollment));
    update board_attempts set lease_until = board_lease_until() where estate_id = p_estate and id = v_attempt;
    v_fence := jsonb_build_object('generation', v_gen, 'attempt_id', v_attempt, 'enrollment_id', v_enrollment);
    perform board_insert_fenced_message(p_estate, p_project, p_holder, x::uuid, v_summary, 'text/plain', v_evidence, p_digest, 'com.responder_replace', v_fence);
    -- Contract DEC-0078: the receipt names each transferred request once, with its revision and its new attempt.
    v_transferred := v_transferred || jsonb_build_array(jsonb_build_object('request', x::uuid,
      'revision', (select revision from board_requests where estate_id = p_estate and message_id = x::uuid),
      'attempt', board_attempt_json(p_estate, v_attempt)));
  end loop;
  v_receipt := jsonb_build_object('ok', true, 'repeated', false, 'slot', board_slot_json(p_estate, p_project, v_cap))
    || case when jsonb_array_length(v_transferred) > 0 then jsonb_build_object('transferred', v_transferred) else '{}'::jsonb end;
  perform board_store_receipt(p_estate, p_project, 'responder_replace', v_epoch, v_key, p_digest, v_receipt);
  return v_receipt;
end $$;
-- #endregion responder-replace-no-transfer

-- #region private-archive-source-schema — docs: docs/adr/0079-private-conversation-archives-preserve-history-not-authority.md#decision
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb,'71'::jsonb,'72'::jsonb,'73'::jsonb,'74'::jsonb,'75'::jsonb,'76'::jsonb,'77'::jsonb,'78'::jsonb,'79'::jsonb,'80'::jsonb,'81'::jsonb,'82'::jsonb,'83'::jsonb,'84'::jsonb,'85'::jsonb,'86'::jsonb,'87'::jsonb,'88'::jsonb,'89'::jsonb,'90'::jsonb,'91'::jsonb,'92'::jsonb,'93'::jsonb,'94'::jsonb,'95'::jsonb,'96'::jsonb,'97'::jsonb,'98'::jsonb,'99'::jsonb,'100'::jsonb,'101'::jsonb,'102'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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
