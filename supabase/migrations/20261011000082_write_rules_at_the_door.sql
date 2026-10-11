-- 82 — the hub's write rules at the write boundary, not in replay (CO-201); refusals counted, not itemised,
-- in the journal (CO-200); this is migration COUNT 80. Fabric 0.4.0 wave 1, REQ-32.
--
-- Migrations 77 and 80 are executed and dated, so their text is not edited; what they got wrong is corrected
-- here. Applied migrations are recorded in supabase/migration-ledger.json with their bytes' hash, and
-- scripts/check-migration-order.mjs refuses a new filename that sorts below the newest recorded one (CO-199).
--
-- 1. THE RULES 77 AND 80 ADDED RAN INSIDE THE PROJECTOR, SO THEY ALSO RAN ON REPLAY (CO-201). Migration 80's
--    header said "new write guards are outside replay"; that held for the door checks only. Six refusals lived
--    in `apply_hub_access`, and `rebuild_estate_projections` and `restore_estate_events` call it:
--      * a request that expires more than 10 minutes (+2 of clock skew) after it was asked (77, DA-4);
--      * a grant that lasts more than 366 days from its decision (77, DA-4);
--      * a `product.connected@1` whose `secret_ref` is not exactly {project, env, name} (77, DA-4);
--      * a `product.connect.refused@1` outside {product, outcome, error} (77, DA-7);
--      * a `hub.call.forwarded@1` span carrying a key outside the documented span set (77, DA-4);
--      * a decision, above the restore watermark, on a request the restore brought (80, DA-2).
--    MEASURED (apps/desktop/test/write-rules-db.test.mjs, watched failing without this migration): a database
--    at 76 or 77 holding such an event — written when no rule refused it — cannot rebuild:
--    `rebuild_estate_projections` raises the rule's sentence on the first one.
--    Now `refuse_hub_write_rules` holds all six, in the same sentences, and is called where an event is WRITTEN:
--    `append_event` (at now(), the time the journal stamps) and `restore_estate_events` (at the event's own
--    `occurred_at`; the sixth rule is about a restore's own history and does not apply to it). The projector
--    projects every historical event the way the schema that accepted it did, so a rebuild replays the journal
--    the database holds. No released database has hub tables (0.3.x stops at 79 by count and every hub event is
--    on a development database), so no operator's projection changes.
--
-- 2. A LOOPING CALLER IS COUNTED, NOT ITEMISED (CO-200). One `hub.call.forwarded@1` per hop, refusals included,
--    let one looping agent fill the private export's 65,536-event ceiling in about nine hours at the credential's
--    budget (120 calls a minute). `hub.call.refusals.summarized@1` is the one event that stands for the hops
--    Fabric ended before forwarding, after the first of their kind in a window (hubCall.ts `notSentSpan`): the
--    caller, the outcome and error code, how many, and when the first and last of them happened. A hop that was
--    forwarded, or may have been, keeps its own span. Its shape is the door's, like the span's.
--
-- 3. SCHEMA 80 AS A PRIVATE-ARCHIVE SOURCE (ADR-0079 decision 5, as 67–81 did): the migration registers an
--    event type, so a schema-80 journal may carry it. An export names 80 (`schema_version()`); import accepts 66
--    to 80. The body is migration 81's, changed only at the accepted version list.
-- #region hub-write-rules-at-the-door — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#3-grants-are-standing-narrow-and-revocable
create or replace function refuse_hub_write_rules(
  p_estate_id   uuid,
  p_type        text,
  p_payload     jsonb,
  p_occurred_at timestamptz,
  p_restoring   boolean
) returns void
language plpgsql
stable
security definer set search_path = public
as $$
declare
  g        jsonb;
  k        text;
  v_seq    bigint;
  v_codes  constant text[] := array['invalid-arguments', 'unknown-callee', 'access-required', 'product-not-connected',
                                    'product-credential-unavailable', 'hub-unavailable', 'cancelled'];
begin
  if p_type not in ('access.requested@1', 'access.decided@1', 'product.connected@1', 'product.connect.refused@1',
                    'hub.call.forwarded@1', 'hub.call.refusals.summarized@1') then
    return;
  end if;

  if p_type = 'access.requested@1' then
    if (p_payload->>'expires_at')::timestamptz > p_occurred_at + interval '12 minutes' then
      raise exception 'access.requested@1 expires at %, more than 10 minutes after it was asked; a request lives 10 minutes',
        p_payload->>'expires_at' using errcode = 'check_violation';
    end if;

  elsif p_type = 'access.decided@1' then
    if jsonb_typeof(p_payload->'grants') = 'array' then
      for g in select value from jsonb_array_elements(p_payload->'grants') loop
        -- A grant lasts at most a year (366 days, for a leap year) from its decision.
        if (g->>'expires_at')::timestamptz > p_occurred_at + interval '366 days' then
          raise exception 'grant % expires at %, more than 366 days after it was decided; a grant lasts a year',
            g->>'id', g->>'expires_at' using errcode = 'check_violation';
        end if;
      end loop;
    end if;
    -- At or below the target's restore watermark a request is history, not authority: a decision on it made
    -- here is refused (80, DA-2). A restore writes its own history and is not such a decision.
    if not p_restoring then
      select r.seq into v_seq from access_requests r
       where r.id = identity_uuid(p_payload->>'request_id') and r.estate_id = p_estate_id;
      if v_seq is not null and exists (select 1 from estate_restore_boundaries b
          where b.target_estate_id = p_estate_id and v_seq <= b.watermark_seq) then
        raise exception 'restored request has no authority here; the agent must ask again' using errcode = 'check_violation';
      end if;
    end if;

  elsif p_type = 'product.connected@1' then
    -- The slot, never the value.
    if jsonb_typeof(p_payload->'secret_ref') is distinct from 'object'
       or (select array_agg(x order by x) from jsonb_object_keys(p_payload->'secret_ref') x) is distinct from array['env', 'name', 'project']
       or jsonb_typeof(p_payload->'secret_ref'->'project') is distinct from 'string'
       or jsonb_typeof(p_payload->'secret_ref'->'env') is distinct from 'string'
       or jsonb_typeof(p_payload->'secret_ref'->'name') is distinct from 'string'
       or not coalesce(p_payload->'secret_ref'->>'project' ~ '^[a-z0-9][a-z0-9._-]{0,63}$', false)
       or not coalesce(p_payload->'secret_ref'->>'env' ~ '^[a-z0-9][a-z0-9._-]{0,63}$', false)
       or not coalesce(p_payload->'secret_ref'->>'name' ~ '^[A-Z][A-Z0-9_]{0,127}$', false) then
      raise exception 'product.connected@1 secret_ref names a vault slot — exactly {project, env, name}, the name in upper case — and nothing else; never the secret'
        using errcode = 'check_violation';
    end if;

  elsif p_type = 'product.connect.refused@1' then
    for k in select jsonb_object_keys(case when jsonb_typeof(p_payload) = 'object' then p_payload else '{}'::jsonb end) loop
      if k not in ('product', 'outcome', 'error') then
        raise exception 'product.connect.refused@1 carries %, which is not product, outcome or error', k using errcode = 'check_violation';
      end if;
    end loop;
    if not coalesce(p_payload->>'product' ~ '^[a-z][a-z0-9-]{1,62}$', false)
       or coalesce(p_payload->>'outcome', '') not in ('denied', 'failed')
       or (p_payload->'error' is not null and p_payload->'error' <> 'null'::jsonb
           and (jsonb_typeof(p_payload->'error') <> 'string' or length(p_payload->>'error') > 200)) then
      raise exception 'product.connect.refused@1 is {product, outcome: denied | failed, error: a short reason or null}'
        using errcode = 'check_violation';
    end if;

  elsif p_type = 'hub.call.forwarded@1' then
    -- A span carries the documented fields only — the arguments' hash, never the arguments (hubCall.ts `span`).
    for k in select jsonb_object_keys(case when jsonb_typeof(p_payload) = 'object' then p_payload else '{}'::jsonb end) loop
      if k not in ('trace_id', 'span_id', 'parent_span_id', 'trace_incomplete', 'caller', 'callee', 'capability',
                   'args_hash', 'outcome', 'error_code', 'grant_ids', 'narrowing', 'wall_ms') then
        raise exception 'hub.call.forwarded@1 carries %, which is not a span field; a span holds the arguments'' hash, never the arguments', k
          using errcode = 'check_violation';
      end if;
    end loop;

  else   -- hub.call.refusals.summarized@1 (CO-200): counts and times, never a call's arguments.
    if jsonb_typeof(p_payload) is distinct from 'object'
       or (select array_agg(x order by x) from jsonb_object_keys(p_payload) x)
          is distinct from array['caller', 'error_code', 'first_at', 'last_at', 'outcome', 'suppressed', 'window_ms']
       or jsonb_typeof(p_payload->'caller') is distinct from 'object'
       or (select array_agg(x order by x) from jsonb_object_keys(p_payload->'caller') x) is distinct from array['agent_id', 'binding_id']
       or jsonb_typeof(p_payload->'caller'->'binding_id') is distinct from 'string'
       or identity_uuid(p_payload->'caller'->>'binding_id') is null
       or jsonb_typeof(p_payload->'caller'->'agent_id') is distinct from 'string'
       or length(p_payload->'caller'->>'agent_id') not between 1 and 200
       or coalesce(p_payload->>'outcome', '') not in ('refused', 'failed', 'cancelled')
       or not coalesce(p_payload->>'error_code' = any (v_codes), false)
       or jsonb_typeof(p_payload->'suppressed') is distinct from 'number'
       or not coalesce(p_payload->>'suppressed' ~ '^[1-9][0-9]{0,8}$', false)
       or jsonb_typeof(p_payload->'window_ms') is distinct from 'number'
       or not coalesce(p_payload->>'window_ms' ~ '^[1-9][0-9]{0,9}$', false)
       or jsonb_typeof(p_payload->'first_at') is distinct from 'string'
       or jsonb_typeof(p_payload->'last_at') is distinct from 'string'
       or not coalesce(p_payload->>'first_at' ~ '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$', false)
       or not coalesce(p_payload->>'last_at' ~ '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$', false) then
      raise exception 'hub.call.refusals.summarized@1 is {caller: {binding_id, agent_id}, outcome, error_code, suppressed, first_at, last_at, window_ms} — a count of calls Fabric ended before forwarding, never their arguments'
        using errcode = 'check_violation';
    end if;
    if (p_payload->>'first_at')::timestamptz > (p_payload->>'last_at')::timestamptz
       or (p_payload->>'last_at')::timestamptz > p_occurred_at + interval '2 minutes' then
      raise exception 'hub.call.refusals.summarized@1 counts calls between first_at and last_at, in that order and not in the future'
        using errcode = 'check_violation';
    end if;
  end if;
end $$;
revoke execute on function refuse_hub_write_rules(uuid, text, jsonb, timestamptz, boolean) from public;
revoke execute on function refuse_hub_write_rules(uuid, text, jsonb, timestamptz, boolean) from anon, authenticated, service_role;

-- Projects nothing (CO-200): the journal is its record, as for the span it stands beside.
insert into event_types (type, projects, note) values
  ('hub.call.refusals.summarized@1', false, 'how many more agent.call hops one caller''s binding had that Fabric ended before forwarding, with one outcome and error code, between first_at and last_at; the first of them in its window has its own span');

-- The projector replays every historical event (CO-201): migration 80's body without the six refusals above.
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
      insert into access_requests (id, estate_id, agent_id, callee, capabilities, resources, reason, registry,
                                   asked_by_binding, requested_at, expires_at, poll_verifier, seq)
      values ((e.payload->>'id')::uuid, e.estate_id, e.payload->>'agent_id', e.payload->>'callee',
              coalesce((select array_agg(v order by o) from jsonb_array_elements_text(e.payload->'capabilities') with ordinality t(v, o)), '{}'),
              coalesce((select array_agg(v order by o) from jsonb_array_elements_text(e.payload->'resources') with ordinality t(v, o)), '{}'),
              e.payload->>'reason', coalesce(e.payload->'registry', '{}'::jsonb), (e.payload->>'binding_id')::uuid,
              e.occurred_at, (e.payload->>'expires_at')::timestamptz, case when v_restored then null else e.payload->>'poll_verifier' end, e.seq)
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

    when 'product.connect.refused@1', 'hub.call.forwarded@1' then
      -- Project nothing. Their shapes are the door's (refuse_hub_write_rules), checked when they are written.
      null;

    else null;
  end case;
end $$;

-- A projector is not a door (migration 75); `create or replace` keeps the ACL, and this says it again.
revoke execute on function apply_hub_access(journal) from public, anon, authenticated, service_role;

-- The door: migration 81's body, one line added (the rules, under the estate's lock, before the insert).
create or replace function append_event(
  p_estate_id uuid,
  p_type      text,
  p_actor     jsonb,
  p_payload   jsonb default '{}'::jsonb,
  p_schema_rev text default '1',
  p_project_id uuid default null,
  p_run_id     uuid default null,
  p_node_id    uuid default null
) returns journal
language plpgsql
security definer
set search_path = public
set lock_timeout = '3s'
as $$
declare
  v_seq bigint;
  v_event journal;
