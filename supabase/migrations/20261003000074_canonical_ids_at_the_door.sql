-- 74 — the door compares exactly the id the projector stores, and a journal holds ids in one spelling;
-- the agent-name rule trims the whitespace the form trims.
-- Confirmation pass after release review iteration 3 (2026-10-03): items 1 (blocking) and 6 (low).
--
-- MIGRATION 72'S `identity_uuid` AND THE PROJECTORS READ AN ID DIFFERENTLY, AND THIS IS THE CORRECTION.
-- Migrations 72 and 73 are executed and dated, so their text is not rewritten; the truth is stated here.
--
--   Migration 72's header says the door compares ids "through `identity_uuid`, which answers null for a
--   malformed id, so the door never changes which error a malformed payload raises: the projector's own
--   cast still refuses it". The second half holds; the first hides a gap. `identity_uuid` matched only
--   the 8-4-4-4-12 hyphenated pattern, but every projector casts with `::uuid`, and `::uuid` also accepts
--   32 bare hex digits, a `{braced}` id, and a hyphen after any group of four digits. MEASURED on an owned
--   cluster (PostgreSQL 17): '70000000000040008000000000000001', '{70000000-0000-4000-8000-000000000001}',
--   '7000-0000-0000-4000-8000-0000-0000-0001' and '{70000000000040008000000000000001}' all cast to
--   70000000-0000-4000-8000-000000000001; ' 7000…0001' (a space) and '{7000…0001' (one brace) do not.
--   So an id in one of those spellings was null to the door and a real row to the projector.
--   MEASURED by the reviewer with 73 migrations: B's heartbeat and stage naming A's managed session
--   without hyphens, or braced, were ACCEPTED, the stage row became B's, and A's own canonical beat and
--   stage were then refused; a braced transcript for a new session took it before A's launch, so A's
--   `admit_task_launch` for it was refused; `project.created@1` with A's project id without hyphens was
--   journalled in B. Only a service-role caller can write such a payload (the app mints canonical ids),
--   which is why this is a hole in the door, not in the app.
--
-- 1. BOTH HALVES, BECAUSE EACH CLOSES A DIFFERENT PATH.
--
--    a. `identity_uuid` IS THE PROJECTOR'S CAST. It now returns `p::uuid` and answers null only when
--       that cast raises `invalid_text_representation` — by construction the set of spellings it accepts
--       is the set the projectors accept, on this PostgreSQL version and any later one, with no pattern
--       to fall out of step. The door therefore compares the very uuid the projector will store, for every
--       arm of `refuse_foreign_identity`, `session_held_elsewhere` and `refuse_taken_agent_name`. A value
--       the cast refuses is still null to the door and still refused by the projector with its own error
--       (72's promise kept). The exception block costs a subtransaction per call (up to a dozen per
--       append); it writes nothing, so it consumes no transaction id.
--
--    b. `append_event` REFUSES A NON-CANONICAL SPELLING (`refuse_noncanonical_identity`). The door alone
--       would leave the journal holding '{…}' or upper-case text, and several readers compare the
--       journal's TEXT, not its uuid: `admit_task_launch` finds a session's first admission by
--       `payload->>'session_id' = p_session_id::text` (and its index is on that text), `chainAdvance.ts`
--       and its partial indexes match `payload->>'id'`, `repair_foreign_heartbeats` matched
--       `lower(payload->>'session_id')`. An event whose `id`, `project_id`, `session_id`, `task_id`,
--       `note_id`, `task_run_id` or `delivery_id` — every payload key the door reads — is a string that
--       `::uuid` accepts but that is not already its own canonical text (lower-case, 8-4-4-4-12) raises
--       `check_violation` naming the event type and the key, and nothing is journalled. It runs with the
--       registry check, before the estate lock, so a refusal costs no lock (migration 71). A value the
--       cast refuses is not this rule's business (1a); a non-string value is left to the projector.
--       Upper case is refused too, although (a) alone would compare it correctly: the journal's text
--       readers above would not. The desktop's command ingress (`commandIngress.ts`) accepted upper-case
--       ids and kept their bytes; it now refuses them with its own `invalid_identifier`, so an agent
--       hears the reason from the boundary it called instead of a database error.
--
--    Not covered, stated so it is not assumed: ids nested in arrays or objects (`fact_ids`, `task_ids`,
--    `node.runId`) and keys the door does not read (`waiting_id`, `supersedes`). A journal written before
--    this migration may already hold a non-canonical spelling (only a service-role caller could have
--    written one); replay casts it to the same uuid, so projections are unaffected. To look:
--      select estate_id, seq, type from journal, lateral (select 1 from unnest(array['id','project_id',
--        'session_id','task_id','note_id','task_run_id','delivery_id']) k
--        where identity_uuid(payload->>k)::text is distinct from payload->>k and identity_uuid(payload->>k) is not null) x;
--    `repair_foreign_heartbeats` now finds the owner's beats through `identity_uuid`, so a re-run after
--    restoring such a journal reads every spelling.
--
-- 2. THE NAME RULE TRIMS WHAT THE FORM TRIMS (item 6). `refuse_taken_agent_name` used `btrim`, which
--    removes spaces only; `agentSpec.ts#nameKey` uses JavaScript's `String#trim`, which removes the
--    ECMAScript WhiteSpace and LineTerminator set. MEASURED with Node over every code point: 25 of them —
--    U+0009–U+000D, U+0020, U+00A0, U+1680, U+2000–U+200A, U+2028, U+2029, U+202F, U+205F, U+3000,
--    U+FEFF — and none outside the BMP. U+0085, U+180E and U+200B are NOT in it. `agent_name_trim` trims
--    exactly that set from both ends, applied to the new name and to every stored name it is compared
--    with, so "warden" and "warden" followed by a no-break space are one name to both sides.
--    `estate-identity-db.test.mjs` computes the set from the runtime and drives every member through the
--    rule, so a drift between the two shows up as a failing test, not a second agent.
--
-- Additive: no table, no event type, no grant on a table. Redefined with their signatures: `identity_uuid`
-- (language sql → plpgsql), `refuse_taken_agent_name`, `repair_foreign_heartbeats`, `append_event`
-- (re-granted as 71–73 granted it). Two helpers added and revoked from every API role.

