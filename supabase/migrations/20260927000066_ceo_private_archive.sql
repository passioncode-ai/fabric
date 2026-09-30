-- ADR-0079 / first-slice plan A1. Portable owner-private history, never executable work.
-- Source format 66 only. The trusted service principal is derived by the host; no caller of
-- these helpers is ever anon, authenticated or the service role directly (see the revokes).
--
-- ONE VOCABULARY WITH THE NATIVE CODEC. Every refusal raised here carries, as its whole
-- message, one of apps/desktop/src/main/archiveJson.ts ARCHIVE_REASON_CODES: invalid_json,
-- too_large, invalid_archive, integrity_mismatch, unsupported_schema (and, from the commands,
-- archive_stale, idempotency_conflict, not_found, unavailable). No message carries a body, a
-- digest, a subject or a path.
--
-- ONE BUDGET DEFINITION WITH THE CODEC: the root value is depth 1, every value is one node,
-- object keys are not nodes. Frozen by the A1-1 vectors in
-- apps/desktop/test/fixtures/ceo-private-archive/, which the SQL test replays byte for byte.
--
-- The companion arrives as jsonb, so its duplicate keys and number spellings such as `1e0`
-- are invisible here; trusted main always decodes it with the codec first (plan A1-4). The
-- ordinary journal arrives as original text, so its bytes are checked here in full.

alter table estate_restore_boundaries drop constraint estate_restore_boundaries_mode_check;
alter table estate_restore_boundaries
 add column authority_estate_id uuid,
 add column person_id uuid,
 add column operation_id uuid,
 add column manifest jsonb,
 add column request_digest text,
 add column prefix_digest text,
 add column receipt jsonb,
 add unique(target_estate_id,operation_id),
 add unique(operation_id),
 add unique(target_estate_id,operation_id,mode),
 add check(mode in ('legacy_unverified','verified')),
 add check((mode='legacy_unverified' and authority_estate_id is null and person_id is null and operation_id is null and manifest is null and request_digest is null and prefix_digest is null and receipt is null)
  or (mode='verified' and authority_estate_id is not null and authority_estate_id<>target_estate_id and person_id is not null and operation_id is not null and manifest is not null and request_digest ~ '^[0-9a-f]{64}$' and prefix_digest ~ '^[0-9a-f]{64}$' and receipt is not null));
alter table ceo_private_contents add unique(id,estate_id,person_id);
create table ceo_private_import_receipts (
 target_estate_id uuid not null,person_id uuid not null,operation_id uuid not null,
 restore_operation_id uuid not null,source_estate_id uuid not null,
 archive_id uuid not null,archive_digest text not null check(archive_digest ~ '^[0-9a-f]{64}$'),
 request_digest text not null check(request_digest ~ '^[0-9a-f]{64}$'),receipt jsonb not null,
 -- A private import stands only on a VERIFIED restore: the mode is part of the key it references.
 restore_mode text not null default 'verified' check(restore_mode='verified'),
 primary key(target_estate_id,person_id,operation_id),unique(target_estate_id,person_id),
 foreign key(target_estate_id,restore_operation_id,restore_mode) references estate_restore_boundaries(target_estate_id,operation_id,mode)
);
create table ceo_content_provenance (
 content_id uuid primary key,target_estate_id uuid not null,person_id uuid not null,
 import_operation_id uuid not null,source_estate_id uuid not null,source_digest text not null check(source_digest ~ '^[0-9a-f]{64}$'),
 origin_estate_id uuid not null,origin_digest text not null check(origin_digest ~ '^[0-9a-f]{64}$'),
 archive_id uuid not null,archive_digest text not null check(archive_digest ~ '^[0-9a-f]{64}$'),
 foreign key(content_id,target_estate_id,person_id) references ceo_private_contents(id,estate_id,person_id),
 foreign key(target_estate_id,person_id,import_operation_id) references ceo_private_import_receipts(target_estate_id,person_id,operation_id)
);
alter table ceo_private_import_receipts enable row level security;
alter table ceo_content_provenance enable row level security;
revoke all on ceo_private_import_receipts,ceo_content_provenance from public,anon,authenticated,service_role;
create trigger ceo_import_immutable before update or delete on ceo_private_import_receipts for each row execute function ceo_primary_immutable();
create trigger ceo_provenance_immutable before update or delete on ceo_content_provenance for each row execute function ceo_primary_immutable();

-- ─── closed-shape and scalar helpers ─────────────────────────────────────────
create function ceo_archive_fail(code text) returns void language plpgsql immutable set search_path=public as $$
begin
 if code not in ('invalid_json','too_large','invalid_archive','integrity_mismatch','unsupported_schema','archive_stale','idempotency_conflict','not_found','unavailable') then
  raise exception 'invalid_archive' using errcode='check_violation';
 end if;
 raise exception '%',code using errcode='check_violation';
end $$;
create function ceo_archive_keys(v jsonb,ks text[]) returns boolean language sql immutable set search_path=public as $$
 select case when jsonb_typeof(v)='object' then v ?& ks and (select count(*) from jsonb_object_keys(v))=cardinality(ks) else false end
$$;
-- A companion integer: a jsonb number whose visible spelling is a canonical integer within
-- [min, MAX_SAFE_INTEGER]. `1.0` is visible in jsonb and refuses as the codec does.
create function ceo_archive_int(v jsonb,p_min bigint default 0) returns bigint language plpgsql immutable set search_path=public as $$
declare s text:=v#>>'{}';n numeric;
begin
 if jsonb_typeof(v) is distinct from 'number' then perform ceo_archive_fail('invalid_archive'); end if;
 if s !~ '^-?(0|[1-9][0-9]*)$' or s='-0' then perform ceo_archive_fail('invalid_json'); end if;
 n:=s::numeric;
 if n>9007199254740991 or n<-9007199254740991 then perform ceo_archive_fail('invalid_json'); end if;
 if n<p_min then perform ceo_archive_fail('invalid_archive'); end if;
 return n::bigint;
