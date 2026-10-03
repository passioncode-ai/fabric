-- 76 — the hub's standing access: a local agent reaches a cloud product through Fabric, on the operator's
-- consent (ADR-0115 S2–S4).
--
-- FOUR TABLES, each a projection of the journal, written by nothing but `apply_hub_access`:
--
--   access_requests      what a registered agent asked for (`fabric.access.request`) and what became of it:
--                        pending, allowed or denied. Expiry (10 minutes) is read from `expires_at`, never
--                        written: a request nobody answered is not a decision. A denial stands until the
--                        operator clears it (`denial_cleared_at`).
--   access_bindings      a long-lived, revocable credential an agent holds. Fabric keeps only its VERIFIER,
--                        the sha256 of 32 random bytes (ADR-0026 §3); the credential is minted when the agent
--                        first reads the allowed request's status, so it is handed over exactly once and a
--                        restart between Allow and that read loses nothing.
--   access_grants        what a binding may do: one capability on one resource of one callee, decided by the
--                        operator, with an expiry it may not lack (ADR-0115 §3, §6), and revocable.
--   product_connections  one credential per connected cloud product, obtained by the product's own consent
--                        (ADR-0115 §4). Only metadata lives here; the secret lives in Project Observatory's
--                        vault and `secret_ref` names its slot.
--
-- THE PROJECTOR REFUSES AN IMPOSSIBLE TRANSITION rather than dropping it: deciding a request that is not
-- pending, deciding after it expired, granting what was not asked, claiming a credential twice, revoking what
-- is not live. A refusal raises, so `append_event` rolls back and the journal never holds an act its
-- projection does not contain. Every refusal is decided from the event and the rows alone — `occurred_at`,
-- never `now()` — and a replay of the same event (its seq already recorded) is a no-op, so
-- `rebuild_estate_projections` replays the chain unchanged.
--
-- Each forwarded call is journalled as `hub.call.forwarded@1`, one span per hop, projected nowhere: the journal
-- is the trace's record until AR-6 assembles spans.
--
-- The one-shot floor `grants` table (ADR-0028) is untouched: a standing grant here and a one-shot grant there
-- are different things, and sharing a table would let one be read as the other.

-- #region hub-access-schema — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#3-grants-are-standing-narrow-and-revocable

insert into event_types (type, projects, note) values
  ('access.requested@1', true, 'a registered agent asked, through the hub''s door, for capabilities on resources of a callee, with its reason as its own claim'),
  ('access.decided@1', true, 'the operator allowed or denied an access request; an allow names the binding and the grants it wrote, each with an expiry'),
  ('access.credential.claimed@1', true, 'the agent read its allowed request once and received its binding credential; Fabric keeps the sha256 verifier only'),
  ('access.grant.revoked@1', true, 'the operator revoked one standing access grant; the next call it would have allowed is refused'),
  ('access.binding.revoked@1', true, 'the operator revoked an agent''s binding credential and every grant it held'),
  ('access.denial.cleared@1', true, 'the operator cleared a denial, so the same request may prompt again'),
  ('product.connected@1', true, 'a cloud product was connected by its own consent; its secret was stored in the vault and only its metadata is here'),
  ('product.disconnected@1', true, 'the operator disconnected a cloud product; Fabric stops forwarding to it'),
  -- One span per hop (ADR-0115 §5, fabric-interop/0.1 C3.4): the journal is its record, and nothing projects it.
  ('hub.call.forwarded@1', false, 'one hop of agent.call through the hub: caller binding, callee and capability, a hash of the arguments, the grants that allowed it, the outcome, as a child span of the caller''s traceparent');

create table access_requests (
  id                  uuid primary key,
  estate_id           uuid not null,
  agent_id            text not null check (agent_id ~ '^[a-z][a-z0-9-]{1,62}(\.[a-z][a-z0-9-]{0,31})?$'),
  callee              text not null check (callee ~ '^[a-z][a-z0-9-]{1,62}(\.[a-z][a-z0-9-]{0,31})?$'),
  capabilities        text[] not null check (cardinality(capabilities) between 1 and 32),
  resources           text[] not null check (cardinality(resources) between 1 and 64),
  reason              text not null check (length(btrim(reason)) between 1 and 1000),
  -- What the registry said about the agent when it asked: the prompt is built from this, never from the request.
  registry            jsonb not null,
  -- The binding that asked, for incremental consent; null when the door token asked (a first request).
  asked_by_binding    uuid,
  requested_at        timestamptz not null,
  expires_at          timestamptz not null check (expires_at > requested_at),
  status              text not null default 'pending' check (status in ('pending', 'allowed', 'denied')),
  decided_at          timestamptz,
  decided_by          text,
  decided_seq         bigint,
  granted_binding_id  uuid,
  credential_claimed_at timestamptz,
  denial_cleared_at   timestamptz,
  cleared_seq         bigint,
  seq                 bigint not null,
  unique (estate_id, id),
  check ((status = 'pending') = (decided_seq is null)),
  check ((status = 'allowed') = (granted_binding_id is not null)),
  check (denial_cleared_at is null or status = 'denied')
);
create index access_requests_open on access_requests (estate_id, status, requested_at);
create index access_requests_agent on access_requests (estate_id, agent_id, callee);
comment on table access_requests is
  'Access requests from registered agents through the hub (ADR-0115 §2), one row per access.requested@1; the decision columns carry access.decided@1. Expiry is expires_at, read, never written.';

