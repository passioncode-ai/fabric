-- Claims: agents coordinate through Fabric before they start (Fabric 0.4.0, wave 2: REQ-38, REQ-08; SCN-140,
-- SCN-141; CONTEXT.md "Claim"). Migration COUNT 83.
--
-- WHAT EXISTED. The contract's coordination claim was already journalled: `work.claimed@1` / `work.renewed@1` /
-- `work.released@1` (migration 16), projected into `leases` by `apply_operating_surfaces` — one row per task, the
-- first in the journal holding it, a takeover only after the holder's expiry by the event's own clock. A lease says
-- WHO holds a task until when, and nothing else: not which coding agent, not how it came in, not how it ended. A
-- released lease is deleted, so "who had this, and how did it end" had no answer outside the journal.
--
-- THE SHAPE. A claim made through `fabric_work_claim` carries a `claim_id` in the same `work.claimed@1`; the lease
-- projector arbitrates exactly as before, and `apply_work_claims` (added below; the dispatcher gains it) runs AFTER
-- it in the same transaction: the claim row is written only when the lease is this owner's once the lease
-- projector has run — so a claim refused as held, or one the lease projector refused for an unresolved run, writes
-- no claim row, on append and on replay alike. A `work.claimed@1` without `claim_id` (the managed launch's own
-- lease, migration 61) projects no claim row, as before. Released claims stay, with how they ended.
--
-- THE SESSION HOOKS (fabric-agent-adapter#53, D4): `session.turn.observed@1` records one turn of an enrolled session —
-- HEAD and counts, never a path or content — journal-only, like `session.ended@1` (migration 48), which the same
-- tool writes at the session's end with `observed_by: hook`. Neither is projected.
--
-- TWO NEW FACTS, each with its own event type:
--   * `task.source.linked@1` — a task linked to a backlog row by (repository, path, id), REQ-08 and plan R-07
--     (link, don't copy): the row's status stays in its owning file; Fabric keeps the address. Projected into
--     `task_sources` by `apply_task_sources`. A link to a task that is not in the event's project refuses the append.
--   * `work.handover.requested@1` — an agent asks for a task another agent holds; the holder's next
--     `fabric_work_list` shows it (SCN-140 alt path). Projected onto the live claim it names.
--
-- Both tables: RLS on, a member read policy, select for `authenticated` and `service_role` (migration 4's shape —
-- P21: a missing grant reads exactly like an empty table), and no API role may write them: the projectors are the
-- only writers (migration 91's rule for `grants`).

-- #region work-claims — docs: docs/ux/scenarios.md#scn-140-agents-ask-fabric-who-is-working-on-what-claim-their-task-are-warned-of-related-work-and-release-it

insert into event_types (type, projects, note) values
  ('task.source.linked@1', true, 'a task is linked to the backlog row it serves, by (repository, path, id): the row keeps its status in its own file and Fabric keeps the address (REQ-08, link don''t copy)'),
  ('work.handover.requested@1', true, 'an agent asks for a task another agent holds; the holder sees the request on its next fabric_work_list and releases with a handover or keeps it'),
  ('session.turn.observed@1', false, 'one turn of an enrolled coding-agent session, from its hooks: the HEAD commit and the counts of files changed and lines added and removed, never a path or content (fabric-agent-adapter session hooks, D4); a journal-only receipt');

-- ── 1 · the tables ──────────────────────────────────────────────────────────────────────────────────────────
create table work_claims (
  id                     uuid primary key,
  estate_id              uuid not null,
  project_id             uuid not null,
  work_id                uuid not null,
  owner_session          uuid not null,
  -- The coding agent (a runner key such as claude-code) or the product, as Fabric knows it; never the caller's word.
  agent                  text,
  came_in                text not null check (came_in in ('launched', 'enrolled', 'handed-off', 'hub', 'unknown')),
  -- What the agent said it will touch: folders, files or patterns, relative to the project's repositories.
  touches                text[] not null default '{}',
  idempotency_key        text not null,
  claimed_at             timestamptz not null,
  expires_at             timestamptz not null,
  renewed_at             timestamptz,
  released_at            timestamptz,
  released_how           text check (released_how in ('done', 'handed-over', 'let-go', 'operator', 'session-ended', 'lapsed')),
  released_by            jsonb,
  handed_to              uuid,
  release_note           text,
  handover_requested_by  uuid,
  handover_requested_at  timestamptz,
  handover_note          text,
  claimed_seq            bigint not null,
  released_seq           bigint,
  check ((released_at is null) = (released_how is null)),
  -- A claim names a task of its own estate (migration 42's composite identity), never another estate's.
  foreign key (estate_id, work_id) references project_tasks (estate_id, id)
);
-- One live claim per task, whoever holds it: the lease decides who; this keeps the account single.
create unique index work_claims_one_live on work_claims (estate_id, work_id) where released_at is null;
create unique index work_claims_key on work_claims (estate_id, idempotency_key);
create index work_claims_project_live on work_claims (project_id) where released_at is null;
create index work_claims_owner on work_claims (owner_session);

create table task_sources (
  task_id     uuid primary key,
  estate_id   uuid not null,
  project_id  uuid not null,
  -- As the agent named it (a remote URL, owner/name, or a repository folder) — and the project's folder it resolved to.
  repository  text not null,
  repo_path   text not null,
  path        text not null,
  row_id      text not null,
  linked_at   timestamptz not null,
  linked_by   jsonb not null,
  linked_seq  bigint not null,
  foreign key (estate_id, task_id) references project_tasks (estate_id, id)
);
create index task_sources_row on task_sources (estate_id, repo_path, path, row_id);
create index task_sources_project on task_sources (project_id);

alter table work_claims enable row level security;
alter table task_sources enable row level security;
create policy member_work_claims_read on work_claims for select to authenticated
  using (estate_id in (select member_estates()));
create policy member_task_sources_read on task_sources for select to authenticated
  using (estate_id in (select member_estates()));
grant select on work_claims, task_sources to authenticated, service_role;
revoke insert, update, delete, truncate on work_claims, task_sources from anon, authenticated, service_role;
comment on table work_claims is
  'Who said they work on which task, how they came in, what they touch and how it ended. A projection of work.claimed@1 (with claim_id) / work.renewed@1 / work.released@1 / work.handover.requested@1 (apply_work_claims); no API role writes it.';
comment on table task_sources is
  'The backlog row a task serves, by (repository, path, id): an address, never a copy of the row. A projection of task.source.linked@1 (apply_task_sources).';

-- ── 2 · the projectors ──────────────────────────────────────────────────────────────────────────────────────
create or replace function apply_work_claims(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_id    uuid;
  v_work  uuid;
  v_owner uuid;
  l       leases;
begin
  if e.type not in ('work.claimed@1', 'work.renewed@1', 'work.released@1', 'work.handover.requested@1') then
    return;
  end if;
  v_work  := identity_uuid(e.payload->>'work');
  v_owner := identity_uuid(e.payload->>'owner');
  case e.type
    when 'work.claimed@1' then
      if e.payload->>'claim_id' is null then
        return;   -- a lease without a claim: the managed launch's own (migration 61), or one from before this migration
      end if;
      v_id := identity_uuid(e.payload->>'claim_id');
      if v_id is null or v_id::text <> e.payload->>'claim_id' then
        raise exception 'work.claimed@1 names claim %, which is not a canonical uuid', e.payload->>'claim_id'
          using errcode = 'check_violation';
      end if;
      -- The lease projector ran first, in this transaction: the claim stands only where the lease is now this
      -- owner's and live at the event's own time. Held by another, or refused for an unresolved run → no row.
      select * into l from leases where work_id = v_work and estate_id = e.estate_id;
      if l.work_id is null or l.owner_session is distinct from v_owner or l.expires_at <= e.occurred_at then
        return;
      end if;
      -- A live claim the lease no longer backs (it lapsed and another owner took the task) ends here, as lapsed.
      update work_claims
         set released_at = e.occurred_at, released_how = 'lapsed', released_seq = e.seq,
             released_by = jsonb_build_object('kind', 'system', 'id', 'work-claims')
       where estate_id = e.estate_id and work_id = v_work and released_at is null and owner_session <> v_owner;
      insert into work_claims (id, estate_id, project_id, work_id, owner_session, agent, came_in, touches,
                               idempotency_key, claimed_at, expires_at, claimed_seq)
      values (v_id, e.estate_id, l.project_id, v_work, v_owner, e.payload->>'agent',
              coalesce(e.payload->>'came_in', 'unknown'),
              coalesce(array(select jsonb_array_elements_text(e.payload->'write_scopes')), '{}'),
              e.payload->>'idempotency_key', e.occurred_at, l.expires_at, e.seq)
      on conflict do nothing;
      if exists (select 1 from work_claims where id = v_id and estate_id <> e.estate_id) then
        raise exception 'claim % already exists in another estate', v_id using errcode = 'check_violation';
      end if;
    when 'work.renewed@1' then
      update work_claims c
         set expires_at = coalesce((select expires_at from leases
                                     where work_id = v_work and estate_id = e.estate_id and owner_session = v_owner),
                                   c.expires_at),
             renewed_at = e.occurred_at
       where c.estate_id = e.estate_id and c.work_id = v_work and c.owner_session = v_owner and c.released_at is null;
    when 'work.released@1' then
      update work_claims
         set released_at = e.occurred_at,
             released_how = coalesce(e.payload->>'how',
                                     case e.payload->>'outcome' when 'succeeded' then 'done' else 'let-go' end),
             released_by = e.actor,
             handed_to = identity_uuid(e.payload->>'handed_to'),
             release_note = e.payload->>'note',
             released_seq = e.seq
       where estate_id = e.estate_id and work_id = v_work and owner_session = v_owner and released_at is null;
    when 'work.handover.requested@1' then
      update work_claims
         set handover_requested_by = identity_uuid(e.payload->>'requested_by'),
             handover_requested_at = e.occurred_at,
             handover_note = e.payload->>'note'
       where estate_id = e.estate_id and id = identity_uuid(e.payload->>'claim_id') and released_at is null;
  end case;
end $$;
revoke execute on function apply_work_claims(journal) from public, anon, authenticated, service_role;

create or replace function apply_task_sources(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_task uuid;
begin
  if e.type <> 'task.source.linked@1' then
    return;
  end if;
  v_task := identity_uuid(e.payload->>'task_id');
  if not exists (select 1 from project_tasks t where t.id = v_task and t.estate_id = e.estate_id
                    and t.project_id is not distinct from e.project_id) then
    raise exception 'task.source.linked@1 names task %, which is not a task of this project', e.payload->>'task_id'
      using errcode = 'check_violation';
  end if;
  -- A task serves one backlog row; linking it again moves the link (the event carries the whole address).
  insert into task_sources (task_id, estate_id, project_id, repository, repo_path, path, row_id, linked_at, linked_by, linked_seq)
  values (v_task, e.estate_id, e.project_id, e.payload->>'repository', e.payload->>'repo_path', e.payload->>'path',
          e.payload->>'row_id', e.occurred_at, e.actor, e.seq)
  on conflict (task_id) do update
    set repository = excluded.repository, repo_path = excluded.repo_path, path = excluded.path,
        row_id = excluded.row_id, linked_at = excluded.linked_at, linked_by = excluded.linked_by,
        linked_seq = excluded.linked_seq
    where task_sources.estate_id = e.estate_id;
end $$;
revoke execute on function apply_task_sources(journal) from public, anon, authenticated, service_role;

-- The dispatcher gains TWO lines (migration 91's list, plus apply_task_sources and apply_work_claims). Both run
-- after apply_operating_surfaces: a claim reads the lease that projector has just written.
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
  perform apply_grants(e);
  perform apply_effect_lifecycle(e);
  perform apply_heartbeats(e);
  perform apply_deliveries(e);
  perform apply_task_runs(e);
  perform apply_transcript_capture(e);
  perform apply_ceo_receipt(e);
  perform apply_releases(e);
  perform apply_hub_access(e);
  perform apply_comms(e);
  perform apply_task_sources(e);
  perform apply_work_claims(e);
end;
$$;
revoke execute on function apply_projections(journal) from public, anon, authenticated, service_role;

-- #endregion work-claims

-- ── schema 83 as a private-archive source ─────────────────────────────────────────────────────────────────────
-- ADR-0079 decision 5, as every step since 67 did: an archive exported at this schema imports. Migration 91's
-- canonical body with 83 added; nothing else changes (the export reads schema_version() and is not redefined).
-- #region private-archive-source-schema — docs: docs/adr/0079-private-conversation-archives-preserve-history-not-authority.md#decision
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb,'71'::jsonb,'72'::jsonb,'73'::jsonb,'74'::jsonb,'75'::jsonb,'76'::jsonb,'77'::jsonb,'78'::jsonb,'79'::jsonb,'80'::jsonb,'81'::jsonb,'82'::jsonb,'83'::jsonb,'84'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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
