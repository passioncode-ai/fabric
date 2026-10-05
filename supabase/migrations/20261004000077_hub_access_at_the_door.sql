-- 77 — the hub's tables at the door, across a restore, and in the schema's own words (verification of
-- Fabric 0.3.1, iteration 1: DA-1, DA-2, DA-3, DA-4, ER-2, DA-7, DO-5; ADR-0115, ADR-0103, ADR-0077).
--
-- Migration 76 is on main (67a5dc42) and in no release, but its text is executed and dated, so it is not
-- rewritten; what it got wrong is corrected here.
--
-- 1. AN ID BELONGS TO ONE ESTATE — THE HUB'S CREATES TOO (DA-1, ADR-0103's two halves).
--    Migration 76 added four tables keyed on a global `id` and did not extend `refuse_foreign_identity`.
--    MEASURED by the reviewer on an owned cluster: estate B appending `access.requested@1` with estate A's
--    request id was ACCEPTED and journalled in B a fact no projection of B shows (`on conflict (id) do
--    nothing`) — exactly what migration 72 refused for eleven arms — and the binding, grant and connection
--    creates refused only in the projector, with a raw unique_violation whose DETAIL named the id: a yes/no
--    read of another estate's row. And `asked_by_binding` had no check at all: B's request naming A's binding
--    was accepted.
--      a. The door. `refuse_foreign_identity` (migration 73's body, unchanged) now calls
--         `refuse_foreign_hub_identity`, which locks and refuses, in the door's own sentence,
--         `access.requested@1` → access_requests(id), `access.decided@1` → access_bindings(binding_id, when
--         it creates one) and access_grants(every grants[].id), `product.connected@1` →
--         product_connections(id); and an `access.requested@1` whose `binding_id` is not a LIVE binding of
--         this estate — said in one sentence whether the binding is another estate's or nobody's, so the
--         refusal answers no question about another estate.
--      b. The projector keeps skipping a foreign row on replay: `access_requests`' `on conflict (id) do
--         nothing` stays, so a journal that already holds such an event (only a service-role caller could have
--         written one, before this migration) replays without touching A and without failing.
--
-- 2. RESTORED HUB HISTORY IS HISTORY, NOT AUTHORITY (DA-2, ADR-0077's rule, applied to the hub).
--    MEASURED by the reviewer: `restore_estate` of an archive carrying an allow, a credential claim and a
--    product connection left the target with a live binding WITH its verifier, a live grant and a live
--    connection — a credential nobody in the target issued, standing grants for a year, and a connection
--    naming this machine's vault slot. `apply_hub_access` never consulted `estate_restore_boundaries`, unlike
--    the owner arm (migration 65). Now an event at or below the target's restore watermark projects as
--    history only: the requests and decisions keep their rows; a binding the archive created is projected
--    REVOKED at its own decision (`revoked_by` = 'restore-boundary') and never receives a verifier; its
--    grants are projected revoked; a restored `product.connected@1` is projected removed (`removed_by` =
--    'restore-boundary'). The archive's own later revocations then find nothing live and replay as no-ops.
--    The operator consents again, and reconnects, in the restored estate; what they do there is live
--    (events above the watermark are ordinary). The boundary row is immutable, so a rebuild projects the
--    same history the same way.
--
-- 3. A RESTORE BESIDE ITS SOURCE SAYS WHY (DA-3). `restore_estate_events` (migration 66's body) first counts
--    the archive's hub ids that another estate in this database already holds, and refuses with migration
--    65's designed "restore collided … Restore into a database that does not already hold this estate."
--    Before, it failed on the first decision with "access.decided@1 names no request of this estate".
--
-- 4. THE WRITER'S PROMISES BECOME THE SCHEMA'S (DA-4). Nothing but the writer held them; now the projector
--    refuses, from the event and the rows alone (`occurred_at`, never `now()`):
--      * a `product.connected@1` whose `secret_ref` is not exactly {project, env, name} — so a `value` (the
--        secret itself) can never be journalled; `name` is an upper-case vault slot name;
--      * a request that expires more than 10 minutes (plus 2 minutes of clock skew between the app and the
--        database) after it was asked, and a grant that lasts more than 366 days from its decision;
--      * a `hub.call.forwarded@1` span carrying a key outside the documented span set (hubCall.ts): never
--        the arguments, only their hash.
--
-- 5. A REQUEST CARRIES THE VERIFIER OF ITS POLL SECRET (ER-2). `access_requests.poll_verifier` is the
--    sha256 (hex) of a per-request secret the hub returns only to the caller that CREATED the request
--    (RFC 8628's device_code); `fabric.access.status` requires it. Null for a request written before 77.
--
-- 6. THE PRODUCT'S OWN NO IS JOURNALLED (DA-7). `product.connect.refused@1` {product, outcome 'denied' |
--    'failed', error} records that the product's prompt was refused or failed; it projects nothing.
--
-- 7. THE CATALOGUE SAYS THE ORDER THE CODE KEEPS (DO-5). `product.connected@1` is appended once the vault
--    has stored the secret; the note said so loosely and Amendment 4 of ADR-0115 had reversed it for a time.
--
-- Schema 77: an export names 77; import accepts 66 to 77 (ADR-0079 decision 5, as 67–76 did).

-- #region hub-access-at-the-door — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#verification-iteration-2-clarifications--2026-10-04

insert into event_types (type, projects, note) values
  ('product.connect.refused@1', false, 'a cloud product''s own consent prompt was refused by the operator, or failed (no server, sign-in required, key not minted); Fabric connected nothing');

update event_types
   set note = 'a cloud product was connected by its own consent; recorded once its secret is stored in the vault — the metadata and the vault slot are here, never the secret'
 where type = 'product.connected@1';

alter table access_requests
  add column poll_verifier text check (poll_verifier ~ '^[0-9a-f]{64}$');
comment on column access_requests.poll_verifier is
  'sha256 (hex) of the per-request poll secret returned only to the caller that created the request (RFC 8628 device_code); fabric.access.status requires it. Null for requests written before migration 77.';

-- 1a. The hub's half of the door. Called by refuse_foreign_identity under the estate lock.
create or replace function refuse_foreign_hub_identity(
  p_estate_id uuid,
  p_type      text,
  p_payload   jsonb
) returns void
language plpgsql
volatile
security definer set search_path = public
as $$
declare
  v_ids    uuid[] := '{}';
  v_tables text[] := '{}';
  v_id     uuid;
  i        int;
  v_found  boolean;
begin
  if p_type not in ('access.requested@1', 'access.decided@1', 'product.connected@1') then return; end if;
  if jsonb_typeof(p_payload) is distinct from 'object' then return; end if;

  if p_type = 'access.requested@1' then
    v_ids := array[identity_uuid(p_payload->>'id')]; v_tables := array['access_requests'];
  elsif p_type = 'product.connected@1' then
    v_ids := array[identity_uuid(p_payload->>'id')]; v_tables := array['product_connections'];
  else
    if p_payload->>'new_binding' = 'true' then
      v_ids := array[identity_uuid(p_payload->>'binding_id')]; v_tables := array['access_bindings'];
    end if;
    if jsonb_typeof(p_payload->'grants') = 'array' then
      for v_id in select identity_uuid(g->>'id') from jsonb_array_elements(p_payload->'grants') g loop
        v_ids := v_ids || v_id; v_tables := v_tables || 'access_grants'::text;
      end loop;
    end if;
  end if;

  -- Lock every id first, in one order, so two estates creating overlapping ids cannot deadlock.
  for v_id in select distinct u from unnest(v_ids) u where u is not null order by 1 loop
    perform lock_global_identity(v_id);
  end loop;

  for i in 1 .. coalesce(array_length(v_ids, 1), 0) loop
    v_id := v_ids[i];
    continue when v_id is null;   -- a malformed id is the projector's own refusal, unchanged
    v_found := case v_tables[i]
      when 'access_requests'     then exists (select 1 from access_requests     where id = v_id and estate_id <> p_estate_id)
      when 'access_bindings'     then exists (select 1 from access_bindings     where id = v_id and estate_id <> p_estate_id)
      when 'access_grants'       then exists (select 1 from access_grants       where id = v_id and estate_id <> p_estate_id)
      when 'product_connections' then exists (select 1 from product_connections where id = v_id and estate_id <> p_estate_id)
      else false
    end;
    if v_found then
      raise exception using
        errcode = 'check_violation',
        message = format('%s carries a %s id that belongs to another estate. The id is global; '
                         'appending this event here would rewrite that estate''s row. Mint a new id.',
                         p_type, v_tables[i]);
    end if;
  end loop;

  -- An incremental request is asked by a binding THIS estate holds, live. Another estate's binding and a
  -- binding nobody holds get the same sentence: the refusal answers no question about another estate.
  if p_type = 'access.requested@1' and p_payload->'binding_id' is not null and p_payload->'binding_id' <> 'null'::jsonb then
    v_id := identity_uuid(p_payload->>'binding_id');
    if v_id is null or not exists (select 1 from access_bindings
                                    where id = v_id and estate_id = p_estate_id and revoked_at is null) then
      raise exception using
        errcode = 'check_violation',
        message = 'access.requested@1 names no live binding of this estate as the one asking. An incremental '
                  'request comes from a credential this estate holds; a first request carries no binding.';
    end if;
  end if;
end $$;
revoke execute on function refuse_foreign_hub_identity(uuid, text, jsonb) from public;
revoke execute on function refuse_foreign_hub_identity(uuid, text, jsonb) from anon, authenticated, service_role;

-- 1a (cont.). Migration 73's guard, its body unchanged but for the one call above the session block.
create or replace function refuse_foreign_identity(
  p_estate_id  uuid,
  p_type       text,
  p_payload    jsonb,
  p_project_id uuid
) returns void
language plpgsql
volatile
security definer set search_path = public
as $$
declare
  v_table   text;
  v_id      uuid;
  v_found   boolean := false;
  v_session uuid := identity_uuid(p_payload->>'session_id');
begin
  -- Every project-scoped event, whatever its type. Locked first: project, then entity, then session.
  if p_project_id is not null then
    perform lock_global_identity(p_project_id);
    if exists (select 1 from projects where id = p_project_id and estate_id <> p_estate_id) then
      raise exception using
        errcode = 'check_violation',
        message = format('%s names a project that belongs to another estate. A project id is global; '
                         'appending this event here would write into that estate. Mint a new id.', p_type);
    end if;
  end if;

  -- The entity the event creates or writes, keyed on a global id (migrations 70 and 72).
  case p_type
    when 'project.created@1'         then v_table := 'projects';              v_id := identity_uuid(p_payload->>'id');
    when 'project.repo.attached@1'   then v_table := 'project_repos';         v_id := identity_uuid(p_payload->>'id');
    when 'memory.project.recorded@1' then v_table := 'memory_facts';          v_id := identity_uuid(p_payload->>'id');
    when 'task.started@1'            then v_table := 'project_tasks';         v_id := identity_uuid(p_payload->>'id');
    when 'agent.stage.reported@1'    then v_table := 'agent_stages';          v_id := v_session;
    when 'transcript.captured@1'     then v_table := 'session_transcripts';   v_id := v_session;
    when 'context.compiled@1'        then v_table := 'session_context_packs'; v_id := v_session;
    when 'task.handoff@1'            then v_table := 'project_tasks';         v_id := identity_uuid(p_payload->>'task_id');
    when 'agent.heartbeat@1'         then v_table := 'session_heartbeats';    v_id := v_session;
    when 'agent.registered@1'        then v_table := 'agent_bindings';        v_id := identity_uuid(p_payload->>'id');
    when 'goal.defined@1'            then v_table := 'goals';                 v_id := identity_uuid(p_payload->>'id');
    when 'routine.defined@1'         then v_table := 'routines';              v_id := identity_uuid(p_payload->>'id');
    when 'proposal.filed@1'          then v_table := 'proposals';             v_id := identity_uuid(p_payload->>'id');
    when 'question.asked@1'          then v_table := 'questions';             v_id := identity_uuid(p_payload->>'id');
    when 'release.recorded@1'        then v_table := 'releases';              v_id := identity_uuid(p_payload->>'id');
    when 'task.created@1'            then v_table := 'project_tasks';         v_id := identity_uuid(p_payload->>'id');
    when 'task.note.added@1'         then v_table := 'task_notes';            v_id := identity_uuid(p_payload->>'note_id');
    when 'run.started@1'             then v_table := 'task_runs';             v_id := identity_uuid(p_payload->>'task_run_id');
    when 'delivery.queued@1'         then v_table := 'deliveries';            v_id := identity_uuid(p_payload->>'delivery_id');
    when 'memory.retrieved@1'        then v_table := 'memory_retrievals';     v_id := identity_uuid(p_payload->>'id');
    else null;
  end case;

  if v_id is not null then
    perform lock_global_identity(v_id);
    v_found := case v_table
      when 'projects'              then exists (select 1 from projects              where id = v_id and estate_id <> p_estate_id)
      when 'project_repos'         then exists (select 1 from project_repos         where id = v_id and estate_id <> p_estate_id)
      when 'memory_facts'          then exists (select 1 from memory_facts          where id = v_id and estate_id <> p_estate_id)
      when 'project_tasks'         then exists (select 1 from project_tasks         where id = v_id and estate_id <> p_estate_id)
                                        or (p_type = 'task.handoff@1'
                                            and exists (select 1 from task_handoffs where task_id = v_id and estate_id <> p_estate_id))
      when 'agent_stages'          then exists (select 1 from agent_stages          where session_id = v_id and estate_id <> p_estate_id)
      when 'session_transcripts'   then exists (select 1 from session_transcripts   where session_id = v_id and estate_id <> p_estate_id)
      when 'session_context_packs' then exists (select 1 from session_context_packs where session_id = v_id and estate_id <> p_estate_id)
      when 'session_heartbeats'    then exists (select 1 from session_heartbeats    where session_id = v_id and estate_id <> p_estate_id)
      when 'agent_bindings'        then exists (select 1 from agent_bindings        where id = v_id and estate_id <> p_estate_id)
      when 'goals'                 then exists (select 1 from goals                 where id = v_id and estate_id <> p_estate_id)
      when 'routines'              then exists (select 1 from routines              where id = v_id and estate_id <> p_estate_id)
      when 'proposals'             then exists (select 1 from proposals             where id = v_id and estate_id <> p_estate_id)
      when 'questions'             then exists (select 1 from questions             where id = v_id and estate_id <> p_estate_id)
      when 'releases'              then exists (select 1 from releases              where id = v_id and estate_id <> p_estate_id)
      when 'task_notes'            then exists (select 1 from task_notes            where id = v_id and estate_id <> p_estate_id)
      when 'task_runs'             then exists (select 1 from task_runs             where task_run_id = v_id and estate_id <> p_estate_id)
      when 'deliveries'            then exists (select 1 from deliveries            where delivery_id = v_id and estate_id <> p_estate_id)
      when 'memory_retrievals'     then exists (select 1 from memory_retrievals     where id = v_id and estate_id <> p_estate_id)
      else false
    end;
    if v_found then
      raise exception using
        errcode = 'check_violation',
        message = format('%s carries a %s id that belongs to another estate. The id is global; '
                         'appending this event here would rewrite that estate''s row. Mint a new id.',
                         p_type, v_table);
    end if;
  end if;

  -- Migration 77: the hub's four creates, and the binding an incremental request names.
  perform refuse_foreign_hub_identity(p_estate_id, p_type, p_payload);

  -- Migration 73: ANY event naming a session another estate holds, wherever it holds it.
  if v_session is not null then
    perform lock_global_identity(v_session);   -- re-entrant when the arm above already locked it
    if session_held_elsewhere(p_estate_id, v_session) then
      raise exception using
        errcode = 'check_violation',
        message = format('%s names a session that belongs to another estate. A session id is global; '
                         'appending this event here would take over that estate''s session. Mint a new id.', p_type);
    end if;
  end if;
end $$;
revoke execute on function refuse_foreign_identity(uuid, text, jsonb, uuid) from public;
revoke execute on function refuse_foreign_identity(uuid, text, jsonb, uuid) from anon, authenticated, service_role;
comment on function refuse_foreign_identity(uuid, text, jsonb, uuid) is
  'Write-boundary guard for append_event, called under the estate lock: locks and then refuses an event whose project, created or written entity id, or named session belongs to another estate (session ownership read from task_runs, project_tasks, session_heartbeats, agent_stages, session_transcripts and session_context_packs since migration 73; the hub''s access_requests, access_bindings, access_grants and product_connections, and the live binding an incremental request names, since migration 77). The upsert arms carry the matching estate predicate for events journalled before it existed.';

-- 2, 4, 5, 6. The projector: migration 76's arms, plus the restore boundary, the writer's promises as
-- refusals, the poll verifier and the product's own No. A refusal raises (append_event rolls back); a replay
-- of the same seq is still a no-op.
create or replace function apply_hub_access(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_req      access_requests;
  v_binding  uuid;
  v_id       uuid;
  g          jsonb;
  k          text;
  v_restored boolean;
begin
  if e.type not in ('access.requested@1', 'access.decided@1', 'access.credential.claimed@1', 'access.grant.revoked@1',
                    'access.binding.revoked@1', 'access.denial.cleared@1', 'product.connected@1', 'product.disconnected@1',
                    'product.connect.refused@1', 'hub.call.forwarded@1') then
    return;
  end if;
  -- Migration 77 (DA-2): at or below the target's restore watermark, hub history is history, not authority.
  v_restored := exists (select 1 from estate_restore_boundaries b
                         where b.target_estate_id = e.estate_id and e.seq <= b.watermark_seq);

  case e.type
    when 'access.requested@1' then
      if (e.payload->>'expires_at')::timestamptz > e.occurred_at + interval '12 minutes' then
        raise exception 'access.requested@1 expires at %, more than 10 minutes after it was asked; a request lives 10 minutes',
          e.payload->>'expires_at' using errcode = 'check_violation';
      end if;
      insert into access_requests (id, estate_id, agent_id, callee, capabilities, resources, reason, registry,
                                   asked_by_binding, requested_at, expires_at, poll_verifier, seq)
      values ((e.payload->>'id')::uuid, e.estate_id, e.payload->>'agent_id', e.payload->>'callee',
              coalesce((select array_agg(v order by o) from jsonb_array_elements_text(e.payload->'capabilities') with ordinality t(v, o)), '{}'),
              coalesce((select array_agg(v order by o) from jsonb_array_elements_text(e.payload->'resources') with ordinality t(v, o)), '{}'),
              e.payload->>'reason', coalesce(e.payload->'registry', '{}'::jsonb), (e.payload->>'binding_id')::uuid,
              e.occurred_at, (e.payload->>'expires_at')::timestamptz, e.payload->>'poll_verifier', e.seq)
      on conflict (id) do nothing;   -- a foreign row already journalled before 77 replays without touching it

    when 'access.decided@1' then
      select * into v_req from access_requests
       where id = (e.payload->>'request_id')::uuid and estate_id = e.estate_id for update;
      if v_req.id is null then
        raise exception 'access.decided@1 names no request of this estate' using errcode = 'check_violation';
      end if;
      if v_req.decided_seq = e.seq then return; end if;   -- a replay of this very decision
      if v_req.status <> 'pending' then
        raise exception 'that request was already %; a decision is made once', v_req.status using errcode = 'check_violation';
      end if;
      if e.occurred_at > v_req.expires_at then
        raise exception 'that request expired at %; the agent must ask again', v_req.expires_at using errcode = 'check_violation';
      end if;
      if e.payload->>'decision' = 'denied' then
        update access_requests set status = 'denied', decided_at = e.occurred_at, decided_by = e.actor->>'id', decided_seq = e.seq
         where id = v_req.id and estate_id = e.estate_id;
        return;
      end if;
      if e.payload->>'decision' <> 'allowed' then
        raise exception 'a decision is allowed or denied' using errcode = 'check_violation';
      end if;
      v_binding := (e.payload->>'binding_id')::uuid;
      if coalesce((e.payload->>'new_binding')::boolean, false) then
        if v_restored then
          -- Restored: the binding is history, revoked at its own decision; it never receives a verifier.
          insert into access_bindings (id, estate_id, agent_id, request_id, created_at, created_seq,
                                       revoked_at, revoked_by, revoked_seq)
          values (v_binding, e.estate_id, v_req.agent_id, v_req.id, e.occurred_at, e.seq,
                  e.occurred_at, 'restore-boundary', e.seq);
        else
          insert into access_bindings (id, estate_id, agent_id, request_id, created_at, created_seq)
          values (v_binding, e.estate_id, v_req.agent_id, v_req.id, e.occurred_at, e.seq);
        end if;
      elsif v_req.asked_by_binding is distinct from v_binding then
        raise exception 'an incremental grant goes to the binding that asked' using errcode = 'check_violation';
      end if;
      if not exists (select 1 from access_bindings where id = v_binding and estate_id = e.estate_id
                       and agent_id = v_req.agent_id and (revoked_at is null or v_restored)) then
        raise exception 'the binding is not this agent''s live binding' using errcode = 'check_violation';
      end if;
      update access_requests set status = 'allowed', decided_at = e.occurred_at, decided_by = e.actor->>'id',
                                 decided_seq = e.seq, granted_binding_id = v_binding
       where id = v_req.id and estate_id = e.estate_id;
      if jsonb_typeof(e.payload->'grants') is distinct from 'array' or jsonb_array_length(e.payload->'grants') = 0 then
        raise exception 'an allow writes at least one grant' using errcode = 'check_violation';
      end if;
      for g in select value from jsonb_array_elements(e.payload->'grants') loop
        -- Nothing widens silently: a grant names a capability and a resource the operator was shown.
        if not ((g->>'capability') = any (v_req.capabilities)) then
          raise exception 'grant capability % was not asked for', g->>'capability' using errcode = 'check_violation';
        end if;
        if not ((g->>'resource') = any (v_req.resources)) then
          raise exception 'grant resource % was not asked for', g->>'resource' using errcode = 'check_violation';
        end if;
        -- Migration 77 (DA-4): a grant lasts at most a year (366 days, for a leap year) from its decision.
        if (g->>'expires_at')::timestamptz > e.occurred_at + interval '366 days' then
          raise exception 'grant % expires at %, more than 366 days after it was decided; a grant lasts a year',
            g->>'id', g->>'expires_at' using errcode = 'check_violation';
        end if;
        if v_restored then
          -- Restored: the grant is history, revoked at its own decision. An extension of a grant the archive
          -- already wrote (same id) keeps that row.
          insert into access_grants (id, estate_id, binding_id, request_id, agent_id, callee, capability, resource,
                                     decided_by, decided_at, expires_at, decided_seq, revoked_at, revoked_by, revoked_seq)
          values ((g->>'id')::uuid, e.estate_id, v_binding, v_req.id, v_req.agent_id, v_req.callee, g->>'capability',
                  g->>'resource', e.actor->>'id', e.occurred_at, (g->>'expires_at')::timestamptz, e.seq,
                  e.occurred_at, 'restore-boundary', e.seq)
          on conflict do nothing;
        else
          -- Already held (live, or expired and never revoked): this decision extends that grant and becomes its
          -- latest decision; it never writes a second live row. The journal keeps every decision.
          insert into access_grants (id, estate_id, binding_id, request_id, agent_id, callee, capability, resource,
                                     decided_by, decided_at, expires_at, decided_seq)
          values ((g->>'id')::uuid, e.estate_id, v_binding, v_req.id, v_req.agent_id, v_req.callee, g->>'capability',
                  g->>'resource', e.actor->>'id', e.occurred_at, (g->>'expires_at')::timestamptz, e.seq)
          on conflict (estate_id, binding_id, callee, capability, resource) where revoked_at is null do update
            set request_id = excluded.request_id, decided_by = excluded.decided_by, decided_at = excluded.decided_at,
                decided_seq = excluded.decided_seq, expires_at = greatest(access_grants.expires_at, excluded.expires_at);
        end if;
      end loop;

    when 'access.credential.claimed@1' then
      v_id := (e.payload->>'binding_id')::uuid;
      if v_restored then
        -- Restored: the claim happened, in the source. No verifier crosses the boundary: a credential minted
        -- there must not authenticate here.
        update access_requests set credential_claimed_at = e.occurred_at
         where id = (e.payload->>'request_id')::uuid and estate_id = e.estate_id and granted_binding_id = v_id;
        if not found then
          raise exception 'the claim names a request that did not grant this binding' using errcode = 'check_violation';
        end if;
        return;
      end if;
      update access_bindings set verifier = e.payload->>'verifier', claimed_at = e.occurred_at, claimed_seq = e.seq
       where id = v_id and estate_id = e.estate_id and verifier is null and revoked_at is null;
      if not found then
        if exists (select 1 from access_bindings where id = v_id and estate_id = e.estate_id and claimed_seq = e.seq) then return; end if;
        raise exception 'that binding has no unclaimed credential' using errcode = 'check_violation';
      end if;
      update access_requests set credential_claimed_at = e.occurred_at
       where id = (e.payload->>'request_id')::uuid and estate_id = e.estate_id and granted_binding_id = v_id;
      if not found then
        raise exception 'the claim names a request that did not grant this binding' using errcode = 'check_violation';
      end if;

    when 'access.grant.revoked@1' then
      v_id := (e.payload->>'grant_id')::uuid;
      update access_grants set revoked_at = e.occurred_at, revoked_by = e.actor->>'id', revoked_seq = e.seq
       where id = v_id and estate_id = e.estate_id and revoked_at is null;
      if not found then
        if exists (select 1 from access_grants where id = v_id and estate_id = e.estate_id
                     and (revoked_seq = e.seq or v_restored)) then return; end if;
        raise exception 'no live grant of this estate has that id' using errcode = 'check_violation';
      end if;

    when 'access.binding.revoked@1' then
      v_id := (e.payload->>'binding_id')::uuid;
      update access_bindings set revoked_at = e.occurred_at, revoked_by = e.actor->>'id', revoked_seq = e.seq
       where id = v_id and estate_id = e.estate_id and revoked_at is null;
      if not found then
        if exists (select 1 from access_bindings where id = v_id and estate_id = e.estate_id
                     and (revoked_seq = e.seq or v_restored)) then return; end if;
        raise exception 'no live binding of this estate has that id' using errcode = 'check_violation';
      end if;
      update access_grants set revoked_at = e.occurred_at, revoked_by = e.actor->>'id', revoked_seq = e.seq
       where binding_id = v_id and estate_id = e.estate_id and revoked_at is null;

    when 'access.denial.cleared@1' then
      v_id := (e.payload->>'request_id')::uuid;
      update access_requests set denial_cleared_at = e.occurred_at, cleared_seq = e.seq
       where id = v_id and estate_id = e.estate_id and status = 'denied' and denial_cleared_at is null;
      if not found then
        if exists (select 1 from access_requests where id = v_id and estate_id = e.estate_id and cleared_seq = e.seq) then return; end if;
        raise exception 'no standing denial of this estate has that id' using errcode = 'check_violation';
      end if;

    when 'product.connected@1' then
      v_id := (e.payload->>'id')::uuid;
      if exists (select 1 from product_connections where id = v_id and estate_id = e.estate_id and connected_seq = e.seq) then return; end if;
      -- Migration 77 (DA-4): the slot, never the value.
      if jsonb_typeof(e.payload->'secret_ref') is distinct from 'object'
         or (select array_agg(x order by x) from jsonb_object_keys(e.payload->'secret_ref') x) is distinct from array['env', 'name', 'project']
         or jsonb_typeof(e.payload->'secret_ref'->'project') is distinct from 'string'
         or jsonb_typeof(e.payload->'secret_ref'->'env') is distinct from 'string'
         or jsonb_typeof(e.payload->'secret_ref'->'name') is distinct from 'string'
         or not coalesce(e.payload->'secret_ref'->>'project' ~ '^[a-z0-9][a-z0-9._-]{0,63}$', false)
         or not coalesce(e.payload->'secret_ref'->>'env' ~ '^[a-z0-9][a-z0-9._-]{0,63}$', false)
         or not coalesce(e.payload->'secret_ref'->>'name' ~ '^[A-Z][A-Z0-9_]{0,127}$', false) then
        raise exception 'product.connected@1 secret_ref names a vault slot — exactly {project, env, name}, the name in upper case — and nothing else; never the secret'
          using errcode = 'check_violation';
      end if;
      if v_restored then
        -- Restored: the connection is history, removed at its own record; the operator reconnects here.
        insert into product_connections (id, estate_id, product, server, mcp_url, key_id, client_id, level, send,
                                         key_expires_at, secret_ref, connected_at, connected_by, connected_seq,
                                         removed_at, removed_by, removed_seq)
        values (v_id, e.estate_id, e.payload->>'product', e.payload->>'server', e.payload->>'mcp_url', e.payload->>'key_id',
                e.payload->>'client_id', e.payload->>'level', e.payload->>'send', (e.payload->>'key_expires_at')::timestamptz,
                e.payload->'secret_ref', e.occurred_at, e.actor->>'id', e.seq, e.occurred_at, 'restore-boundary', e.seq);
        return;
      end if;
      -- One live connection per product: a reconnect supersedes the previous one.
      update product_connections set removed_at = e.occurred_at, removed_by = e.actor->>'id', removed_seq = e.seq
       where estate_id = e.estate_id and product = e.payload->>'product' and removed_at is null;
      insert into product_connections (id, estate_id, product, server, mcp_url, key_id, client_id, level, send,
                                       key_expires_at, secret_ref, connected_at, connected_by, connected_seq)
      values (v_id, e.estate_id, e.payload->>'product', e.payload->>'server', e.payload->>'mcp_url', e.payload->>'key_id',
              e.payload->>'client_id', e.payload->>'level', e.payload->>'send', (e.payload->>'key_expires_at')::timestamptz,
              e.payload->'secret_ref', e.occurred_at, e.actor->>'id', e.seq);

    when 'product.disconnected@1' then
      v_id := (e.payload->>'id')::uuid;
      update product_connections set removed_at = e.occurred_at, removed_by = e.actor->>'id', removed_seq = e.seq
       where id = v_id and estate_id = e.estate_id and removed_at is null;
      if not found then
        if exists (select 1 from product_connections where id = v_id and estate_id = e.estate_id
                     and (removed_seq = e.seq or v_restored)) then return; end if;
        raise exception 'no live connection of this estate has that id' using errcode = 'check_violation';
      end if;

    when 'product.connect.refused@1' then
      -- Projects nothing; its shape is checked so the journal says exactly what happened (DA-7).
      for k in select jsonb_object_keys(case when jsonb_typeof(e.payload) = 'object' then e.payload else '{}'::jsonb end) loop
        if k not in ('product', 'outcome', 'error') then
          raise exception 'product.connect.refused@1 carries %, which is not product, outcome or error', k using errcode = 'check_violation';
        end if;
      end loop;
      if not coalesce(e.payload->>'product' ~ '^[a-z][a-z0-9-]{1,62}$', false)
         or coalesce(e.payload->>'outcome', '') not in ('denied', 'failed')
         or (e.payload->'error' is not null and e.payload->'error' <> 'null'::jsonb
             and (jsonb_typeof(e.payload->'error') <> 'string' or length(e.payload->>'error') > 200)) then
        raise exception 'product.connect.refused@1 is {product, outcome: denied | failed, error: a short reason or null}'
          using errcode = 'check_violation';
      end if;

    when 'hub.call.forwarded@1' then
      -- Projects nothing; a span carries the documented fields only — the arguments' hash, never the arguments
      -- (DA-4; the writer is hubCall.ts `span`).
      for k in select jsonb_object_keys(case when jsonb_typeof(e.payload) = 'object' then e.payload else '{}'::jsonb end) loop
        if k not in ('trace_id', 'span_id', 'parent_span_id', 'trace_incomplete', 'caller', 'callee', 'capability',
                     'args_hash', 'outcome', 'error_code', 'grant_ids', 'narrowing', 'wall_ms') then
          raise exception 'hub.call.forwarded@1 carries %, which is not a span field; a span holds the arguments'' hash, never the arguments', k
            using errcode = 'check_violation';
        end if;
      end loop;

    else null;
  end case;
end $$;

-- A projector is not a door (migration 75); `create or replace` keeps the ACL, and this says it again.
revoke execute on function apply_hub_access(journal) from public, anon, authenticated, service_role;

-- 3. Migration 66's restore body, with the hub's collision check before any event projects.
create or replace function restore_estate_events(p_target uuid,p_events jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare e jsonb;v_event journal;n int:=0;v_projects int;v_landed int;v_hub int;
begin
 -- Migration 77 (verification 0.3.1, DA-3): the hub's projections are keyed by the entity id GLOBALLY too,
 -- and a restore bypasses append_event's door. Without this check a restore beside its source failed on the
 -- first decision with "names no request of this estate", which says nothing about why.
 select count(*) into v_hub from jsonb_array_elements(p_events) x
  where (x->>'type'='access.requested@1' and exists(select 1 from access_requests r where r.id=identity_uuid(x->'payload'->>'id') and r.estate_id<>p_target))
     or (x->>'type'='product.connected@1' and exists(select 1 from product_connections c where c.id=identity_uuid(x->'payload'->>'id') and c.estate_id<>p_target))
     or (x->>'type'='access.decided@1' and x->'payload'->>'new_binding'='true'
         and exists(select 1 from access_bindings b where b.id=identity_uuid(x->'payload'->>'binding_id') and b.estate_id<>p_target))
     or (x->>'type'='access.decided@1' and jsonb_typeof(x->'payload'->'grants')='array'
         and exists(select 1 from jsonb_array_elements(x->'payload'->'grants') g join access_grants ag on ag.id=identity_uuid(g->>'id') and ag.estate_id<>p_target));
 if v_hub>0 then
  raise exception using errcode='check_violation', message=format(
   'restore collided: the archive''s hub access names %s request, credential, grant or product connection id(s) another estate in this database already holds. Projection rows are keyed by the entity id GLOBALLY, so an estate restored beside its source silently collides with it. Restore into a database that does not already hold this estate.',
   v_hub);
 end if;
 for e in select * from jsonb_array_elements(p_events) loop
  insert into journal (estate_id,seq,type,schema_rev,actor,project_id,run_id,node_id,payload,occurred_at)
  values (p_target,(e->>'seq')::bigint,e->>'type',coalesce(e->>'schema_rev','1'),coalesce(e->'actor','{}'::jsonb),
   nullif(e->>'project_id','')::uuid,nullif(e->>'run_id','')::uuid,nullif(e->>'node_id','')::uuid,
   coalesce(e->'payload','{}'::jsonb),coalesce((e->>'occurred_at')::timestamptz,now()))
  returning * into v_event;
  perform apply_projections(v_event);
  n:=n+1;
 end loop;
 -- Projection rows are keyed by the entity id GLOBALLY; a restore beside a colliding
 -- estate projects nothing and says restored. Every declared project must land.
 select count(distinct e2->'payload'->>'id') into v_projects from jsonb_array_elements(p_events) e2 where e2->>'type'='project.created@1';
 select count(*) into v_landed from projects where estate_id=p_target;
 if v_landed<v_projects then
  raise exception using errcode='check_violation', message=format(
   'restore collided: the archive declares %s project(s) and %s landed. Projection rows are keyed by the entity id GLOBALLY, so an estate restored beside its source silently collides with it. Restore into a database that does not already hold this estate.',
   v_projects,v_landed);
 end if;
 return jsonb_build_object('events',n,'projects',v_landed);
end $$;
revoke all on function restore_estate_events(uuid,jsonb) from public,anon,authenticated,service_role;

-- #endregion hub-access-at-the-door

-- ── schema 77 as a private-archive source ───────────────────────────────────
--
-- ADR-0079 decision 5, as migrations 67–76 did for their own numbers. Migration 77 changes no archived
-- table, but it registers an event type (product.connect.refused@1), so an ordinary journal from schema 77
-- may carry it and only a schema that registers it can restore it; left unqualified, an export taken at 77
-- would say `source_schema_version: 76`. An export now names 77; import accepts 66 to 77. The bodies are
-- migration 76's, changed only at those two points.
-- #region private-archive-source-schema — docs: docs/adr/0079-private-conversation-archives-preserve-history-not-authority.md#decision
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb,'71'::jsonb,'72'::jsonb,'73'::jsonb,'74'::jsonb,'75'::jsonb,'76'::jsonb,'77'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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

  v_archive:=jsonb_build_object('schema','CeoPrivateArchive@1','archive_id',gen_random_uuid(),'source_schema_version',77,'owner_person_id',p_person_id,
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
