-- Hub verification iteration 2: DA-2, DA-4, DA-6, ER-2.
-- Suffixes 78/79 are reserved by a separate unmerged workstream; this is migration COUNT 78.
-- New write guards are outside replay; restored poll verifiers alone lose authority.
-- #region hub-authority-boundaries — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#3-grants-are-standing-narrow-and-revocable
create or replace function refuse_noncanonical_identity(p_type text, p_payload jsonb) returns void
language plpgsql
immutable
set search_path = public
as $$
declare
  k text;
  v text;
  c uuid;
  g jsonb;
  allowed text[];
begin
  if jsonb_typeof(p_payload) is distinct from 'object' then return; end if;
  foreach k in array array['id', 'project_id', 'session_id', 'task_id', 'note_id', 'task_run_id', 'delivery_id', 'binding_id', 'request_id', 'grant_id', 'supersedes'] loop
    if jsonb_typeof(p_payload->k) = 'string' then
      v := p_payload->>k;
      c := identity_uuid(v);
      if c is not null and c::text <> v then
        raise exception using
          errcode = 'check_violation',
          message = format('%s carries %s in a non-canonical form. An id is written lower-case and hyphenated '
                           '(8-4-4-4-12), the form the projector stores; any other spelling would let the door '
                           'and the journal''s readers disagree about which row it names. Send it in that form.',
                           p_type, k);
      end if;
    end if;
  end loop;
  if jsonb_typeof(p_payload->'grants') = 'array' then
    for g in select value from jsonb_array_elements(p_payload->'grants') loop
      v := g->>'id'; c := identity_uuid(v);
      if c is not null and c::text <> v then
        raise exception '% carries grants[].id in a non-canonical form', p_type using errcode='check_violation';
      end if;
    end loop;
  end if;
  allowed := case p_type
    when 'access.requested@1' then array['id','agent_id','callee','capabilities','resources','reason','registry','binding_id','expires_at','poll_verifier']
    when 'access.credential.claimed@1' then array['binding_id','request_id','verifier']
    when 'product.connected@1' then array['id','product','server','mcp_url','key_id','client_id','level','send','key_expires_at','secret_ref','supersedes']
    else null end;
  if allowed is not null then
    for k in select jsonb_object_keys(p_payload) loop
      if not k = any(allowed) then
        raise exception '% carries undocumented field %; credentials are hashes or vault references only', p_type,k using errcode='check_violation';
      end if;
    end loop;
  end if;
end $$;
revoke execute on function refuse_noncanonical_identity(text, jsonb) from public;
revoke execute on function refuse_noncanonical_identity(text, jsonb) from anon, authenticated, service_role;

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
  v_live uuid;
begin
  if p_type = 'product.connected@1' then
    select id into v_live from product_connections where estate_id=p_estate_id
      and product=p_payload->>'product' and removed_at is null;
    if v_live is distinct from identity_uuid(p_payload->>'supersedes') then
      raise exception 'product already connected or changed; supersedes must name the exact live connection (null for first connect)'
        using errcode='check_violation';
    end if;
  end if;
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
              e.occurred_at, (e.payload->>'expires_at')::timestamptz, case when v_restored then null else e.payload->>'poll_verifier' end, e.seq)
      on conflict (id) do nothing;   -- a foreign row already journalled before 77 replays without touching it

    when 'access.decided@1' then
      select * into v_req from access_requests
       where id = (e.payload->>'request_id')::uuid and estate_id = e.estate_id for update;
      if v_req.id is null then
        raise exception 'access.decided@1 names no request of this estate' using errcode = 'check_violation';
      end if;
      if not v_restored and exists (select 1 from estate_restore_boundaries b
        where b.target_estate_id=e.estate_id and v_req.seq <= b.watermark_seq) then
        raise exception 'restored request has no authority here; the agent must ask again' using errcode='check_violation';
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

-- Repair existing restored projection rows, preserving archival journal bytes.
update access_requests r set poll_verifier=null from estate_restore_boundaries b
 where r.estate_id=b.target_estate_id and r.seq<=b.watermark_seq;
-- #endregion hub-authority-boundaries
-- #region private-archive-source-schema — docs: docs/adr/0079-private-conversation-archives-preserve-history-not-authority.md#decision
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb,'71'::jsonb,'72'::jsonb,'73'::jsonb,'74'::jsonb,'75'::jsonb,'76'::jsonb,'77'::jsonb,'78'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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

  v_archive:=jsonb_build_object('schema','CeoPrivateArchive@1','archive_id',gen_random_uuid(),'source_schema_version',schema_version(),'owner_person_id',p_person_id,
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
