-- 88 (by count; suffix 107) — the project board's wave-2 fix round, COM-03 of
-- `docs/evidence/plans/2026-10-04-project-communications.md`, decided in ADR-0149 Amendment 2 and contract DEC-0078
-- (fabric-agent-contract f00a768, pinned by the same change).
--
-- NUMBERS. `schema_version()` counts applied migrations, so this file makes the schema 88. Suffixes 105/106 stay the
-- task pipeline's prose reservation (`docs/evidence/plans/task-pipeline-persistence-contract.md`).
--
-- WHAT THIS CHANGES (each a `create or replace` of a function migrations 86/87 created, same signature, so its grants
-- stand; no table changes, no event types):
--   * `board_epoch_gate`: renew and progress are refused under a CLOSED epoch too (fix 5; DEC-0073 says a closed or
--     retired epoch is refused as for any call). Migration 86's bytes are frozen by the ledger, hence this file.
--   * `board_status`: unread counts only deliveries whose message the board holds (fix 3).
--   * `board_enroll`, `board_responder_replace`, `board_claim`, `board_release`: ADR-0149 §5's lock order — the slot, the
--     request rows, the key, then the estate (fix 6); a release takes every slot lock, in one order, before it appends.
--   * `board_responder_replace`: its receipt carries `transferred` (DEC-0078); `board_claim` never reads back an
--     accepted request (ADR-0149 Amendment 1 §3 withdrawn).
--   * `board_fence`: a replay needs a live grant when the caller holds no enrollment (fix 9); the slot's current holder
--     meets `reconcile_required` on a request whose outcome is unknown (fix 8).
--   * `board_enroll`, `board_responder_replace`, `board_holder_enrollment`: the not_authorized text names the route the
--     agent has — the operator grants it in Settings → Agent access (product finding 16).
--   * `ceo_private_archive_canonical`: schema 88 imports as a private-archive source (ADR-0079 decision 5).
--
-- #region project-board-w2-fixes — docs: docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md#amendments

create or replace function board_epoch_gate(p_estate uuid, p_project uuid, p_operation text, p_epoch integer, p_key text, p_digest text, p_store boolean)
returns jsonb language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare v_current integer; ep board_epochs; existing board_idempotency;
begin
  -- One call per (Project, operation, epoch, key) at a time: a concurrent duplicate waits here and then reads the receipt.
  perform pg_advisory_xact_lock(hashtextextended(p_estate::text || '/' || p_project::text || '/' || p_operation || '/' || p_epoch::text || '/' || p_key, 4243));
  v_current := board_current_epoch(p_estate, p_project);
  if p_epoch > v_current then
    return board_refusal('invalid_arguments', 'This idempotency epoch has not been issued; read the current one with com.status.');
  end if;
  select * into ep from board_epochs where estate_id = p_estate and project_id = p_project and epoch = p_epoch for update;
  if not found or ep.state = 'retired' then
    return board_refusal('idempotency_window_expired', 'This idempotency epoch is retired; read the current one with com.status and send again.');
  end if;
  -- Renew and progress store no receipt, but a closed epoch refuses them as it refuses any new call (contract
  -- DEC-0073; wave-2 fix 5): only a stored receipt may still be answered under a closed epoch.
  if not p_store then
    if ep.state = 'closed' then
      return board_refusal('idempotency_window_expired', 'This epoch is closed; read the current one with com.status.');
    end if;
    return jsonb_build_object('fresh', true);
  end if;
  select * into existing from board_idempotency
   where estate_id = p_estate and sender_project = p_project and operation = p_operation and epoch = p_epoch and key = p_key;
  if found then
    if existing.digest = p_digest then return board_receipt_current(p_estate, existing.receipt) || jsonb_build_object('repeated', true); end if;
    return board_refusal('idempotency_conflict', 'This idempotency key was already used for a different call.');
  end if;
  if ep.state = 'closed' then
    return board_refusal('idempotency_window_expired', 'This epoch is closed; read the current one with com.status.');
  end if;
  if ep.keys >= board_epoch_capacity() then
    -- Capacity is a refusal before any effect, and the rotation it causes is committed with it.
    perform board_rotate_epoch(p_estate, p_project, ep.epoch, 'capacity');
    return board_refusal('capacity_exceeded',
      format('This idempotency epoch is full; the board opened epoch %s. Read it with com.status and send again.', ep.epoch + 1), true);
  end if;
  return jsonb_build_object('fresh', true);