create table access_bindings (
  id            uuid primary key,
  estate_id     uuid not null,
  agent_id      text not null,
  request_id    uuid not null,
  -- sha256 (hex) of the credential, set once when the agent claims it; null until then.
  verifier      text unique check (verifier ~ '^[0-9a-f]{64}$'),
  created_at    timestamptz not null,
  created_seq   bigint not null,
  claimed_at    timestamptz,
  claimed_seq   bigint,
  revoked_at    timestamptz,
  revoked_by    text,
  revoked_seq   bigint,
  unique (estate_id, id),
  foreign key (estate_id, request_id) references access_requests (estate_id, id),
  check ((verifier is null) = (claimed_seq is null)),
  check ((revoked_at is null) = (revoked_seq is null))
);
create index access_bindings_agent on access_bindings (estate_id, agent_id);
comment on table access_bindings is
  'Long-lived, revocable binding credentials of external agents (ADR-0115 §2, ADR-0026 §3): the verifier only, never the credential.';

create table access_grants (
  id           uuid primary key,
  estate_id    uuid not null,
  binding_id   uuid not null,
  request_id   uuid not null,
  agent_id     text not null,
  callee       text not null,
  capability   text not null check (capability ~ '^[a-z][a-z0-9._-]{1,127}$'),
  resource     text not null check (length(resource) between 1 and 400),
  decided_by   text not null,
  decided_at   timestamptz not null,
  expires_at   timestamptz not null,
  decided_seq  bigint not null,
  revoked_at   timestamptz,
  revoked_by   text,
  revoked_seq  bigint,
  unique (estate_id, id),
  foreign key (estate_id, binding_id) references access_bindings (estate_id, id),
  foreign key (estate_id, request_id) references access_requests (estate_id, id),
  -- ADR-0115 §6: a grant without an expiry is refused; so is one that expires before it was decided.
  check (expires_at > decided_at),
  check ((revoked_at is null) = (revoked_seq is null))
);
create index access_grants_binding on access_grants (estate_id, binding_id) where revoked_at is null;
-- One live grant per binding, callee, capability and resource. A second Allow of the same thing extends the
-- grant it already has (the projector's `on conflict` below); two live rows would make Revoke on one leave
-- the other standing, which reads to the operator as a revoke that did not take.
create unique index access_grants_one_live on access_grants (estate_id, binding_id, callee, capability, resource) where revoked_at is null;
comment on table access_grants is
  'Standing access grants: one capability on one resource of one callee for one binding, with an expiry, revocable (ADR-0115 §3). Distinct from the one-shot floor grants table.';

create table product_connections (
  id              uuid primary key,
  estate_id       uuid not null,
  product         text not null check (product ~ '^[a-z][a-z0-9-]{1,62}$'),
  server          text not null check (server ~ '^https://'),
  mcp_url         text not null check (mcp_url ~ '^https://'),
  key_id          text not null check (length(key_id) between 1 and 200),
  client_id       text not null check (length(client_id) between 1 and 400),
  level           text not null check (level in ('read', 'mail', 'admin')),
  send            text not null check (send in ('drafts', 'send')),
  key_expires_at  timestamptz,
  -- Where the secret is: {project, env, name} of a Project Observatory vault slot. Never the value.
  secret_ref      jsonb not null check (jsonb_typeof(secret_ref) = 'object'),
  connected_at    timestamptz not null,
  connected_by    text not null,
  connected_seq   bigint not null,
  removed_at      timestamptz,
  removed_by      text,
  removed_seq     bigint,
  unique (estate_id, id),
  check ((removed_at is null) = (removed_seq is null))
);
create unique index product_connections_live on product_connections (estate_id, product) where removed_at is null;
comment on table product_connections is
  'Cloud products connected by their own consent (ADR-0115 §4): metadata and the vault slot of the secret, never the secret.';

create or replace function apply_hub_access(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_req     access_requests;
  v_binding uuid;
  v_id      uuid;
  g         jsonb;
begin
  case e.type
    when 'access.requested@1' then
      insert into access_requests (id, estate_id, agent_id, callee, capabilities, resources, reason, registry,
                                   asked_by_binding, requested_at, expires_at, seq)
      values ((e.payload->>'id')::uuid, e.estate_id, e.payload->>'agent_id', e.payload->>'callee',
              coalesce((select array_agg(v order by o) from jsonb_array_elements_text(e.payload->'capabilities') with ordinality t(v, o)), '{}'),
              coalesce((select array_agg(v order by o) from jsonb_array_elements_text(e.payload->'resources') with ordinality t(v, o)), '{}'),
              e.payload->>'reason', coalesce(e.payload->'registry', '{}'::jsonb), (e.payload->>'binding_id')::uuid,
              e.occurred_at, (e.payload->>'expires_at')::timestamptz, e.seq)
      on conflict (id) do nothing;

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
        insert into access_bindings (id, estate_id, agent_id, request_id, created_at, created_seq)
        values (v_binding, e.estate_id, v_req.agent_id, v_req.id, e.occurred_at, e.seq);
      elsif v_req.asked_by_binding is distinct from v_binding then
        raise exception 'an incremental grant goes to the binding that asked' using errcode = 'check_violation';
      end if;
      if not exists (select 1 from access_bindings where id = v_binding and estate_id = e.estate_id
                       and agent_id = v_req.agent_id and revoked_at is null) then
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
        -- Already held (live, or expired and never revoked): this decision extends that grant and becomes its
        -- latest decision; it never writes a second live row. The journal keeps every decision.
        insert into access_grants (id, estate_id, binding_id, request_id, agent_id, callee, capability, resource,
                                   decided_by, decided_at, expires_at, decided_seq)
        values ((g->>'id')::uuid, e.estate_id, v_binding, v_req.id, v_req.agent_id, v_req.callee, g->>'capability',
                g->>'resource', e.actor->>'id', e.occurred_at, (g->>'expires_at')::timestamptz, e.seq)
        on conflict (estate_id, binding_id, callee, capability, resource) where revoked_at is null do update
          set request_id = excluded.request_id, decided_by = excluded.decided_by, decided_at = excluded.decided_at,
              decided_seq = excluded.decided_seq, expires_at = greatest(access_grants.expires_at, excluded.expires_at);
      end loop;

    when 'access.credential.claimed@1' then
      v_id := (e.payload->>'binding_id')::uuid;
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
        if exists (select 1 from access_grants where id = v_id and estate_id = e.estate_id and revoked_seq = e.seq) then return; end if;
        raise exception 'no live grant of this estate has that id' using errcode = 'check_violation';
      end if;

    when 'access.binding.revoked@1' then
      v_id := (e.payload->>'binding_id')::uuid;
      update access_bindings set revoked_at = e.occurred_at, revoked_by = e.actor->>'id', revoked_seq = e.seq
       where id = v_id and estate_id = e.estate_id and revoked_at is null;
      if not found then
        if exists (select 1 from access_bindings where id = v_id and estate_id = e.estate_id and revoked_seq = e.seq) then return; end if;
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
        if exists (select 1 from product_connections where id = v_id and estate_id = e.estate_id and removed_seq = e.seq) then return; end if;
        raise exception 'no live connection of this estate has that id' using errcode = 'check_violation';
      end if;

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
  perform apply_releases(e);
  perform apply_hub_access(e);
end;
$$;

-- A projector is not a door (migration 75): it runs only inside append_event / rebuild_estate_projections.
revoke execute on function apply_hub_access(journal) from public, anon, authenticated, service_role;
revoke execute on function apply_projections(journal) from public, anon, authenticated, service_role;

-- Grants and RLS. The trusted host reads these on the service role; no API role writes them, and no member
-- reads them directly: a verifier and a connection's vault slot are the host's business, shown through it.
alter table access_requests enable row level security;
alter table access_bindings enable row level security;
alter table access_grants enable row level security;
alter table product_connections enable row level security;
grant select on access_requests, access_bindings, access_grants, product_connections to service_role;
revoke insert, update, delete on access_requests, access_bindings, access_grants, product_connections from anon, authenticated, service_role;
revoke all on access_requests, access_bindings, access_grants, product_connections from anon, authenticated;

-- #endregion hub-access-schema

-- ── schema 76 as a private-archive source ───────────────────────────────────
--
-- ADR-0079 decision 5, as migrations 67–75 did for their own numbers. Migration 76 changes no archived
-- table, but it registers nine event types, so an ordinary journal from schema 76 may carry them and only a
-- schema that registers them can restore it; left unqualified, an export taken at 76 would say
-- `source_schema_version: 75`. An export now names 76; import accepts 66 to 76. The bodies are migration
-- 75's, changed only at those two points.
-- #region private-archive-source-schema — docs: docs/adr/0079-private-conversation-archives-preserve-history-not-authority.md#decision
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb,'71'::jsonb,'72'::jsonb,'73'::jsonb,'74'::jsonb,'75'::jsonb,'76'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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

  v_archive:=jsonb_build_object('schema','CeoPrivateArchive@1','archive_id',gen_random_uuid(),'source_schema_version',76,'owner_person_id',p_person_id,
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