end $$;
-- The ordinary journal's `seq`: a positive safe integer, or its canonical decimal string
-- (ADR-0079 §6). A number is judged by value, as the codec's lossless reader does.
create function ceo_archive_journal_seq(v jsonb) returns bigint language plpgsql immutable set search_path=public as $$
declare s text:=v#>>'{}';n numeric;
begin
 if jsonb_typeof(v)='string' then
  if s !~ '^[1-9][0-9]{0,15}$' then perform ceo_archive_fail('invalid_archive'); end if;
  n:=s::numeric;
 elsif jsonb_typeof(v)='number' then
  n:=s::numeric;
  if n<>trunc(n) then perform ceo_archive_fail('invalid_archive'); end if;
 else perform ceo_archive_fail('invalid_archive');
 end if;
 if n<1 or n>9007199254740991 then perform ceo_archive_fail('invalid_archive'); end if;
 return n::bigint;
end $$;
create function ceo_archive_time(v text) returns boolean language plpgsql immutable set search_path=public as $$
declare t timestamptz;
begin
 if v is null or v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,6})?(Z|\+00:00)$' then return false;end if;
 t:=v::timestamptz;return isfinite(t);
exception when others then return false;  -- an impossible calendar date is simply not a timestamp
end $$;

-- ─── bounded JSON admission for the ordinary journal ─────────────────────────
-- Depth is checked lexically before any recursive traversal; json (not jsonb) keeps duplicate
-- keys visible. Returns the number of nodes the value used.
create function ceo_archive_json_nodes(v json,p_depth integer,p_budget integer) returns integer language plpgsql immutable set search_path=public as $$
declare n integer:=1;x json;
begin
 if p_depth>32 or p_budget<1 then perform ceo_archive_fail('too_large'); end if;
 if json_typeof(v)='object' then
  if (select count(*)<>count(distinct key) from json_each(v)) then perform ceo_archive_fail('invalid_json'); end if;
  for x in select value from json_each(v) loop n:=n+ceo_archive_json_nodes(x,p_depth+1,p_budget-n);end loop;
 elsif json_typeof(v)='array' then
  for x in select value from json_array_elements(v) loop n:=n+ceo_archive_json_nodes(x,p_depth+1,p_budget-n);end loop;
 end if;
 return n;
end $$;
create function ceo_archive_json_admit(raw text,p_budget integer,out doc jsonb,out nodes integer) language plpgsql immutable set search_path=public as $$
declare token text[];depth integer:=0;v json;
begin
 for token in select regexp_matches(raw,'("(?:[^"\\]|\\.)*"|[{}\[\]])','g') loop
  if token[1] in ('{','[') then depth:=depth+1;if depth>32 then perform ceo_archive_fail('too_large'); end if;
  elsif token[1] in ('}',']') then depth:=depth-1;end if;
 end loop;
 begin
  v:=raw::json;
 exception when others then perform ceo_archive_fail('invalid_json');  -- not silence: the parse failure IS the refusal
 end;
 -- NUL or a lone surrogate: PostgreSQL text and jsonb cannot hold it, and the codec refuses it too.
 -- Only those two error classes map here; our own refusals are check_violation and pass through.
 begin
  nodes:=ceo_archive_json_nodes(v,1,p_budget);
  doc:=v::jsonb;
 exception when untranslatable_character or invalid_text_representation then perform ceo_archive_fail('invalid_json');
 end;
end $$;

-- ─── the ordinary archive (FabricArchive@1) ──────────────────────────────────
create function ceo_archive_manifest(m jsonb) returns void language plpgsql immutable set search_path=public as $$
begin
 if not ceo_archive_keys(m,array['schema','sourceEstateId','takenAtUtc','watermarkSeq','eventCount','digest']) then perform ceo_archive_fail('invalid_archive'); end if;
 if m->>'schema' is distinct from 'FabricArchive@1' then perform ceo_archive_fail('unsupported_schema'); end if;
 if not ceo_uuid(m->'sourceEstateId') or jsonb_typeof(m->'takenAtUtc') is distinct from 'string' or not ceo_archive_time(m->>'takenAtUtc')
  or jsonb_typeof(m->'digest') is distinct from 'string' or not coalesce(m->>'digest' ~ '^[0-9a-f]{64}$',false) then perform ceo_archive_fail('invalid_archive'); end if;
 perform ceo_archive_int(m->'watermarkSeq');perform ceo_archive_int(m->'eventCount');
 if (m->>'eventCount')::bigint>65536 then perform ceo_archive_fail('too_large'); end if;
 if ((m->>'eventCount')::bigint=0 and (m->>'watermarkSeq')::bigint<>0)
  or ((m->>'eventCount')::bigint>0 and (m->>'watermarkSeq')::bigint<(m->>'eventCount')::bigint) then
  perform ceo_archive_fail('invalid_archive'); end if;
end $$;
-- Original bytes are checked against the existing digest BEFORE any line is parsed, in the
-- codec's order: manifest, line endings, digest, count, then each line.
create function ceo_archive_estate_rows(m jsonb,raw text) returns jsonb language plpgsql immutable set search_path=public as $$
declare lines text[];line text;x jsonb;used integer;events jsonb:='[]';previous bigint:=0;s bigint;nodes integer:=0;header bytea;body text;
begin
 perform ceo_archive_manifest(m);
 if raw is null or octet_length(raw)>33554432 then perform ceo_archive_fail('too_large'); end if;
 if position(E'\r' in raw)>0 or ((m->>'eventCount')::bigint=0 and raw<>'') or ((m->>'eventCount')::bigint>0 and right(raw,1)<>E'\n') then
  perform ceo_archive_fail('invalid_archive'); end if;
 body:=case when raw='' then '' else left(raw,length(raw)-1) end;
 header:=convert_to('FabricArchive@1','UTF8')||'\x00'::bytea||convert_to(m->>'sourceEstateId','UTF8')||'\x00'::bytea
  ||convert_to((m->>'watermarkSeq')::bigint::text,'UTF8')||'\x00'::bytea||convert_to((m->>'eventCount')::bigint::text,'UTF8')||'\x00'::bytea;
 if encode(sha256(header||convert_to(body,'UTF8')),'hex')<>m->>'digest' then perform ceo_archive_fail('integrity_mismatch'); end if;
 lines:=case when raw='' then array[]::text[] else string_to_array(body,E'\n') end;
 if coalesce(cardinality(lines),0)<>(m->>'eventCount')::integer then perform ceo_archive_fail('invalid_archive'); end if;
 foreach line in array lines loop
  if octet_length(line)>1048576 then perform ceo_archive_fail('too_large'); end if;
  if line='' then perform ceo_archive_fail('invalid_archive'); end if;
  select a.doc,a.nodes into x,used from ceo_archive_json_admit(line,1000000-nodes) a;nodes:=nodes+used;
  if not ceo_archive_keys(x,array['seq','type','schema_rev','actor','project_id','run_id','node_id','payload','occurred_at'])
   or jsonb_typeof(x->'type') is distinct from 'string' or length(x->>'type')<1
   or jsonb_typeof(x->'schema_rev') is distinct from 'string' or length(x->>'schema_rev')<1
   or (x->'project_id'<>'null'::jsonb and not ceo_uuid(x->'project_id'))
   or (x->'run_id'<>'null'::jsonb and not ceo_uuid(x->'run_id'))
   or (x->'node_id'<>'null'::jsonb and not ceo_uuid(x->'node_id'))
   or jsonb_typeof(x->'occurred_at') is distinct from 'string' or not ceo_archive_time(x->>'occurred_at') then perform ceo_archive_fail('invalid_archive'); end if;
  s:=ceo_archive_journal_seq(x->'seq');if s<=previous then perform ceo_archive_fail('invalid_archive'); end if;previous:=s;
  events:=events||jsonb_build_array(x);
 end loop;
 if previous<>(m->>'watermarkSeq')::bigint then perform ceo_archive_fail('invalid_archive'); end if;
 return events;