-- #region canonical-ids-at-the-door — docs: docs/adr/0103-an-id-belongs-to-one-estate-at-the-write-boundary.md#decision

-- 1a. The projector's own cast, made total: the canonical uuid, or null where `::uuid` would raise.
create or replace function identity_uuid(p text) returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  return p::uuid;
exception when invalid_text_representation then
  return null;
end $$;
revoke execute on function identity_uuid(text) from public;
revoke execute on function identity_uuid(text) from anon, authenticated, service_role;

-- 1b. One spelling in the journal, for every payload key the door reads.
create function refuse_noncanonical_identity(p_type text, p_payload jsonb) returns void
language plpgsql
immutable
set search_path = public
as $$
declare
  k text;
  v text;
  c uuid;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' then return; end if;
  foreach k in array array['id', 'project_id', 'session_id', 'task_id', 'note_id', 'task_run_id', 'delivery_id'] loop
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
end $$;
revoke execute on function refuse_noncanonical_identity(text, jsonb) from public;
revoke execute on function refuse_noncanonical_identity(text, jsonb) from anon, authenticated, service_role;

-- 2. JavaScript's `String#trim` set (ECMAScript WhiteSpace + LineTerminator), measured above.
create function agent_name_trim(p text) returns text
language sql
immutable
set search_path = public
as $$
  select btrim(p, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
$$;
revoke execute on function agent_name_trim(text) from public;
revoke execute on function agent_name_trim(text) from anon, authenticated, service_role;

-- refuse_taken_agent_name: migration 73's body; both sides trimmed with `agent_name_trim` instead of `btrim`.
create or replace function refuse_taken_agent_name(
  p_estate_id uuid,
  p_type      text,
  p_payload   jsonb
) returns void
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_name text := agent_name_trim(coalesce(p_payload->>'name', ''));
begin
  if p_type <> 'agent.registered@1' or p_payload->>'instructions' is null or v_name = '' then return; end if;
  -- Migration 73: the declared import of a workspace that already held both names lands both.
  if exists (select 1 from declared_import_authorizations a
              where a.transaction_id = txid_current() and a.estate_id = p_estate_id) then return; end if;
  if exists (select 1 from agent_bindings b
              where b.estate_id = p_estate_id
                and b.project_id = identity_uuid(p_payload->>'project_id')
                and b.id is distinct from identity_uuid(p_payload->>'id')
                and b.instructions is not null
                -- Migration 73: Unicode simple case mapping whatever the database locale; migration 74: the
                -- whitespace `String#trim` removes (`agentSpec.ts#nameKey` applies both).
                and lower(agent_name_trim(b.role) collate pg_c_utf8) = lower(v_name collate pg_c_utf8)) then
    raise exception using
      errcode = 'unique_violation',
      message = format('this project already has an agent called %s', v_name);
  end if;
end $$;

-- repair_foreign_heartbeats: migration 73's body; the owner's beats are found through `identity_uuid`, so
-- every spelling an older journal may hold is read (see "Not covered" above). Not re-run: 73 ran it.
create or replace function repair_foreign_heartbeats() returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  r record;
  e journal;
  n integer := 0;
begin
  for r in
    select h.session_id, min(o.estate_id::text)::uuid as owner
      from session_heartbeats h
      join (select session_id, estate_id from task_runs where session_id is not null
            union
            select session_id, estate_id from project_tasks where session_id is not null) o
        on o.session_id = h.session_id
     group by h.session_id, h.estate_id
    having count(distinct o.estate_id) = 1 and min(o.estate_id::text)::uuid <> h.estate_id
  loop
    delete from session_heartbeats where session_id = r.session_id;
    for e in
      select * from journal
       where estate_id = r.owner and type = 'agent.heartbeat@1'
         and identity_uuid(payload->>'session_id') = r.session_id
       order by seq
    loop
      perform apply_heartbeats(e);
    end loop;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function repair_foreign_heartbeats() from public;
revoke execute on function repair_foreign_heartbeats() from anon, authenticated, service_role;

-- append_event: migration 73's body; the spelling rule runs with the registry check, before any lock.
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
  perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text, 4242));
  perform refuse_foreign_identity(p_estate_id, p_type, p_payload, p_project_id);   -- migration 73: under the lock
  perform refuse_taken_agent_name(p_estate_id, p_type, p_payload);
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

-- #endregion canonical-ids-at-the-door

-- ── schema 74 as a private-archive source ───────────────────────────────────
--
-- ADR-0079 decision 5, as migrations 67–73 did for their own numbers. Migration 74 changes no archived
-- table and registers no event type, so a schema-74 journal has the shape of a schema-73 one; left
-- unqualified, an export taken at 74 would say `source_schema_version: 73`. An export now names 74;
-- import accepts 66 to 74. The bodies are migration 73's, changed only at those two points.
-- #region private-archive-source-schema — docs: docs/adr/0079-private-conversation-archives-preserve-history-not-authority.md#decision
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb,'71'::jsonb,'72'::jsonb,'73'::jsonb,'74'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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

  v_archive:=jsonb_build_object('schema','CeoPrivateArchive@1','archive_id',gen_random_uuid(),'source_schema_version',74,'owner_person_id',p_person_id,
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