end $$;

create or replace function board_status(p_estate_id uuid, p_reader uuid) returns jsonb
language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
begin
  if p_estate_id is null or p_reader is null then return board_refusal('invalid_arguments', 'The status request is not valid.'); end if;
  if not board_is_project(p_estate_id, p_reader) then return board_refusal('not_authorized', 'This Project may not read the board.'); end if;
  return jsonb_build_object('ok', true,
    -- Only a delivery whose message the board holds is unread (wave-2 fix 3): a restore whose board history did not
    -- come back rebuilds deliveries from the journal with no message row, which com.list and com.read_ack cannot reach.
    'unread', (select count(*)::integer from board_deliveries d where d.estate_id = p_estate_id and d.recipient_project = p_reader
                 and exists (select 1 from board_messages m where m.estate_id = d.estate_id and m.id = d.message_id)
                 and not exists (select 1 from board_read_marks r where r.estate_id = d.estate_id and r.reader_project = p_reader and r.message_id = d.message_id)),
    'epoch', board_current_epoch(p_estate_id, p_reader),
    'responders', board_responders_json(p_estate_id, p_reader));
end $$;

create or replace function board_holder_enrollment(p_estate uuid, p_holder jsonb, p_project uuid, p_capability text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare e board_enrollments;
begin
  select * into e from board_enrollments where estate_id = p_estate and project_id = p_project and capability = p_capability
     and session_id = p_holder->>'session_id' and released_seq is null;
  if not found then
    if board_grant_for(p_estate, p_holder, p_project, p_capability) is null then
      return board_refusal('not_authorized', format('The operator has not let this agent answer %s requests for this project: the operator grants it in Fabric, Settings → Agent access. Until then, reply on the request''s thread and say it stays queued.', p_capability));
    end if;
    return board_refusal('fenced', format('This session does not hold the responder slot for %s; call com.enroll first.', p_capability));
  end if;
  if not board_grant_live(p_estate, e.grant_id) then
    return board_refusal('authority_changed', 'The operator''s grant for this responder was revoked or expired; nothing was done.');
  end if;
  return jsonb_build_object('enrollment', e.id, 'generation', e.generation);
end $$;

create or replace function board_enroll(p_estate uuid, p_holder jsonb, p_project uuid, p_args jsonb, p_digest text)
returns jsonb language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare s jsonb := p_args; v_refusal jsonb; v_gate jsonb; v_cap text; v_grant uuid; slot board_responder_slots; holder board_enrollments;
        v_gen bigint; v_enrollment uuid := gen_random_uuid(); v_cause text; v_receipt jsonb; v_epoch integer; v_key text;
begin
  v_refusal := board_responder_refusal(p_estate, p_holder, p_project, s, p_digest, array['idempotency', 'capability']);
  if v_refusal is not null then return v_refusal; end if;
  v_refusal := board_idempotency_refusal(s);
  if v_refusal is not null then return v_refusal; end if;
  v_cap := s->>'capability';
  if coalesce(v_cap, '') !~ '^[a-z][a-z0-9._-]{1,127}$' then return board_refusal('invalid_arguments', 'Name the capability whose requests you will answer.'); end if;
  -- The grant first: no grant, no write of any kind — not even a receipt (COM03-01).
  v_grant := board_grant_for(p_estate, p_holder, p_project, v_cap);
  if v_grant is null then
    return board_refusal('not_authorized', format('The operator has not let this agent answer %s requests for this project: the operator grants it in Fabric, Settings → Agent access. Until then, reply on the request''s thread and say it stays queued.', v_cap));
  end if;
  perform board_slot_lock(p_estate, p_project, v_cap);
  -- ADR-0149 §5's order (wave-2 fix 6): the slot, then the request rows this command may move, then the key, then
  -- (inside the append) the estate. Taken before the gate, so a takeover never holds the estate lock while it waits for
  -- a row a cancel or the tick holds (they take the row first), nor the Project's epoch row a self-addressed cancel needs.
  perform 1 from board_requests where estate_id = p_estate and target_project = p_project and capability = v_cap
     and state in ('claimed', 'in_progress') order by submitted_seq for update;
  v_epoch := (s->'idempotency'->>'epoch')::integer; v_key := s->'idempotency'->>'key';
  v_gate := board_epoch_gate(p_estate, p_project, 'enroll', v_epoch, v_key, p_digest, true);
  if not (v_gate ? 'fresh') then return v_gate; end if;
  select * into slot from board_responder_slots where estate_id = p_estate and project_id = p_project and capability = v_cap for update;
  if slot.holder_enrollment is not null then
    select * into holder from board_enrollments where estate_id = p_estate and id = slot.holder_enrollment;
  end if;
  if holder.id is not null and holder.released_seq is null and holder.session_id = p_holder->>'session_id' then
    -- The caller already holds it: the same slot, its lease renewed (no event; renewals are operational).
    update board_responder_slots set lease_until = board_lease_until() where estate_id = p_estate and project_id = p_project and capability = v_cap;
  elsif holder.id is not null and holder.released_seq is null and slot.lease_until > clock_timestamp() then
    return board_refusal('fenced', 'Another responder holds this slot; use com.responder_replace.');
  else
    v_gen := coalesce(slot.generation, 0) + 1;
    v_cause := case when holder.id is not null and holder.released_seq is null then 'stale' else 'enroll' end;
    perform board_append(p_estate, 'comms.responder_enrolled@1', board_actor(p_holder), jsonb_strip_nulls(jsonb_build_object(
      'enrollment_id', v_enrollment, 'project_id', p_project, 'capability', v_cap, 'generation', v_gen,
      'session_id', p_holder->>'session_id', 'came_in', p_holder->>'came_in', 'agent', p_holder->>'agent', 'binding_id', p_holder->>'binding_id',
      'grant_id', v_grant, 'principal', board_holder_principal(p_holder), 'cause', v_cause,
      'replaced_enrollment_id', case when v_cause = 'stale' then holder.id end)));
    update board_responder_slots set lease_until = board_lease_until() where estate_id = p_estate and project_id = p_project and capability = v_cap;
    -- DEC-0073 R4: a slot left empty by a release is no lighter a takeover than a lapsed holder's for in_progress work.
    perform board_replacement_effects(p_estate, p_project, v_cap, v_gen, case when v_cause = 'stale' then 'stale' else 'empty' end, board_actor(p_holder));
  end if;
  v_receipt := jsonb_build_object('ok', true, 'repeated', false, 'slot', board_slot_json(p_estate, p_project, v_cap));
  perform board_store_receipt(p_estate, p_project, 'enroll', v_epoch, v_key, p_digest, v_receipt);
  return v_receipt;
end $$;

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
    return board_refusal('not_authorized', format('The operator has not let this agent answer %s requests for this project: the operator grants it in Fabric, Settings → Agent access. Until then, reply on the request''s thread and say it stays queued.', v_cap));
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
  foreach x in array (select array_agg(v::text) from unnest(v_transfer) v) loop
    exit when x is null;
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

create or replace function board_claim(p_estate uuid, p_holder jsonb, p_project uuid, p_args jsonb, p_digest text)
returns jsonb language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare s jsonb := p_args; v_refusal jsonb; v_gate jsonb; v_cap text; v_held jsonb; slot board_responder_slots; r board_requests; a board_attempts;
        v_attempt uuid := gen_random_uuid(); v_done jsonb; v_receipt jsonb; v_epoch integer; v_key text; v_actor jsonb := board_actor(p_holder);
begin
  v_refusal := board_responder_refusal(p_estate, p_holder, p_project, s, p_digest, array['idempotency', 'capability', 'request']);
  if v_refusal is not null then return v_refusal; end if;
  v_refusal := board_idempotency_refusal(s);
  if v_refusal is not null then return v_refusal; end if;
  v_cap := s->>'capability';
  if coalesce(v_cap, '') !~ '^[a-z][a-z0-9._-]{1,127}$' then return board_refusal('invalid_arguments', 'Name the capability whose slot you hold.'); end if;
  if s ? 'request' and not board_is_uuid(s->>'request') then return board_refusal('not_authorized', 'This Project cannot claim that request.'); end if;
  perform board_slot_lock(p_estate, p_project, v_cap);
  v_held := board_holder_enrollment(p_estate, p_holder, p_project, v_cap);
  if v_held ? 'error' then return v_held; end if;
  select * into slot from board_responder_slots where estate_id = p_estate and project_id = p_project and capability = v_cap for update;
  if slot.holder_enrollment is distinct from (v_held->>'enrollment')::uuid then
    return board_refusal('fenced', 'A newer responder holds this slot; this call was not committed.');
  end if;
  if slot.lease_until is null or slot.lease_until <= clock_timestamp() then
    return board_refusal('lease_expired', 'Your responder lease lapsed; call com.enroll again.');
  end if;
  -- A named request: its row before the key (ADR-0149 §5's order, as the fence takes it; wave-2 fix 6), so a claim never
  -- holds the Project's epoch row while it waits for a row a self-addressed cancel holds.
  if s ? 'request' then
    select * into r from board_requests where estate_id = p_estate and message_id = (s->>'request')::uuid
       and target_project = p_project and capability = v_cap for update;
  end if;
  v_epoch := (s->'idempotency'->>'epoch')::integer; v_key := s->'idempotency'->>'key';
  v_gate := board_epoch_gate(p_estate, p_project, 'claim', v_epoch, v_key, p_digest, true);
  if not (v_gate ? 'fresh') then return v_gate; end if;

  if s ? 'request' then
    if r.message_id is null then return board_refusal('not_authorized', 'This Project cannot claim that request.'); end if;
    select * into a from board_attempts where estate_id = p_estate and request_id = r.message_id and ended_seq is null;
    if r.state in ('queued', 'claimed') and r.deadline is not null and r.deadline < clock_timestamp() then
      perform board_move(p_estate, r.message_id, 'expire', 'expired', r.effect, 'deadline', jsonb_build_object('kind', 'system', 'id', 'board'), null);
      return board_refusal('invalid_transition', 'This request''s deadline passed; it expired.');
    end if;
    -- Contract DEC-0078: com.claim never moves or reads back an accepted request; a transfer's attempts reach the new
    -- holder in com.responder_replace's receipt (`transferred`). ADR-0149 Amendment 1 §3's read-back is withdrawn.
    if not (r.state = 'queued' or (r.state = 'claimed' and (a.id is null or a.lease_until is null or a.lease_until <= clock_timestamp()))) then
      return board_refusal('invalid_transition', format('This request is %s; it cannot be claimed.', replace(r.state, '_', ' ')));
    end if;
  else
    -- A passed deadline expires here too, lazily, before the pick (the tick does the same every minute).
    for r in select * from board_requests where estate_id = p_estate and target_project = p_project and capability = v_cap
               and state in ('queued', 'claimed') and deadline is not null and deadline < clock_timestamp() order by submitted_seq for update skip locked loop
      perform board_move(p_estate, r.message_id, 'expire', 'expired', r.effect, 'deadline', jsonb_build_object('kind', 'system', 'id', 'board'), null);
    end loop;
    r := null;
    select * into r from board_requests where estate_id = p_estate and target_project = p_project and capability = v_cap and state = 'queued'
       and (deadline is null or deadline >= clock_timestamp()) order by submitted_seq limit 1 for update skip locked;
    if r.message_id is null then
      -- A lapsed claim: its attempt ended (a release) or its lease ran out.
      select q.* into r from board_requests q where q.estate_id = p_estate and q.target_project = p_project and q.capability = v_cap and q.state = 'claimed'
         and (q.deadline is null or q.deadline >= clock_timestamp())
         and not exists (select 1 from board_attempts x where x.estate_id = q.estate_id and x.request_id = q.message_id and x.ended_seq is null
                          and x.lease_until > clock_timestamp())
       order by q.submitted_seq limit 1 for update skip locked;
    end if;
    if r.message_id is null then
      -- Nothing claimable: no receipt is stored, so the same key may poll again (DEC-0073 §3).
      return jsonb_build_object('ok', true, 'repeated', false);
    end if;
  end if;
  v_done := board_move(p_estate, r.message_id, 'claim', 'claimed', r.effect, 'responder', v_actor,
    jsonb_build_object('generation', slot.generation, 'attempt_id', v_attempt, 'enrollment_id', (v_held->>'enrollment')::uuid));
  update board_attempts set lease_until = board_lease_until() where estate_id = p_estate and id = v_attempt;
  update board_responder_slots set lease_until = board_lease_until() where estate_id = p_estate and project_id = p_project and capability = v_cap;
  v_receipt := jsonb_build_object('ok', true, 'repeated', false, 'message', r.message_id, 'request', v_done->'request',
    'attempt', board_attempt_json(p_estate, v_attempt));
  perform board_store_receipt(p_estate, p_project, 'claim', v_epoch, v_key, p_digest, v_receipt);
  return v_receipt;
end $$;

create or replace function board_fence(p_estate uuid, p_holder jsonb, p_project uuid, p_fence jsonb, p_op text, p_digest text) returns jsonb
language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare f jsonb := p_fence; r board_requests; e board_enrollments; slot board_responder_slots; a board_attempts; v_gate jsonb; v_digest text;
        v_store boolean := p_op not in ('renew', 'progress');
begin
  v_gate := board_fence_shape_refusal(f);
  if v_gate is not null then return v_gate; end if;
  -- 1
  select * into r from board_requests where estate_id = p_estate and message_id = (f->>'request')::uuid and target_project = p_project;
  if not found then return board_refusal('not_authorized', 'This Project cannot act on that request.'); end if;
  -- 2
  perform board_slot_lock(p_estate, p_project, r.capability);
  select * into r from board_requests where estate_id = p_estate and message_id = r.message_id for update;
  select * into slot from board_responder_slots where estate_id = p_estate and project_id = p_project and capability = r.capability;
  -- 3: the enrollment this session holds at the fence's generation, released or not; its grant must still be live.
  select * into e from board_enrollments where estate_id = p_estate and project_id = p_project and capability = r.capability
     and session_id = p_holder->>'session_id' and generation = (f->>'generation')::bigint order by enrolled_seq desc limit 1;
  if e.id is not null and not board_grant_live(p_estate, e.grant_id) then
    return board_refusal('authority_changed', 'The operator''s grant for this responder was revoked or expired; nothing was done.');
  end if;
  -- 3b: a caller with no enrollment at that generation replays nothing without a live grant (wave-2 fix 9): the
  -- contract returns a stored receipt only after current authorization.
  if e.id is null and board_grant_for(p_estate, p_holder, p_project, r.capability) is null then
    return board_refusal('not_authorized', 'This Project cannot act on that request.');
  end if;
  -- 4
  v_gate := board_epoch_gate(p_estate, p_project, p_op, (f->'idempotency'->>'epoch')::integer, f->'idempotency'->>'key', p_digest, v_store);
  if not (v_gate ? 'fresh') then
    return case when v_gate ? 'error' then v_gate else jsonb_build_object('repeat', v_gate) end;
  end if;
  -- 5
  select m.digest into v_digest from board_messages m where m.estate_id = p_estate and m.id = r.message_id;
  if v_digest is distinct from f->>'digest' then
    return board_refusal('digest_conflict', 'The fence names another digest than this request''s; read the request again.');
  end if;
  -- 6
  if e.id is null or e.released_seq is not null or slot.generation is distinct from (f->>'generation')::bigint or slot.holder_enrollment is distinct from e.id then
    return board_refusal('fenced', 'A newer responder holds this slot; this call was not committed.');
  end if;
  -- 7a: the slot's current holder, on a request whose outcome became unknown (a requester's cancel after the effect
  -- began, or a lost result): only com.reconcile with an observed result settles it (wave-2 fix 8; spec §2.2 item 10).
  if r.state = 'outcome_unknown' then
    return board_refusal('reconcile_required', 'This request''s outcome is unknown: it may have happened. Settle it with com.reconcile and an observed result.');
  end if;
  -- 7
  select * into a from board_attempts where estate_id = p_estate and id = (f->>'attempt')::uuid;
  if a.id is null or a.ended_seq is not null or r.attempt_id is distinct from a.id or a.generation <> (f->>'generation')::bigint then
    return board_refusal('fenced', 'This attempt is no longer the request''s; this call was not committed.');
  end if;
  -- 8
  if slot.lease_until is null or slot.lease_until <= clock_timestamp() or a.lease_until is null or a.lease_until <= clock_timestamp() then
    return board_refusal('lease_expired', 'Your lease lapsed; this call was not committed. Claim the request again if it is still yours to take.');
  end if;
  -- 9
  if f ? 'expectedRevision' and (f->>'expectedRevision')::bigint <> r.revision then
    return board_refusal('revision_conflict', format('The request is at revision %s, not %s; read it and decide again.', r.revision, f->>'expectedRevision'));
  end if;
  return jsonb_build_object('ok', true, 'enrollment', e.id, 'generation', e.generation, 'attempt', a.id, 'request', r.message_id, 'capability', r.capability,
    'state', r.state, 'effect', r.effect);
end $$;

create or replace function board_release(p_estate uuid, p_where text, p_value text, p_cause text) returns jsonb
language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare e board_enrollments; n integer := 0; k record;
begin
  -- Every slot lock first, in one stable order, before the first append (wave-2 fix 6; ADR-0149 §5): a release never
  -- holds the estate lock while it waits for a slot an enroll, a claim or a fence holds — they take the slot first.
  for k in select distinct project_id, capability from board_enrollments where estate_id = p_estate and released_seq is null
             and case p_where when 'session' then session_id = p_value when 'grant' then grant_id::text = p_value else false end
             order by project_id, capability loop
    perform board_slot_lock(p_estate, k.project_id, k.capability);
  end loop;
  for e in select * from board_enrollments where estate_id = p_estate and released_seq is null
             and case p_where when 'session' then session_id = p_value when 'grant' then grant_id::text = p_value else false end
             order by enrolled_seq loop
    -- Already held (an advisory lock is re-entrant in its transaction); only an enrollment that appeared since the
    -- first loop would wait here.
    perform board_slot_lock(p_estate, e.project_id, e.capability);
    if exists (select 1 from board_enrollments where estate_id = p_estate and id = e.id and released_seq is null) then
      perform board_append(p_estate, 'comms.responder_released@1', jsonb_build_object('kind', 'system', 'id', 'board'), jsonb_build_object(
        'enrollment_id', e.id, 'project_id', e.project_id, 'capability', e.capability, 'generation', e.generation, 'cause', p_cause));
      update board_responder_slots set lease_until = null where estate_id = p_estate and project_id = e.project_id and capability = e.capability and holder_enrollment is null;
      n := n + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'released', n);
end $$;
-- #endregion project-board-w2-fixes

-- ── schema 88 as a private-archive source ─────────────────────────────────────────────────────────────────────
-- ADR-0079 decision 5, as every step since 67 did: an archive exported at this schema imports. Migration 87's
-- canonical body with 88 added. Nothing else changes.
-- #region private-archive-source-schema — docs: docs/adr/0079-private-conversation-archives-preserve-history-not-authority.md#decision
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb,'71'::jsonb,'72'::jsonb,'73'::jsonb,'74'::jsonb,'75'::jsonb,'76'::jsonb,'77'::jsonb,'78'::jsonb,'79'::jsonb,'80'::jsonb,'81'::jsonb,'82'::jsonb,'83'::jsonb,'84'::jsonb,'85'::jsonb,'86'::jsonb,'87'::jsonb,'88'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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
