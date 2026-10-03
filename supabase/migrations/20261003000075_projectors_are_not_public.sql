-- 75 — a projector is not a door: no API role may call one, and no command is open to a signed-in member.
-- Confirmation pass after release review iteration 3 (2026-10-03), independent verifier, blocking.
--
-- THE DEFECT. Migrations 68 and 69 added `apply_question_deferrals(journal)` and `apply_releases(journal)`
-- as SECURITY DEFINER projectors and revoked their COMMANDS (`defer_question`, `reopen_question`,
-- `ask_topic`, `record_release`, `verify_release`) from every API role — but never the projectors. Their
-- `proacl` was NULL, which PostgreSQL reads as "EXECUTE to PUBLIC", so anon and authenticated could call
-- them with a hand-built journal row, and they write as their owner. MEASURED by the verifier on an owned
-- cluster with 74 migrations: `set role anon; select apply_releases(row(A,999,'release.verified@1',…)::journal)`
-- rewrote estate A's release with no journal row behind it, and `apply_question_deferrals` inserted and
-- deleted deferrals the same way. That falsifies two tests' claim that "the commands are the only door"
-- (`releases-db.test.mjs`, `board-deferral-db.test.mjs`), which checked the commands and never the
-- projector behind them. Every other projector was revoked from public, anon, authenticated AND
-- service_role where it was created (migration 27's shape for `apply_projections`): a projector runs only
-- inside `append_event` / `rebuild_estate_projections`, which are SECURITY DEFINER themselves, so their
-- owner calls it and no API role ever needs EXECUTE on it.
--
-- THE AUDIT (pg_proc over schema public on the fully migrated chain of 74, two ways — a bare owned
-- cluster, and one with Supabase's default privileges in force, `alter default privileges in schema
-- public grant all on functions to anon, authenticated, service_role`, which every Supabase project has
-- and the owned clusters did not). 122 functions. Executable by anon or authenticated:
--
--   apply_releases(journal), apply_question_deferrals(journal)   PUBLIC (proacl NULL): the finding.
--   decide_proposal(uuid,uuid,text,jsonb,uuid,int)               authenticated, UNDER SUPABASE DEFAULTS
--   release_grant_reservation(uuid,uuid,jsonb,text)              authenticated, UNDER SUPABASE DEFAULTS
--   import_declared_snapshot(uuid,uuid,text,jsonb,jsonb)         authenticated, UNDER SUPABASE DEFAULTS
--     Migrations 39, 41, 43 and 73 revoked these SECURITY DEFINER commands from public and anon only.
--     On a bare cluster that is enough; on Supabase the default privilege had already granted
--     authenticated, so any signed-in member could decide another estate's proposal, release a grant
--     reservation, or import a declared snapshot into any estate — none of them checks membership,
--     because their only legitimate caller is the trusted host on the service role.
--   schema_version()                                             authenticated by design (migration 51).
--   member_estates(), link_is_dependency(text), project_stats(uuid), deny_anon_on_new_tables()
--     SECURITY INVOKER; they write nothing. `project_stats` is also anon-executable under Supabase
--     defaults (migration 9 granted authenticated and service_role, revoked public only) — a read
--     bounded by RLS and by `member_estates()`, which answers nothing for anon. Left as it is.
--     `deny_anon_on_new_tables` is an event-trigger function and cannot be called directly.
--   One more, the service role only: `apply_task_link(journal)` was granted to service_role by
--   migration 53, the one projector a trusted caller could run around the journal. Nothing calls it
--   (no `apply_task_link` outside the migrations); it now matches every other projector.
--   `backend_exit_evidence` is service-role executable under Supabase defaults only; it is a STABLE read,
--   writes nothing, and is left as it is.
--
-- THE FIX.
--   1. EVERY function in schema public named `apply_*` — 24 of them on the chain of 74 — loses EXECUTE
--      for public, anon, authenticated and service_role. A loop over pg_proc, so a projector added before
--      this file but missed by its migration cannot stay open; a projector added after it is caught by
--      `function-privileges-db.test.mjs`, which the fast tier runs.
--   2. The three commands lose authenticated (and public and anon, restated); service_role keeps EXECUTE,
--      the one caller they were written for.
--   No table, no event type, no function body changes except the archive's schema qualification below.
--   The test runs its sweep with Supabase's default privileges in force, so a grant that only appears on
--   Supabase is a failing test on a laptop, not a finding after release.

-- #region projectors-are-not-public — docs: docs/adr/0103-an-id-belongs-to-one-estate-at-the-write-boundary.md#decision

-- 1. Projectors: the two the verifier drove by hand, named so the fix can be found by its name …
revoke execute on function apply_releases(journal) from public, anon, authenticated, service_role;
revoke execute on function apply_question_deferrals(journal) from public, anon, authenticated, service_role;

-- … and every other `apply_*`, by construction rather than by list.
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'apply\_%' escape '\'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated, service_role', f);
  end loop;
end $$;

-- 2. Commands written for the trusted host only: closed to a signed-in member too.
revoke execute on function decide_proposal(uuid, uuid, text, jsonb, uuid, int) from public, anon, authenticated;
grant  execute on function decide_proposal(uuid, uuid, text, jsonb, uuid, int) to service_role;
revoke execute on function release_grant_reservation(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant  execute on function release_grant_reservation(uuid, uuid, jsonb, text) to service_role;
revoke execute on function import_declared_snapshot(uuid, uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant  execute on function import_declared_snapshot(uuid, uuid, text, jsonb, jsonb) to service_role;

-- #endregion projectors-are-not-public

-- ── schema 75 as a private-archive source ───────────────────────────────────
--
-- ADR-0079 decision 5, as migrations 67–74 did for their own numbers. Migration 75 changes no archived
-- table and registers no event type, so a schema-75 journal has the shape of a schema-74 one; left
-- unqualified, an export taken at 75 would say `source_schema_version: 74`. An export now names 75;
-- import accepts 66 to 75. The bodies are migration 74's, changed only at those two points.
-- #region private-archive-source-schema — docs: docs/adr/0079-private-conversation-archives-preserve-history-not-authority.md#decision
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb,'71'::jsonb,'72'::jsonb,'73'::jsonb,'74'::jsonb,'75'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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

  v_archive:=jsonb_build_object('schema','CeoPrivateArchive@1','archive_id',gen_random_uuid(),'source_schema_version',75,'owner_person_id',p_person_id,
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
