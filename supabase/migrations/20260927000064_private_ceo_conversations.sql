-- ADR-0075 / CW-N1a. Protected primary content, opaque journal references.
-- No worker, activation, private backup, UI or universal secret detector here.
-- service_role is a trusted host: principal is derived upstream, never by agent input.
create table ceo_conversations (
 id uuid primary key, estate_id uuid not null, person_id uuid not null,
 subject_kind text not null check(subject_kind in ('global','project','question')),
 subject_id uuid not null, owner_project_id uuid, revision bigint not null default 0 check(revision between 0 and 9007199254740991),
 created_seq bigint not null default 0 check(created_seq between 0 and 9007199254740991),
 unique(estate_id,person_id,subject_kind,subject_id),
 unique(id,estate_id,person_id)
);
create table ceo_private_contents (
 id uuid primary key, estate_id uuid not null, person_id uuid not null,
 envelope jsonb not null, canonical_digest text not null
);
create table ceo_messages (
 id uuid primary key, estate_id uuid not null, person_id uuid not null,
 conversation_id uuid not null,
 ordinal bigint not null check(ordinal between 1 and 9007199254740991), content_id uuid not null, request_id uuid not null,
 accepted_seq bigint not null check(accepted_seq between 1 and 9007199254740991), unique(conversation_id,ordinal),
 foreign key(conversation_id,estate_id,person_id) references ceo_conversations(id,estate_id,person_id)
);
create table ceo_operations (
 estate_id uuid not null, person_id uuid not null, operation_id uuid not null,
 kind text not null, intent text not null, receipt jsonb not null,
 primary key(estate_id,person_id,operation_id)
);
create table ceo_pending_requests (
 id uuid primary key, estate_id uuid not null, person_id uuid not null,
 conversation_id uuid not null, message_id uuid not null unique,
 state text not null default 'pending_unavailable' check(state='pending_unavailable')
);
-- Only this table is a projection. No ownership/content/dispatch is reconstructed.
create table ceo_receipt_refs (
 estate_id uuid not null, seq bigint not null, type text not null, payload jsonb not null,
 primary key(estate_id,seq)
);
create table ceo_write_authorizations (
 transaction_id bigint not null, estate_id uuid not null, type text not null,
 actor jsonb not null, payload jsonb not null, primary key(transaction_id,estate_id)
);
alter table ceo_conversations enable row level security;
revoke all on ceo_conversations from public,anon,authenticated,service_role;
alter table ceo_private_contents enable row level security;
revoke all on ceo_private_contents from public,anon,authenticated,service_role;
alter table ceo_messages enable row level security;
revoke all on ceo_messages from public,anon,authenticated,service_role;
alter table ceo_operations enable row level security;
revoke all on ceo_operations from public,anon,authenticated,service_role;
alter table ceo_pending_requests enable row level security;
revoke all on ceo_pending_requests from public,anon,authenticated,service_role;
alter table ceo_receipt_refs enable row level security;
revoke all on ceo_receipt_refs from public,anon,authenticated,service_role;
alter table ceo_write_authorizations enable row level security;
revoke all on ceo_write_authorizations from public,anon,authenticated,service_role;

-- Primary body/message/operation rows are immutable even through an accidental
-- definer update. Future retention must be a separately authorized tombstone path.
create function ceo_primary_immutable() returns trigger language plpgsql set search_path=public as $$
begin raise exception 'CEO primary record is immutable' using errcode='insufficient_privilege'; end $$;
create trigger ceo_content_immutable before update or delete on ceo_private_contents for each row execute function ceo_primary_immutable();
create trigger ceo_message_immutable before update or delete on ceo_messages for each row execute function ceo_primary_immutable();
create trigger ceo_operation_immutable before update or delete on ceo_operations for each row execute function ceo_primary_immutable();