end $$;
create function ceo_archive_prefix(events jsonb) returns text language plpgsql immutable set search_path=public as $$
declare x jsonb;v text;result text:=ceo_frame('CeoRestoredPrefix@1')||ceo_frame(jsonb_array_length(events)::text);
begin
 for x in select value from jsonb_array_elements(events) loop
  foreach v in array array[ceo_archive_journal_seq(x->'seq')::text,x->>'type',x->>'schema_rev',(x->'actor')::text,x->>'project_id',x->>'run_id',x->>'node_id',(x->'payload')::text,to_char((x->>'occurred_at')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')] loop result:=result||ceo_frame(v);end loop;
 end loop;
 return encode(sha256(convert_to(result,'UTF8')),'hex');
end $$;
create function ceo_archive_journal(e uuid) returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('seq',seq,'type',type,'schema_rev',schema_rev,'actor',actor,'project_id',project_id,'run_id',run_id,'node_id',node_id,'payload',payload,'occurred_at',to_char(occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) order by seq),'[]'::jsonb) from journal where estate_id=e
$$;

-- ─── the companion (CeoPrivateArchive@1) canonical form ──────────────────────
-- Byte for byte the codec's privateArchiveCanonical: every header field except
-- archive_digest, the exact manifest, then each array's length and each row's fields in
-- contract order, each framed by migration 64's ceo_frame. The envelope is one framed field,
-- ceo_send_canonical(source Estate, owner, envelope). Relations between rows are the import
-- validator's (A1-4); this checks the closed shape the canonical form reads.
create function ceo_archive_array(v jsonb,p_max integer) returns jsonb language plpgsql immutable set search_path=public as $$
begin
 if jsonb_typeof(v) is distinct from 'array' then perform ceo_archive_fail('invalid_archive'); end if;
 if jsonb_array_length(v)>p_max then perform ceo_archive_fail('too_large'); end if;
 return v;
end $$;
create function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or a->'source_schema_version' is distinct from '66'::jsonb then perform ceo_archive_fail('unsupported_schema'); end if;
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
create function ceo_private_archive_digest(a jsonb) returns text language sql immutable set search_path=public as $$
 select encode(sha256(convert_to(ceo_private_archive_canonical(a),'UTF8')),'hex')
$$;

-- Every helper is reachable only from the owner-checked commands (security definer, A1-3/A1-4),
-- never directly: ceo_archive_journal is security definer and reads any Estate's journal.
revoke all on function ceo_archive_fail(text) from public,anon,authenticated,service_role;
revoke all on function ceo_archive_keys(jsonb,text[]) from public,anon,authenticated,service_role;
revoke all on function ceo_archive_int(jsonb,bigint) from public,anon,authenticated,service_role;
revoke all on function ceo_archive_journal_seq(jsonb) from public,anon,authenticated,service_role;
revoke all on function ceo_archive_time(text) from public,anon,authenticated,service_role;
revoke all on function ceo_archive_json_nodes(json,integer,integer) from public,anon,authenticated,service_role;
revoke all on function ceo_archive_json_admit(text,integer) from public,anon,authenticated,service_role;
revoke all on function ceo_archive_manifest(jsonb) from public,anon,authenticated,service_role;
revoke all on function ceo_archive_estate_rows(jsonb,text) from public,anon,authenticated,service_role;
revoke all on function ceo_archive_prefix(jsonb) from public,anon,authenticated,service_role;
revoke all on function ceo_archive_journal(uuid) from public,anon,authenticated,service_role;
revoke all on function ceo_archive_array(jsonb,integer) from public,anon,authenticated,service_role;
revoke all on function ceo_private_archive_canonical(jsonb) from public,anon,authenticated,service_role;
revoke all on function ceo_private_archive_digest(jsonb) from public,anon,authenticated,service_role;

-- ═══ A1-3 · verified restore into a fresh Estate (ADR-0079 §2–3) ═════════════
-- The event body shared by the legacy entry point and the verified wrapper: original seq,
-- projection in order, and the project-landing check. Neither writes a marker here; each
-- caller records its own boundary BEFORE calling this, so estate.created@1 never reaches
-- the membership arm unmarked.
create function restore_estate_events(p_target uuid,p_events jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare e jsonb;v_event journal;n int:=0;v_projects int;v_landed int;
begin
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

-- The legacy entry point keeps migration 65's behaviour and receipt shape, now over the
-- shared body.
create or replace function restore_estate_internal(p_target_estate uuid,p_source_estate uuid,p_name text,p_events jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_existing int;r jsonb;
begin
 if p_target_estate is null or p_source_estate is null then
  return jsonb_build_object('restored',false,'reason_code','unreadable'); end if;
 if p_target_estate=p_source_estate then
  return jsonb_build_object('restored',false,'reason_code','same_estate',
   'says','a restore never writes back into the estate it was taken from','remedy','Restore into a new estate and compare the two.'); end if;
 perform pg_advisory_xact_lock(hashtextextended(p_target_estate::text,4242));
 select count(*) into v_existing from journal where estate_id=p_target_estate;
 if v_existing>0 then
  return jsonb_build_object('restored',false,'reason_code','not_empty',
   'says',format('that estate already holds %s events',v_existing),'remedy','A restore creates an estate; it does not merge into one.'); end if;
 if p_events is null or jsonb_typeof(p_events)<>'array' then
  return jsonb_build_object('restored',false,'reason_code','unreadable','says','the archive body is not an array of events'); end if;
 perform record_estate_restore_boundary(p_target_estate,p_source_estate,p_events);
 insert into estates (id,name) values (p_target_estate,coalesce(p_name,'restored estate')) on conflict (id) do nothing;
 r:=restore_estate_events(p_target_estate,p_events);
 return jsonb_build_object('restored',true,'estate_id',p_target_estate,'events',(r->>'events')::int,
  'source_estate_id',p_source_estate,'projects',(r->>'projects')::int);
end $$;

-- A verified boundary, recorded under the target lock before any archived event projects.
create function record_verified_restore_boundary(p_target uuid,p_source uuid,p_events jsonb,p_control uuid,p_person uuid,
 p_operation uuid,p_manifest jsonb,p_request_digest text,p_prefix_digest text,p_receipt jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare x jsonb;owners bigint[]:='{}';
begin
 perform pg_advisory_xact_lock(hashtextextended(p_target::text,4242));
 if exists(select 1 from journal where estate_id=p_target) or exists(select 1 from estate_restore_boundaries where target_estate_id=p_target) then
  perform ceo_archive_fail('unavailable'); end if;
 for x in select value from jsonb_array_elements(p_events) loop
  if x->>'type'='estate.created@1' then owners:=array_append(owners,ceo_archive_journal_seq(x->'seq')); end if;
 end loop;
 insert into estate_restore_boundaries(target_estate_id,source_estate_id,mode,watermark_seq,event_count,owner_event_seqs,
  authority_estate_id,person_id,operation_id,manifest,request_digest,prefix_digest,receipt)
 values(p_target,p_source,'verified',(p_manifest->>'watermarkSeq')::bigint,(p_manifest->>'eventCount')::int,owners,
  p_control,p_person,p_operation,p_manifest,p_request_digest,p_prefix_digest,p_receipt);
end $$;

-- ONE ACT: authority, a fresh shell, same-Person ownership, the boundary, the history and the
-- prefix check commit together or not at all. Trusted main derives the Person and the held
-- control-Estate revision and mints the target and operation IDs; nothing here trusts the
-- archive for identity. Refusals are {ok:false, reason_code} from ARCHIVE_REASON_CODES and
-- leave zero rows behind.
create function restore_estate_verified(p_control_estate uuid,p_person_id uuid,p_revision bigint,p_actor jsonb,
 p_operation_id uuid,p_target_estate uuid,p_estate_manifest jsonb,p_journal_ndjson text,p_name text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_events jsonb;v_source uuid;v_digest text;v_prefix text;v_actual text;v_receipt jsonb;v_prior estate_restore_boundaries;
 v_member memberships;v_first uuid;v_second uuid;v_body jsonb;v_value text;v_frame text:='';
begin
 if p_control_estate is null or p_person_id is null or p_revision is null or p_operation_id is null or p_target_estate is null
  or p_target_estate=p_control_estate or not ceo_actor_valid(p_actor,p_person_id)
  or p_name is null or length(p_name) not between 1 and 200 then
  return jsonb_build_object('ok',false,'reason_code','unavailable'); end if;
 begin
  -- The archive is read before any lock and any write: a refused file costs nothing.
  v_events:=ceo_archive_estate_rows(p_estate_manifest,p_journal_ndjson);
  v_source:=(p_estate_manifest->>'sourceEstateId')::uuid;
  if v_source=p_target_estate or v_source=p_control_estate then perform ceo_archive_fail('invalid_archive'); end if;
  foreach v_value in array array['RestoreEstateVerified@1',p_control_estate::text,p_person_id::text,p_target_estate::text,p_operation_id::text,p_name,
   p_estate_manifest->>'schema',p_estate_manifest->>'sourceEstateId',p_estate_manifest->>'takenAtUtc',
   (p_estate_manifest->>'watermarkSeq')::bigint::text,(p_estate_manifest->>'eventCount')::bigint::text,p_estate_manifest->>'digest'] loop
   v_frame:=v_frame||ceo_frame(v_value); end loop;
  v_digest:=encode(sha256(convert_to(v_frame,'UTF8')),'hex');
  v_prefix:=ceo_archive_prefix(v_events);

  -- Locks in one order everywhere: the operation, then both Estates by UUID.
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,4343));
  v_first:=least(p_control_estate,p_target_estate);v_second:=greatest(p_control_estate,p_target_estate);
  perform pg_advisory_xact_lock(hashtextextended(v_first::text,4242));
  perform pg_advisory_xact_lock(hashtextextended(v_second::text,4242));

  -- Current authority first, even for a retry: the owner of the control Estate at the held
  -- revision, under a row lock a concurrent change_membership must wait for.
  select * into v_member from memberships where estate_id=p_control_estate and person_id=p_person_id for update;
  if not found or v_member.role<>'owner' or v_member.revision<>p_revision then perform ceo_archive_fail('unavailable'); end if;

  -- An exact retry returns the original receipt; the same operation with anything else conflicts.
  select * into v_prior from estate_restore_boundaries where operation_id=p_operation_id;
  if found then
   if v_prior.mode='verified' and v_prior.request_digest=v_digest and v_prior.authority_estate_id=p_control_estate and v_prior.person_id=p_person_id then
    return v_prior.receipt||jsonb_build_object('repeated',true); end if;
   perform ceo_archive_fail('idempotency_conflict');
  end if;

  -- A fresh target only: no shell, no history, no boundary of any mode.
  if exists(select 1 from estates where id=p_target_estate) or exists(select 1 from journal where estate_id=p_target_estate)
   or exists(select 1 from estate_restore_boundaries where target_estate_id=p_target_estate) then perform ceo_archive_fail('unavailable'); end if;

  v_receipt:=jsonb_build_object('ok',true,'operation_id',p_operation_id,'source_estate_id',v_source,'target_estate_id',p_target_estate,
   'watermark_seq',(p_estate_manifest->>'watermarkSeq')::bigint,'event_count',(p_estate_manifest->>'eventCount')::bigint,
   'state','estate_restored','access','verified','target_revision',1);
  insert into estates(id,name) values(p_target_estate,p_name);
  insert into memberships(person_id,estate_id,role,changed_by) values(p_person_id,p_target_estate,'owner','restore_estate_verified');
  perform record_verified_restore_boundary(p_target_estate,v_source,v_events,p_control_estate,p_person_id,p_operation_id,
   p_estate_manifest,v_digest,v_prefix,v_receipt);
  v_body:=restore_estate_events(p_target_estate,v_events);

  -- Before commit: the history that landed is exactly the archive's, and the caller can use it.
  v_actual:=ceo_archive_prefix(ceo_archive_journal(p_target_estate));
  if v_actual<>v_prefix then perform ceo_archive_fail('integrity_mismatch'); end if;
  if (select count(*) from memberships where estate_id=p_target_estate)<>1
   or not exists(select 1 from memberships where estate_id=p_target_estate and person_id=p_person_id and role='owner' and revision=1) then
   perform ceo_archive_fail('unavailable'); end if;
  return v_receipt||jsonb_build_object('repeated',false);
 exception when check_violation or unique_violation or foreign_key_violation then
  -- Not silence: the subtransaction has already rolled back every write above; the refusal
  -- is returned as its code. A message outside the vocabulary (the landing check, a
  -- constraint) is reported as `unavailable`, never quoted.
  return jsonb_build_object('ok',false,'reason_code',case when sqlerrm in
   ('invalid_json','too_large','invalid_archive','integrity_mismatch','unsupported_schema','archive_stale','idempotency_conflict','not_found','unavailable')
   then sqlerrm else 'unavailable' end);
 end;
end $$;

revoke all on function restore_estate_events(uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function record_verified_restore_boundary(uuid,uuid,jsonb,uuid,uuid,uuid,jsonb,text,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function restore_estate_internal(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function restore_estate_verified(uuid,uuid,bigint,jsonb,uuid,uuid,jsonb,text,text) from public,anon,authenticated;
grant execute on function restore_estate_verified(uuid,uuid,bigint,jsonb,uuid,uuid,jsonb,text,text) to service_role;
comment on function restore_estate_verified(uuid,uuid,bigint,jsonb,uuid,uuid,jsonb,text,text) is
 'ADR-0079: the current owner of a control Estate restores an ordinary archive into a fresh Estate they then own; verified boundary before projection, prefix fingerprint before commit, one receipt per operation.';

-- ═══ A1-4 · private export, import and receipt (ADR-0079 §4) ═══════════════════
-- The open alias intent is migration 64's frame(requested)||frame(kind)||frame(subject); it is
-- parsed back only as far as re-framing reproduces it byte for byte.
create function ceo_archive_open_intent(p_intent text) returns jsonb language plpgsql immutable set search_path=public as $$
declare requested text;kind text;subject text;rest text:=p_intent;len int;
begin
 len:=split_part(rest,':',1)::int;requested:=substr(rest,length(len::text)+2,len);rest:=substr(rest,length(len::text)+2+len);
 len:=split_part(rest,':',1)::int;kind:=substr(rest,length(len::text)+2,len);rest:=substr(rest,length(len::text)+2+len);
 len:=split_part(rest,':',1)::int;subject:=substr(rest,length(len::text)+2,len);
 if ceo_frame(requested)||ceo_frame(kind)||ceo_frame(subject)<>p_intent or not ceo_uuid(to_jsonb(requested)) or not ceo_uuid(to_jsonb(subject))
  or kind not in ('global','project','question') then perform ceo_archive_fail('invalid_archive'); end if;
 return jsonb_build_object('requested_conversation_id',requested,'subject_kind',kind,'subject_id',subject);
exception when invalid_text_representation then perform ceo_archive_fail('invalid_archive');  -- not silence: an unparseable intent is a refusal
end $$;

-- Journal coverage in both directions for one Person over one Estate's CEO receipts:
-- every captured conversation and message has its exact opaque event, and every CEO event
-- this Person authored is captured. `operator` maps only to migration 58's local Person.
create function ceo_archive_coverage(p_estate uuid,p_person uuid,p_conversations jsonb,p_messages jsonb) returns void
language plpgsql stable security definer set search_path=public as $$
declare x jsonb;j journal;
begin
 for x in select value from jsonb_array_elements(p_conversations) loop
  select * into j from journal where estate_id=p_estate and seq=(x->>'created_seq')::bigint;
  if not found or j.type<>'ceo.conversation.opened@1' or j.payload->>'conversation_id' is distinct from x->>'id' or not ceo_actor_valid(j.actor,p_person) then
   perform ceo_archive_fail('invalid_archive'); end if;
 end loop;
 for x in select value from jsonb_array_elements(p_messages) loop
  select * into j from journal where estate_id=p_estate and seq=(x->>'accepted_seq')::bigint;
  if not found or j.type<>'ceo.message.accepted@1' or not ceo_actor_valid(j.actor,p_person) or j.payload<>jsonb_build_object(
    'conversation_id',x->>'conversation_id','operation_id',x->'envelope'->>'operation_id','message_id',x->>'id',
    'request_id',x->>'request_id','content_id',x->>'content_id') then perform ceo_archive_fail('invalid_archive'); end if;
 end loop;
 if exists(select 1 from journal j2 where j2.estate_id=p_estate and j2.type in ('ceo.conversation.opened@1','ceo.message.accepted@1')
   and ceo_actor_valid(j2.actor,p_person)
   and not exists(select 1 from jsonb_array_elements(p_conversations) c where (c->>'created_seq')::bigint=j2.seq)
   and not exists(select 1 from jsonb_array_elements(p_messages) m where (m->>'accepted_seq')::bigint=j2.seq)) then
  perform ceo_archive_fail('invalid_archive'); end if;
end $$;

-- Export: read-only, one snapshot under the source Estate lock. The supplied ordinary archive
-- must BE this Estate's journal now, row for row; a writer that advanced it makes the export
-- archive_stale. Nothing is written, so a lost reply is answered by exporting again.
create function ceo_export_private_archive(p_estate_id uuid,p_person_id uuid,p_revision bigint,p_estate_manifest jsonb,p_journal_ndjson text)
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

  v_archive:=jsonb_build_object('schema','CeoPrivateArchive@1','archive_id',gen_random_uuid(),'source_schema_version',66,'owner_person_id',p_person_id,
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

-- The codec's relation rules (ceoPrivateArchive.ts#inspect) in SQL, set-based so 4096 messages
-- cost a few scans rather than a quadratic loop. Structure first, digests last, so one defect
-- gets the codec's code.
create function ceo_private_archive_validate(a jsonb) returns void language plpgsql set search_path=public as $$
declare w bigint;source uuid;owner uuid;
begin
 perform ceo_private_archive_canonical(a);  -- closed shape, schema versions and integer spellings
 w:=(a->'estate_archive'->>'watermarkSeq')::bigint;source:=(a->'estate_archive'->>'sourceEstateId')::uuid;owner:=(a->>'owner_person_id')::uuid;
 create temp table if not exists pg_temp.archive_c(i bigint,id uuid,kind text,subject uuid,owner_project uuid,created bigint,revision bigint) on commit drop;
 create temp table if not exists pg_temp.archive_m(i bigint,id uuid,conv uuid,ordinal bigint,content uuid,request uuid,accepted bigint,env jsonb,source_digest text,origin_estate uuid,origin_digest text) on commit drop;
 create temp table if not exists pg_temp.archive_o(i bigint,id uuid,kind text,message uuid,requested uuid,okind text,osubject uuid,rconv uuid,rrevision bigint,rseq bigint) on commit drop;
 truncate pg_temp.archive_c,pg_temp.archive_m,pg_temp.archive_o;
 insert into pg_temp.archive_c select x.i,(x.v->>'id')::uuid,x.v->>'subject_kind',(x.v->>'subject_id')::uuid,(x.v->>'owner_project_id')::uuid,
  (x.v->>'created_seq')::bigint,(x.v->>'revision')::bigint from jsonb_array_elements(a->'conversations') with ordinality x(v,i);
 insert into pg_temp.archive_m select x.i,(x.v->>'id')::uuid,(x.v->>'conversation_id')::uuid,(x.v->>'ordinal')::bigint,(x.v->>'content_id')::uuid,
  (x.v->>'request_id')::uuid,(x.v->>'accepted_seq')::bigint,x.v->'envelope',x.v->>'source_digest',(x.v->'origin'->>'estate_id')::uuid,x.v->'origin'->>'canonical_digest'
  from jsonb_array_elements(a->'messages') with ordinality x(v,i);
 insert into pg_temp.archive_o select x.i,(x.v->>'operation_id')::uuid,x.v->>'kind',(x.v->>'message_id')::uuid,(x.v->>'requested_conversation_id')::uuid,
  x.v->>'subject_kind',(x.v->>'subject_id')::uuid,(x.v->'receipt'->>'conversation_id')::uuid,(x.v->'receipt'->>'revision')::bigint,(x.v->'receipt'->>'receipt_seq')::bigint
  from jsonb_array_elements(a->'operations') with ordinality x(v,i);

 -- Conversations: strictly ascending ids, subject rules, bounded sequences, one per subject.
 if exists(select 1 from (select id,lag(id) over (order by i) prev from pg_temp.archive_c) t where prev is not null and id<=prev)
  or exists(select 1 from pg_temp.archive_c where created>w or revision>4096
   or case kind when 'global' then subject<>id or owner_project is not null when 'project' then owner_project is distinct from subject else owner_project is null end)
  or (select count(*)<>count(distinct (kind,subject)) from pg_temp.archive_c) then perform ceo_archive_fail('invalid_archive'); end if;
 -- Messages: grouped by conversation in ascending order, ordinals contiguous from 1, acceptance
 -- strictly after the opening and the previous message, within the watermark; every identity once.
 if exists(select 1 from pg_temp.archive_m m left join pg_temp.archive_c c on c.id=m.conv where c.id is null)
  or exists(select 1 from (select conv,lag(conv) over (order by i) prev from pg_temp.archive_m) t where prev is not null and conv<prev)
  or exists(select 1 from (select m.ordinal,m.accepted,c.created,row_number() over (partition by m.conv order by m.i) n,
     lag(m.accepted) over (partition by m.conv order by m.i) prev from pg_temp.archive_m m join pg_temp.archive_c c on c.id=m.conv) t
    where ordinal<>n or accepted<=coalesce(prev,created) or accepted>w)
  or (select count(*)<>count(distinct id) or count(*)<>count(distinct content) or count(*)<>count(distinct request) or count(*)<>count(distinct accepted) from pg_temp.archive_m)
  or exists(select 1 from pg_temp.archive_m m join pg_temp.archive_c c on c.created=m.accepted)
  or exists(select 1 from pg_temp.archive_m where ceo_send_error(env) is not null or env->>'conversation_id' is distinct from conv::text
   or env->>'message_id' is distinct from id::text or (env->>'expected_revision')::bigint+1<>ordinal or (env->'context'->>'estate_seq')::bigint>accepted)
  or exists(select 1 from pg_temp.archive_c c where revision<>(select count(*) from pg_temp.archive_m m where m.conv=c.id)) then
  perform ceo_archive_fail('invalid_archive'); end if;
 -- Operations: ascending ids; every message sent exactly once by its own operation; every
 -- conversation opened; an open alias agrees with its conversation.
 if exists(select 1 from (select id,lag(id) over (order by i) prev from pg_temp.archive_o) t where prev is not null and id<=prev)
  or exists(select 1 from pg_temp.archive_o o left join pg_temp.archive_m m on m.id=o.message where o.kind='send' and (m.id is null or m.env->>'operation_id'<>o.id::text))
  or (select count(*) from pg_temp.archive_o where kind='send')<>(select count(*) from pg_temp.archive_m)
  or (select count(distinct message) from pg_temp.archive_o where kind='send')<>(select count(*) from pg_temp.archive_m)
  or exists(select 1 from pg_temp.archive_o o left join pg_temp.archive_c c on c.id=o.rconv where o.kind='open' and (c.id is null or c.kind<>o.okind
   or c.subject<>o.osubject or o.rseq<>c.created or o.rrevision>c.revision or (c.kind='global' and o.requested<>c.id)))
  or exists(select 1 from pg_temp.archive_c c where not exists(select 1 from pg_temp.archive_o o where o.kind='open' and o.rconv=c.id)) then
  perform ceo_archive_fail('invalid_archive'); end if;
 -- Digests last: the source and the original Estate, each recomputed from the unchanged envelope.
 if exists(select 1 from pg_temp.archive_m where encode(sha256(convert_to(ceo_send_canonical(source,owner,env),'UTF8')),'hex')<>source_digest
   or encode(sha256(convert_to(ceo_send_canonical(origin_estate,owner,env),'UTF8')),'hex')<>origin_digest) then
  perform ceo_archive_fail('integrity_mismatch'); end if;
end $$;

-- Import: the whole companion is validated before the first protected insert, then inserted in
-- one transaction under the target Estate lock and migration 64's global identity locks (6064
-- conversations, then 6164 messages). Only immutable history is written: no pending request,
-- write authorization, session, grant, lease or dispatch, and no journal event — the original
-- opaque events already arrived with the verified restore.
create function ceo_import_private_archive(p_target_estate uuid,p_person_id uuid,p_revision bigint,p_actor jsonb,
 p_operation_id uuid,p_restore_operation_id uuid,p_archive jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_digest text;v_request text;v_prior ceo_private_import_receipts;b estate_restore_boundaries;v_receipt jsonb;v_id uuid;
 v_source uuid;v_count bigint;v_max bigint;x jsonb;v_env jsonb;v_canonical text;v_target_digest text;
begin
 if p_target_estate is null or p_operation_id is null or p_restore_operation_id is null
  or not ceo_authorized(p_target_estate,p_person_id,p_revision) or not ceo_actor_valid(p_actor,p_person_id) then
  return jsonb_build_object('ok',false,'reason_code','unavailable'); end if;
 begin
  -- The archive's owner is exactly the caller; nobody imports another Person's discussion.
  if jsonb_typeof(p_archive) is distinct from 'object' or p_archive->>'owner_person_id' is distinct from p_person_id::text then
   perform ceo_archive_fail('unavailable'); end if;
  v_digest:=ceo_private_archive_digest(p_archive);
  if v_digest<>p_archive->>'archive_digest' then perform ceo_archive_fail('integrity_mismatch'); end if;
  v_request:=encode(sha256(convert_to(ceo_frame('CeoPrivateImport@1')||ceo_frame(p_target_estate::text)||ceo_frame(p_person_id::text)
   ||ceo_frame(p_operation_id::text)||ceo_frame(p_restore_operation_id::text)||ceo_frame(v_digest),'UTF8')),'hex');
  -- An identical import returns its original receipt before any mutable target check.
  select * into v_prior from ceo_private_import_receipts where target_estate_id=p_target_estate and person_id=p_person_id and operation_id=p_operation_id;
  if found then
   if v_prior.request_digest=v_request then return v_prior.receipt||jsonb_build_object('repeated',true); end if;
   perform ceo_archive_fail('idempotency_conflict');
  end if;
  if exists(select 1 from ceo_private_import_receipts where target_estate_id=p_target_estate and person_id=p_person_id) then
   perform ceo_archive_fail('idempotency_conflict'); end if;

  -- A verified restore of exactly this ordinary archive, still exactly its prefix.
  select * into b from estate_restore_boundaries where target_estate_id=p_target_estate and operation_id=p_restore_operation_id and mode='verified';
  if not found then perform ceo_archive_fail('unavailable'); end if;
  if b.manifest<>p_archive->'estate_archive' or b.source_estate_id::text<>p_archive->'estate_archive'->>'sourceEstateId' then perform ceo_archive_fail('invalid_archive'); end if;
  select count(*),coalesce(max(seq),0) into v_count,v_max from journal where estate_id=p_target_estate;
  if v_count<>b.event_count or v_max<>b.watermark_seq or ceo_archive_prefix(ceo_archive_journal(p_target_estate))<>b.prefix_digest then
   perform ceo_archive_fail('archive_stale'); end if;

  perform ceo_private_archive_validate(p_archive);
  perform ceo_archive_coverage(p_target_estate,p_person_id,p_archive->'conversations',p_archive->'messages');
  v_source:=b.source_estate_id;
  -- Subjects and contexts are the restored prefix's own Projects and questions.
  for x in select value from jsonb_array_elements(p_archive->'conversations') loop
   if x->>'subject_kind'='project' and not exists(select 1 from projects where estate_id=p_target_estate and id=(x->>'subject_id')::uuid) then
    perform ceo_archive_fail('invalid_archive'); end if;
   if x->>'subject_kind'='question' and not exists(select 1 from questions q where q.estate_id=p_target_estate and q.id=(x->>'subject_id')::uuid
     and q.project_id=(x->>'owner_project_id')::uuid) then perform ceo_archive_fail('invalid_archive'); end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_archive->'messages') m where m->'envelope'->'context'->>'mode'='one'
    and not exists(select 1 from projects where estate_id=p_target_estate and id=(m->'envelope'->'context'->>'project_id')::uuid)) then
   perform ceo_archive_fail('invalid_archive'); end if;

  -- Identity locks in migration 64's order, then collisions: refused, never merged or disclosed.
  for v_id in select (value->>'id')::uuid from jsonb_array_elements(p_archive->'conversations') order by 1 loop
   perform pg_advisory_xact_lock(hashtextextended(v_id::text,6064)); end loop;
  for v_id in select (value->>'id')::uuid from jsonb_array_elements(p_archive->'messages') order by 1 loop
   perform pg_advisory_xact_lock(hashtextextended(v_id::text,6164)); end loop;
  if exists(select 1 from jsonb_array_elements(p_archive->'conversations') c where exists(select 1 from ceo_conversations where id=(c->>'id')::uuid)
     or exists(select 1 from ceo_conversations where estate_id=p_target_estate and person_id=p_person_id and subject_kind=c->>'subject_kind' and subject_id=(c->>'subject_id')::uuid))
   or exists(select 1 from jsonb_array_elements(p_archive->'messages') m where exists(select 1 from ceo_messages where id=(m->>'id')::uuid)
     or exists(select 1 from ceo_private_contents where id=(m->>'content_id')::uuid) or exists(select 1 from ceo_pending_requests where id=(m->>'request_id')::uuid))
   or exists(select 1 from jsonb_array_elements(p_archive->'operations') o where exists(select 1 from ceo_operations where estate_id=p_target_estate
     and person_id=p_person_id and operation_id=(o->>'operation_id')::uuid)) then
   perform ceo_archive_fail('unavailable'); end if;

  v_receipt:=jsonb_build_object('ok',true,'operation_id',p_operation_id,'restore_operation_id',p_restore_operation_id,'archive_id',p_archive->>'archive_id',
   'source_estate_id',v_source,'target_estate_id',p_target_estate,'conversations',jsonb_array_length(p_archive->'conversations'),
   'messages',jsonb_array_length(p_archive->'messages'),'operations',jsonb_array_length(p_archive->'operations'),
   'state','history_restored','dispatch','unavailable');
  insert into ceo_private_import_receipts(target_estate_id,person_id,operation_id,restore_operation_id,source_estate_id,archive_id,archive_digest,request_digest,receipt)
   values(p_target_estate,p_person_id,p_operation_id,p_restore_operation_id,v_source,(p_archive->>'archive_id')::uuid,v_digest,v_request,v_receipt);
  insert into ceo_conversations(id,estate_id,person_id,subject_kind,subject_id,owner_project_id,revision,created_seq)
   select (c->>'id')::uuid,p_target_estate,p_person_id,c->>'subject_kind',(c->>'subject_id')::uuid,(c->>'owner_project_id')::uuid,(c->>'revision')::bigint,(c->>'created_seq')::bigint
   from jsonb_array_elements(p_archive->'conversations') c;
  for x in select value from jsonb_array_elements(p_archive->'messages') loop
   v_env:=x->'envelope';v_canonical:=ceo_send_canonical(p_target_estate,p_person_id,v_env);
   v_target_digest:=encode(sha256(convert_to(v_canonical,'UTF8')),'hex');
   insert into ceo_private_contents(id,estate_id,person_id,envelope,canonical_digest) values((x->>'content_id')::uuid,p_target_estate,p_person_id,v_env,v_target_digest);
   insert into ceo_messages(id,estate_id,person_id,conversation_id,ordinal,content_id,request_id,accepted_seq)
    values((x->>'id')::uuid,p_target_estate,p_person_id,(x->>'conversation_id')::uuid,(x->>'ordinal')::bigint,(x->>'content_id')::uuid,(x->>'request_id')::uuid,(x->>'accepted_seq')::bigint);
   insert into ceo_operations(estate_id,person_id,operation_id,kind,intent,receipt) values(p_target_estate,p_person_id,(v_env->>'operation_id')::uuid,'send',v_canonical,
    jsonb_build_object('ok',true,'conversation_id',x->>'conversation_id','operation_id',v_env->>'operation_id','message_id',x->>'id','request_id',x->>'request_id',
     'revision',(x->>'ordinal')::bigint,'receipt_seq',(x->>'accepted_seq')::bigint,'canonical_digest',v_target_digest,'state','accepted_pending','dispatch','unavailable','repeated',false));
   insert into ceo_content_provenance(content_id,target_estate_id,person_id,import_operation_id,source_estate_id,source_digest,origin_estate_id,origin_digest,archive_id,archive_digest)
    values((x->>'content_id')::uuid,p_target_estate,p_person_id,p_operation_id,v_source,x->>'source_digest',(x->'origin'->>'estate_id')::uuid,
     x->'origin'->>'canonical_digest',(p_archive->>'archive_id')::uuid,v_digest);
  end loop;
  insert into ceo_operations(estate_id,person_id,operation_id,kind,intent,receipt)
   select p_target_estate,p_person_id,(o->>'operation_id')::uuid,'open',ceo_frame(o->>'requested_conversation_id')||ceo_frame(o->>'subject_kind')||ceo_frame(o->>'subject_id'),
    jsonb_build_object('ok',true,'conversation_id',o->'receipt'->>'conversation_id','revision',(o->'receipt'->>'revision')::bigint,
     'receipt_seq',(o->'receipt'->>'receipt_seq')::bigint,'repeated',false)
   from jsonb_array_elements(p_archive->'operations') o where o->>'kind'='open';
  return v_receipt||jsonb_build_object('repeated',false);
 exception when check_violation or unique_violation or foreign_key_violation or insufficient_privilege then
  -- Not silence: every write above rolled back with this subtransaction; the refusal is its code.
  return jsonb_build_object('ok',false,'reason_code',case when sqlerrm in
   ('invalid_json','too_large','invalid_archive','integrity_mismatch','unsupported_schema','archive_stale','idempotency_conflict','not_found','unavailable')
   then sqlerrm else 'unavailable' end);
 end;
end $$;

-- A lost import reply is recovered here: the original receipt, never a re-run.
create function ceo_private_import_receipt(p_target_estate uuid,p_person_id uuid,p_revision bigint,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r ceo_private_import_receipts;
begin
 if not ceo_authorized(p_target_estate,p_person_id,p_revision) then return jsonb_build_object('ok',false,'reason_code','unavailable'); end if;
 select * into r from ceo_private_import_receipts where target_estate_id=p_target_estate and person_id=p_person_id and operation_id=p_operation_id;
 if not found then return jsonb_build_object('ok',false,'reason_code','not_found'); end if;
 return r.receipt||jsonb_build_object('repeated',true);
end $$;

revoke all on function ceo_archive_open_intent(text) from public,anon,authenticated,service_role;
revoke all on function ceo_archive_coverage(uuid,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function ceo_private_archive_validate(jsonb) from public,anon,authenticated,service_role;
revoke all on function ceo_export_private_archive(uuid,uuid,bigint,jsonb,text) from public,anon,authenticated;
revoke all on function ceo_import_private_archive(uuid,uuid,bigint,jsonb,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function ceo_private_import_receipt(uuid,uuid,bigint,uuid) from public,anon,authenticated;
grant execute on function ceo_export_private_archive(uuid,uuid,bigint,jsonb,text) to service_role;
grant execute on function ceo_import_private_archive(uuid,uuid,bigint,jsonb,uuid,uuid,jsonb) to service_role;
grant execute on function ceo_private_import_receipt(uuid,uuid,bigint,uuid) to service_role;