begin
  if not exists (select 1 from event_types where type = p_type) then
    raise exception 'unregistered event type %', p_type
      using errcode = '22023',   -- invalid_parameter_value
            hint = 'Add it to event_types in a migration, together with its projector branch.';
  end if;
  perform refuse_noncanonical_identity(p_type, p_payload);   -- migration 74: no lock taken yet
  if p_type in ('ceo.conversation.opened@1','ceo.message.accepted@1') and not exists (
    select 1 from ceo_write_authorizations a where a.transaction_id=txid_current()
     and a.estate_id=p_estate_id and a.type=p_type and a.actor=p_actor and a.payload=p_payload
     and p_project_id is null and p_run_id is null and p_node_id is null and p_schema_rev='1'
  ) then raise exception 'Use CEO private commands' using errcode='insufficient_privilege'; end if;
  if p_type='transcript.captured@2' and not exists (
    select 1 from transcript_recovery_authorizations a where a.transaction_id=txid_current()
      and a.estate_id=p_estate_id and a.project_id=p_project_id and a.payload=p_payload
      and p_actor=jsonb_build_object('kind','system','id','transcript-recovery')
      and p_run_id is null and p_node_id is null and p_schema_rev='2'
  ) then raise exception 'Use recover_transcript for recovered captures' using errcode='insufficient_privilege'; end if;
  -- migration 79: the board's events come only from the board's own commands (board_append).
  if p_type like 'comms.%' and not exists (
    select 1 from board_write_authorizations a where a.transaction_id=txid_current()
      and a.estate_id=p_estate_id and a.type=p_type and a.payload=p_payload
      and p_project_id is null and p_run_id is null and p_node_id is null and p_schema_rev='1'
  ) then raise exception 'Use the board commands' using errcode='insufficient_privilege'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text, 4242));
  perform refuse_foreign_identity(p_estate_id, p_type, p_payload, p_project_id);   -- migration 73: under the lock
  perform refuse_taken_agent_name(p_estate_id, p_type, p_payload);
  perform refuse_hub_write_rules(p_estate_id, p_type, p_payload, now(), false);   -- migration 82 (CO-201): the rules 77/80 put in the projector
  select coalesce(max(seq), 0) + 1 into v_seq from journal where estate_id = p_estate_id;
  insert into journal (estate_id, seq, type, schema_rev, actor, project_id, run_id, node_id, payload)
  values (p_estate_id, v_seq, p_type, p_schema_rev, p_actor, p_project_id, p_run_id, p_node_id, p_payload)
  returning * into v_event;
  perform apply_projections(v_event);
  return v_event;
end $$;

revoke execute on function append_event(uuid, text, jsonb, jsonb, text, uuid, uuid, uuid) from public;
revoke execute on function append_event(uuid, text, jsonb, jsonb, text, uuid, uuid, uuid) from anon, authenticated;
grant  execute on function append_event(uuid, text, jsonb, jsonb, text, uuid, uuid, uuid) to service_role;

-- A restore bypasses append_event: migration 77's body, one line added.
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
  -- Migration 82 (CO-201): a restore is a write, so the hub's write rules hold here too — at the event's own time.
  perform refuse_hub_write_rules(p_target,e->>'type',coalesce(e->'payload','{}'::jsonb),coalesce((e->>'occurred_at')::timestamptz,now()),true);
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
-- #endregion hub-write-rules-at-the-door

-- ── schema 80 as a private-archive source ───────────────────────────────────
-- #region private-archive-source-schema — docs: docs/adr/0079-private-conversation-archives-preserve-history-not-authority.md#decision
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb,'71'::jsonb,'72'::jsonb,'73'::jsonb,'74'::jsonb,'75'::jsonb,'76'::jsonb,'77'::jsonb,'78'::jsonb,'79'::jsonb,'80'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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