create function ceo_uuid(v jsonb) returns boolean language sql immutable set search_path=public as $$
 select coalesce(jsonb_typeof(v)='string' and v#>>'{}' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',false)
$$;
create function ceo_integer(v jsonb) returns boolean language plpgsql immutable set search_path=public as $$
declare n numeric; begin
 if jsonb_typeof(v) is distinct from 'number' then return false; end if;
 n:=(v#>>'{}')::numeric; return n=trunc(n) and n between 0 and 9007199254740991;
end $$;
-- Compact decoded JSON byte size (JSON.stringify-compatible on this closed
-- schema), not PostgreSQL jsonb pretty spacing or raw transport whitespace.
create function ceo_json_bytes(v jsonb) returns bigint language plpgsql immutable set search_path=public as $$
declare total bigint; k text; x jsonb; n bigint:=0;
begin
 case jsonb_typeof(v)
 when 'object' then
  total:=2;
  for k,x in select key,value from jsonb_each(v) loop total:=total+octet_length(to_json(k)::text)+1+ceo_json_bytes(x);n:=n+1;end loop;
  return total+greatest(n-1,0);
 when 'number' then return length(((v#>>'{}')::numeric)::bigint::text);
 else return octet_length(v::text);
 end case;
end $$;
create function ceo_send_error(p jsonb) returns text language plpgsql immutable set search_path=public as $$
declare c jsonb; k text;
begin
 if p is null or jsonb_typeof(p)<>'object' then return 'invalid_input'; end if;
 if octet_length(p::text)>262144 then return 'too_large'; end if;
 if (select count(*) from jsonb_object_keys(p))<>10 or not p ?& array['schema','operation_id','conversation_id','message_id','expected_revision','subject_revision','input_channel','text','preparation_version','context'] then return 'invalid_input'; end if;
 if p->>'schema' is distinct from 'CeoSend@1' or p->>'input_channel' is distinct from 'text' or p->>'preparation_version' is distinct from 'har06-ceo-v1' then return 'invalid_input'; end if;
 foreach k in array array['operation_id','conversation_id','message_id'] loop if not ceo_uuid(p->k) then return 'invalid_input'; end if; end loop;
 if not ceo_integer(p->'expected_revision') or not ceo_integer(p->'subject_revision') or jsonb_typeof(p->'text') is distinct from 'string' then return 'invalid_input'; end if;
 if octet_length(p->>'text')>32768 then return 'too_large'; end if;
 if translate(p->>'text',E' \t\n\r\f'||chr(11)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279),'')='' then return 'invalid_input'; end if;
 c:=p->'context';
 if jsonb_typeof(c) is distinct from 'object' then return 'invalid_input'; end if;
 if (select count(*) from jsonb_object_keys(c))<>6 or not c ?& array['schema','mode','selection_revision','project_id','project_revision','estate_seq'] then return 'invalid_input'; end if;
 if c->>'schema' is distinct from 'CeoContext@1' or not ceo_integer(c->'selection_revision') or not ceo_integer(c->'estate_seq') then return 'invalid_input'; end if;
 if c->>'mode' is null or c->>'mode' not in ('none','one') then return 'unsupported_context'; end if;
 if c->>'mode'='none' then
  if c->'project_id' is distinct from 'null'::jsonb or c->'project_revision' is distinct from 'null'::jsonb then return 'invalid_input'; end if;
 elsif not ceo_uuid(c->'project_id') or not ceo_integer(c->'project_revision') then return 'invalid_input'; end if;
 if ceo_json_bytes(p)>65536 then return 'too_large'; end if;
 return null;
end $$;
create function ceo_frame(v text) returns text language sql immutable set search_path=public as $$
 select case when v is null then '-1:' else octet_length(v)::text||':'||v end
$$;
create function ceo_send_canonical(e uuid,u uuid,p jsonb) returns text language plpgsql immutable set search_path=public as $$
declare c jsonb:=p->'context'; vals text[]; v text; result text:='';
begin
 if e is null or u is null or ceo_send_error(p) is not null then raise exception 'Invalid CEO canonical input' using errcode='check_violation'; end if;
 vals:=array['CeoSend@1',e::text,u::text,p->>'operation_id',p->>'conversation_id',p->>'message_id',
  ((p->>'expected_revision')::numeric)::bigint::text,((p->>'subject_revision')::numeric)::bigint::text,
  'text',p->>'text','har06-ceo-v1','CeoContext@1',c->>'mode',((c->>'selection_revision')::numeric)::bigint::text,
  c->>'project_id',((c->>'project_revision')::numeric)::bigint::text,((c->>'estate_seq')::numeric)::bigint::text];
 foreach v in array vals loop result:=result||ceo_frame(v); end loop;
 return result;
end $$;
create function ceo_authorized(e uuid,u uuid,r bigint) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if e is null or u is null or r is null or r<1 or r>9007199254740991 then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended(e::text,4242));
 perform 1 from memberships where estate_id=e and person_id=u and revision=r for share;
 return found;
end $$;
create function ceo_actor_valid(a jsonb,u uuid) returns boolean language sql immutable set search_path=public as $$
 select coalesce(a=jsonb_build_object('kind','person','id',u::text) or
  (u='00000000-0000-0000-0000-00000000000a'::uuid and a=jsonb_build_object('kind','person','id','operator')),false)
$$;
-- Subject authorization is existing Estate membership, NOT invented Project ACL.
-- Config revision represents configuration only, not all Project history.
create function ceo_subject(e uuid,k text,i uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare p projects; q questions;
begin
 if k='global' then return jsonb_build_object('revision',0,'project_id',null,'active',true); end if;
 if k='question' then
  select * into q from questions where estate_id=e and id=i for share;
  if not found then return null; end if;
  select * into p from projects where estate_id=e and id=q.project_id for share;
  if not found then return null; end if;
  return jsonb_build_object('revision',q.revision,'project_id',p.id,'active',p.status='active','status',q.status);
 elsif k='project' then
  select * into p from projects where estate_id=e and id=i for share;
  if not found then return null; end if;
  return jsonb_build_object('revision',p.config_revision,'project_id',p.id,'active',p.status='active','status',p.status);
 end if;
 return null;
end $$;
insert into event_types(type,projects,note) values
 ('ceo.conversation.opened@1',true,'Opaque private conversation receipt; no owner, subject or content in payload'),
 ('ceo.message.accepted@1',true,'Opaque saved-message receipt; never dispatch or provider delivery proof');

create function apply_ceo_receipt(e journal) returns void language plpgsql security definer set search_path=public as $$
declare keys text[]; k text; prior ceo_receipt_refs;
begin
 if e.type not in ('ceo.conversation.opened@1','ceo.message.accepted@1') then return; end if;
 keys:=case when e.type='ceo.conversation.opened@1' then array['conversation_id','operation_id'] else array['conversation_id','operation_id','message_id','request_id','content_id'] end;
 if e.seq is null or e.seq not between 1 and 9007199254740991 or e.schema_rev is distinct from '1' or e.project_id is not null or e.run_id is not null or e.node_id is not null
  or jsonb_typeof(e.payload) is distinct from 'object' or jsonb_typeof(e.actor) is distinct from 'object' then
  raise exception 'Invalid CEO receipt' using errcode='check_violation'; end if;
 if (select count(*) from jsonb_object_keys(e.payload))<>cardinality(keys) or not e.payload ?& keys
  or (select count(*) from jsonb_object_keys(e.actor))<>2 or e.actor->>'kind' is distinct from 'person'
  or not coalesce(ceo_uuid(e.actor->'id') or e.actor->'id'='"operator"'::jsonb,false) then
  raise exception 'Invalid CEO receipt' using errcode='check_violation'; end if;
 foreach k in array keys loop if not ceo_uuid(e.payload->k) then raise exception 'Invalid CEO receipt' using errcode='check_violation'; end if; end loop;
 select * into prior from ceo_receipt_refs where estate_id=e.estate_id and seq=e.seq;
 if found and (prior.type<>e.type or prior.payload<>e.payload) then raise exception 'Conflicting CEO receipt' using errcode='check_violation'; end if;
 insert into ceo_receipt_refs values(e.estate_id,e.seq,e.type,e.payload) on conflict do nothing;
 -- Deliberately no primary-content, conversation, operation or request writes.
end $$;
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
  perform apply_priority(e);
  perform apply_effect_lifecycle(e);
  perform apply_heartbeats(e);
  perform apply_deliveries(e);
  perform apply_task_runs(e);
  perform apply_transcript_capture(e);
  perform apply_ceo_receipt(e);
end;
$$;

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
security definer set search_path = public
as $$
declare
  v_seq bigint;
  v_event journal;
begin
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
  select coalesce(max(seq), 0) + 1 into v_seq from journal where estate_id = p_estate_id;
  insert into journal (estate_id, seq, type, schema_rev, actor, project_id, run_id, node_id, payload)
  values (p_estate_id, v_seq, p_type, p_schema_rev, p_actor, p_project_id, p_run_id, p_node_id, p_payload)
  returning * into v_event;
  perform apply_projections(v_event);
  return v_event;
end $$;

create function ceo_has_capacity(e uuid) returns boolean language sql stable security definer set search_path=public as $$
 select coalesce(max(seq),0)<9007199254740991 from journal where estate_id=e
$$;
create function ceo_append(e uuid,t text,a jsonb,p jsonb) returns journal language plpgsql security definer set search_path=public as $$
declare j journal;
begin
 if not ceo_has_capacity(e) then raise exception 'CEO receipt capacity exceeded' using errcode='check_violation'; end if;
 insert into ceo_write_authorizations values(txid_current(),e,t,a,p);
 select * into j from append_event(e,t,a,p,'1');
 delete from ceo_write_authorizations where transaction_id=txid_current() and estate_id=e;
 return j;
end $$;
create function ceo_open_conversation(p_estate_id uuid,p_person_id uuid,p_revision bigint,p_actor jsonb,
 p_operation_id uuid,p_conversation_id uuid,p_subject_kind text,p_subject_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c ceo_conversations; o ceo_operations; intent text; subject jsonb; j journal; result jsonb;
begin
 if not ceo_authorized(p_estate_id,p_person_id,p_revision) or not ceo_actor_valid(p_actor,p_person_id) then
  return jsonb_build_object('ok',false,'reason_code','unavailable'); end if;
 if p_operation_id is null or p_conversation_id is null or p_subject_id is null or p_subject_kind is null
  or p_subject_kind not in ('global','project','question') or (p_subject_kind='global' and p_subject_id<>p_conversation_id) then
  return jsonb_build_object('ok',false,'reason_code','invalid_input'); end if;
 intent:=ceo_frame(p_conversation_id::text)||ceo_frame(p_subject_kind)||ceo_frame(p_subject_id::text);
 select * into o from ceo_operations where estate_id=p_estate_id and person_id=p_person_id and operation_id=p_operation_id;
 if found then
  if o.kind<>'open' or o.intent<>intent then return jsonb_build_object('ok',false,'reason_code','idempotency_conflict'); end if;
  return o.receipt||jsonb_build_object('repeated',true);
 end if;
 select * into c from ceo_conversations where estate_id=p_estate_id and person_id=p_person_id and subject_kind=p_subject_kind and subject_id=p_subject_id;
 if not found then
  subject:=ceo_subject(p_estate_id,p_subject_kind,p_subject_id);
  if subject is null or subject->'active'<>'true'::jsonb then return jsonb_build_object('ok',false,'reason_code','unavailable'); end if;
  -- All Estates take this identity lock after the Estate lock; simultaneous reuse
  -- cannot race a unique violation or reveal another private conversation.
  perform pg_advisory_xact_lock(hashtextextended(p_conversation_id::text,6064));
  if exists(select 1 from ceo_conversations where id=p_conversation_id) then return jsonb_build_object('ok',false,'reason_code','unavailable'); end if;
  if not ceo_has_capacity(p_estate_id) then return jsonb_build_object('ok',false,'reason_code','capacity_exceeded'); end if;
  insert into ceo_conversations(id,estate_id,person_id,subject_kind,subject_id,owner_project_id)
   values(p_conversation_id,p_estate_id,p_person_id,p_subject_kind,p_subject_id,(subject->>'project_id')::uuid) returning * into c;
  select * into j from ceo_append(p_estate_id,'ceo.conversation.opened@1',p_actor,jsonb_build_object('conversation_id',c.id,'operation_id',p_operation_id));
  update ceo_conversations set created_seq=j.seq where id=c.id;
  c.created_seq:=j.seq;
 end if;
 result:=jsonb_build_object('ok',true,'conversation_id',c.id,'revision',c.revision,'receipt_seq',c.created_seq,'repeated',false);
 insert into ceo_operations values(p_estate_id,p_person_id,p_operation_id,'open',intent,result);
 return result;
end $$;

create function ceo_send_message(p_estate_id uuid,p_person_id uuid,p_revision bigint,p_actor jsonb,p_envelope jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c ceo_conversations; o ceo_operations; subject jsonb; ctx jsonb; selected projects;
 reason text; canonical text; digest text; op uuid; mid uuid; cid uuid; content uuid; request uuid; j journal; result jsonb;
begin
 if not ceo_authorized(p_estate_id,p_person_id,p_revision) or not ceo_actor_valid(p_actor,p_person_id) then
  return jsonb_build_object('ok',false,'reason_code','unavailable'); end if;
 reason:=ceo_send_error(p_envelope);
 if reason is not null then return jsonb_build_object('ok',false,'reason_code',reason); end if;
 op:=(p_envelope->>'operation_id')::uuid; mid:=(p_envelope->>'message_id')::uuid; cid:=(p_envelope->>'conversation_id')::uuid;
 select * into c from ceo_conversations where id=cid and estate_id=p_estate_id and person_id=p_person_id for update;
 if not found then return jsonb_build_object('ok',false,'reason_code','unavailable'); end if;
 canonical:=ceo_send_canonical(p_estate_id,p_person_id,p_envelope);
 digest:=encode(sha256(convert_to(canonical,'UTF8')),'hex');
 select * into o from ceo_operations where estate_id=p_estate_id and person_id=p_person_id and operation_id=op;
 if found then
  if o.kind<>'send' or o.intent<>canonical then return jsonb_build_object('ok',false,'reason_code','idempotency_conflict'); end if;
  return o.receipt||jsonb_build_object('repeated',true);
 end if;
 if c.revision>=9007199254740991 then return jsonb_build_object('ok',false,'reason_code','capacity_exceeded'); end if;
 if c.revision<>(p_envelope->>'expected_revision')::numeric then return jsonb_build_object('ok',false,'reason_code','stale_revision'); end if;
 subject:=ceo_subject(p_estate_id,c.subject_kind,c.subject_id);
 if subject is null or subject->'active'<>'true'::jsonb then return jsonb_build_object('ok',false,'reason_code','unavailable'); end if;
 if subject->'revision'<>p_envelope->'subject_revision' then return jsonb_build_object('ok',false,'reason_code','stale_revision'); end if;
 ctx:=p_envelope->'context';
 if (ctx->>'estate_seq')::numeric>(select coalesce(max(seq),0) from journal where estate_id=p_estate_id) then return jsonb_build_object('ok',false,'reason_code','invalid_boundary'); end if;
 if ctx->>'mode'='one' then
  select * into selected from projects where estate_id=p_estate_id and id=(ctx->>'project_id')::uuid and status='active' for share;
  if not found then return jsonb_build_object('ok',false,'reason_code','unavailable'); end if;
  if selected.config_revision<>(ctx->>'project_revision')::numeric then return jsonb_build_object('ok',false,'reason_code','stale_revision'); end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(mid::text,6164));
 if exists(select 1 from ceo_messages where id=mid) then return jsonb_build_object('ok',false,'reason_code','identity_conflict'); end if;
 if not ceo_has_capacity(p_estate_id) then return jsonb_build_object('ok',false,'reason_code','capacity_exceeded'); end if;
 content:=gen_random_uuid();request:=gen_random_uuid();
 insert into ceo_private_contents values(content,p_estate_id,p_person_id,p_envelope,digest);
 select * into j from ceo_append(p_estate_id,'ceo.message.accepted@1',p_actor,jsonb_build_object('conversation_id',cid,
  'operation_id',op,'message_id',mid,'request_id',request,'content_id',content));
 insert into ceo_messages values(mid,p_estate_id,p_person_id,cid,c.revision+1,content,request,j.seq);
 insert into ceo_pending_requests(id,estate_id,person_id,conversation_id,message_id) values(request,p_estate_id,p_person_id,cid,mid);
 update ceo_conversations set revision=c.revision+1 where id=cid;
 result:=jsonb_build_object('ok',true,'conversation_id',cid,'operation_id',op,'message_id',mid,'request_id',request,
  'revision',c.revision+1,'receipt_seq',j.seq,'canonical_digest',digest,'state','accepted_pending','dispatch','unavailable','repeated',false);
 insert into ceo_operations values(p_estate_id,p_person_id,op,'send',canonical,result);
 return result;
end $$;

create function ceo_read_conversation(p_estate_id uuid,p_person_id uuid,p_revision bigint,p_conversation_id uuid,
 p_after_ordinal bigint default 0,p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c ceo_conversations; items jsonb; subject jsonb; next_ordinal bigint; more boolean;
begin
 if not ceo_authorized(p_estate_id,p_person_id,p_revision) then return jsonb_build_object('ok',false,'reason_code','unavailable'); end if;
 if p_after_ordinal is null or p_after_ordinal<0 or p_after_ordinal>9007199254740991 or p_limit is null or p_limit not between 1 and 50 then
  return jsonb_build_object('ok',false,'reason_code','invalid_input'); end if;
 select * into c from ceo_conversations where id=p_conversation_id and estate_id=p_estate_id and person_id=p_person_id;
 if not found then return jsonb_build_object('ok',false,'reason_code','unavailable','content_state','unavailable'); end if;
 subject:=ceo_subject(p_estate_id,c.subject_kind,c.subject_id);
 select coalesce(jsonb_agg(x.item order by x.ordinal),'[]'::jsonb),max(x.ordinal) into items,next_ordinal from (
  select m.ordinal,jsonb_build_object('message_id',m.id,'ordinal',m.ordinal,'request_id',m.request_id,'receipt_seq',m.accepted_seq,
    'content_state',case when b.id is null then 'unavailable' else 'available' end,
    'envelope',b.envelope,'canonical_digest',b.canonical_digest,'dispatch','unavailable') as item
   from ceo_messages m left join ceo_private_contents b on b.id=m.content_id and b.estate_id=p_estate_id and b.person_id=p_person_id
   where m.conversation_id=c.id and m.estate_id=p_estate_id and m.person_id=p_person_id and m.ordinal>p_after_ordinal
   order by m.ordinal limit p_limit
 ) x;
 select exists(select 1 from ceo_messages where conversation_id=c.id and ordinal>coalesce(next_ordinal,p_after_ordinal)) into more;
 return jsonb_build_object('ok',true,'conversation_id',c.id,'revision',c.revision,'subject',jsonb_build_object('kind',c.subject_kind,'id',c.subject_id,
  'owner_project_id',c.owner_project_id,'current',subject),'messages',items,'next_ordinal',case when more then next_ordinal else null end);
end $$;

create function ceo_send_receipt(p_estate_id uuid,p_person_id uuid,p_revision bigint,p_conversation_id uuid,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o ceo_operations;
begin
 if not ceo_authorized(p_estate_id,p_person_id,p_revision) or not exists(select 1 from ceo_conversations where
  id=p_conversation_id and estate_id=p_estate_id and person_id=p_person_id) then
  return jsonb_build_object('ok',false,'reason_code','unavailable'); end if;
 select * into o from ceo_operations where estate_id=p_estate_id and person_id=p_person_id and operation_id=p_operation_id and kind='send'
  and receipt->>'conversation_id'=p_conversation_id::text;
 if not found then return jsonb_build_object('ok',false,'reason_code','not_found'); end if;
 return o.receipt||jsonb_build_object('repeated',true);
end $$;

-- No generic table access, no exposed authorizer/projector/canonicalizer.
revoke all on function ceo_primary_immutable() from public,anon,authenticated,service_role;
revoke all on function ceo_uuid(jsonb) from public,anon,authenticated,service_role;
revoke all on function ceo_integer(jsonb) from public,anon,authenticated,service_role;
revoke all on function ceo_send_error(jsonb) from public,anon,authenticated,service_role;
revoke all on function ceo_frame(text) from public,anon,authenticated,service_role;
revoke all on function ceo_send_canonical(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function ceo_authorized(uuid,uuid,bigint) from public,anon,authenticated,service_role;
revoke all on function ceo_actor_valid(jsonb,uuid) from public,anon,authenticated,service_role;
revoke all on function ceo_subject(uuid,text,uuid) from public,anon,authenticated,service_role;
revoke all on function apply_ceo_receipt(journal) from public,anon,authenticated,service_role;
revoke all on function ceo_append(uuid,text,jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function ceo_open_conversation(uuid,uuid,bigint,jsonb,uuid,uuid,text,uuid) from public,anon,authenticated,service_role;
revoke all on function ceo_send_message(uuid,uuid,bigint,jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function ceo_read_conversation(uuid,uuid,bigint,uuid,bigint,integer) from public,anon,authenticated,service_role;
revoke all on function ceo_send_receipt(uuid,uuid,bigint,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function ceo_open_conversation(uuid,uuid,bigint,jsonb,uuid,uuid,text,uuid) to service_role;
grant execute on function ceo_send_message(uuid,uuid,bigint,jsonb,jsonb) to service_role;
grant execute on function ceo_read_conversation(uuid,uuid,bigint,uuid,bigint,integer) to service_role;
grant execute on function ceo_send_receipt(uuid,uuid,bigint,uuid,uuid) to service_role;
revoke all on function ceo_json_bytes(jsonb) from public,anon,authenticated,service_role;
revoke all on function ceo_has_capacity(uuid) from public,anon,authenticated,service_role;
