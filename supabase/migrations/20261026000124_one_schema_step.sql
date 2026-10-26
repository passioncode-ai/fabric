-- 97 (by count; suffix 124): Fabric 0.3.13's one schema step
-- (docs/evidence/plans/2026-10-26-release-0313-plan.md, Composition row "One schema step"; the rows' decided shapes in
-- docs/evidence/plans/2026-10-23-release-0312-triage.md and docs/evidence/specs/2026-08-16-software-fabric-carryover.md).
--
-- NUMBERS. `schema_version()` counts applied migrations, so this file makes the schema 97. The task pipeline's prose
-- reservation held 124 and 125 unexecuted (`docs/evidence/plans/task-pipeline-persistence-contract.md`); this file takes
-- 124, the next free number, and by that document's collision rule the reservation moves to 125 and 126.
--
-- WHAT THIS CHANGES, row by row (each a function ADDED to the dispatcher, or a `create or replace` of the latest body of
-- a function an earlier migration owns, same signature, so its grants stand):
--   * CO-340, CO-358: a folder is held by one row of an estate. The attach arm of `apply_estate_and_projects` removes a
--     rebuild's later row for the same path (its own attach puts it back in order) and ignores an attach of a path
--     another live row holds (the first attach keeps it), so a rebuild and a restore replay without raising.
--   * CO-341: duplicate (estate, path) rows an older build left are merged (the first attached kept, the primary and
--     the project's folder recomputed), then the unique index is created, so an upgraded database equals a fresh one.
--     `kind` follows `is_primary` after every attach and detach (`apply_project_repo_kind`), and existing rows are set.
--   * CO-355: a withdrawn answer closes its decision's whole supersession chain, so a Memory correction made before the
--     withdrawal stops reaching agents (`apply_withdrawn_answer_chain`); history is replayed through it once.
--   * CO-357: an answer whose event names no resolution takes it from `question_resolutions` by its decision
--     (`apply_question_resolution`), so a rebuild after a withdrawal and a re-answer keeps `resolution_id`.
--   * CO-398: an index for the finished-tasks read (`project_tasks` done, newest move first).
--   * CO-370: `board_list` and `board_get` test `participants @> array[reader]` (the GIN index serves it); each Project's
--     epochs age out at 30 days plus up to 10, fixed per Project, so the epochs opened in one week do not close in one
--     burst; a reply is delivered to the sender of the message it answers, not to every participant
--     (`apply_comms_reply_delivery`, and a restore's backfill).
--   * CO-373: the three waiting checks (`board_responder_possible`, `board_pending_operator`, `board_waiting_operator`)
--     share one test, `board_responder_live`: a holder whose lease has not lapsed, or a live board.respond grant. The
--     other half, a lapsed claim's task back to the backlog, is the sweep's (SW-8, `main/abandonedSweepRun.ts`).
--   * CO-307: `project_activity`, each project's newest journal event, read through an index, for the home's «Тихо уже».
--   * CO-418: `journal (estate_id, project_id, seq)` for the project analytics' moves (DA-4); `project_relations` is
--     written by its projector only (DA-7); a person's business is the person's in the projector too (W2-4), with
--     `business_set_by`; the owner's membership, a delivery and a run carry the event's time, not the write's (i3 DA-2);
--     the board's three refusals no longer tell an agent a request "stays queued" (DO-18).
--   * SW-7 (CO-427): `work.swept@1`, the sweep of abandoned work's receipt: one per sweep that found something.
--   * Schema 97 as a private-archive source (ADR-0079 decision 5).

-- #region one-folder-one-row — docs: docs/evidence/plans/2026-10-26-release-0313-plan.md#the-one-schema-step-2026-10-26-on-agent0313-schema
-- Migration 70's `apply_estate_and_projects`, every arm carried; changed: the attach arm (above) and the owner's
-- membership written with the event's time.
create or replace function apply_estate_and_projects(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_next_primary uuid;
  v_holder       uuid;
begin
  case e.type
    when 'estate.created@1' then
      insert into estates (id, name, created_at)
      values (e.estate_id, coalesce(e.payload->>'name', 'unnamed estate'), e.occurred_at)
      on conflict (id) do update set name = excluded.name;
      -- An estate is created with an owner (FA-07); archived ownership is
      -- historical attribution, never a new membership (migration 65). The
      -- person must exist, because a projector may not refuse.
      if not exists (select 1 from estate_restore_boundaries b
          where b.target_estate_id=e.estate_id and e.seq=any(b.owner_event_seqs))
         and e.payload->>'owner_person_id' is not null
         and exists (select 1 from persons where id = (e.payload->>'owner_person_id')::uuid) then
        -- CO-418 (0.3.12 review i3 DA-2): the event's time, so a restore or a rebuild into an empty estate gives the
        -- same row as the live append (the column defaults were the moment the row was written).
        insert into memberships (person_id, estate_id, role, changed_by, created_at, changed_at)
        values ((e.payload->>'owner_person_id')::uuid, e.estate_id, 'owner', 'estate.created@1', e.occurred_at, e.occurred_at)
        on conflict (person_id, estate_id) do nothing;
      end if;
    when 'project.created@1' then
      insert into projects (id, estate_id, name, purpose, repo_path, created_at,
                            memory_backend, default_agent)
      values ((e.payload->>'id')::uuid, e.estate_id,
              e.payload->>'name', e.payload->>'purpose', e.payload->>'repo_path',
              e.occurred_at,
              coalesce(e.payload->>'memory_backend', 'local'),
              coalesce(e.payload->>'default_agent', 'claude-code'))
      on conflict (id) do update
        set name = excluded.name, purpose = excluded.purpose,
            -- DERIVED, as in every other arm here: the primary repository is
            -- the folder. The payload's value is a fallback for a project that
            -- has none attached yet, never an override of one that does.
            repo_path = coalesce(
              (select pr.path from project_repos pr
                where pr.project_id = excluded.id and pr.estate_id = excluded.estate_id
                  and pr.is_primary
                limit 1),
              excluded.repo_path),
            memory_backend = excluded.memory_backend,
            default_agent = excluded.default_agent
        -- ONE ESTATE'S ROW. A conflicting id owned elsewhere is left as its
        -- owner wrote it; the door refuses such an event before it is
        -- journalled, so only a replay of an older journal reaches this.
        where projects.estate_id = excluded.estate_id;
    when 'project.updated@1' then
      update projects
        set name      = coalesce(e.payload->>'name', name),
            purpose   = case when e.payload ? 'purpose'   then e.payload->>'purpose'   else purpose end,
            repo_path = case when e.payload ? 'repo_path' then e.payload->>'repo_path' else repo_path end,
            config_revision = e.seq
        where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
    when 'project.settings.updated@1' then
      update projects
        set memory_backend = coalesce(e.payload->>'memory_backend', memory_backend),
            default_agent  = coalesce(e.payload->>'default_agent', default_agent),
            config_revision = e.seq
        where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
    when 'project.archived@1' then
      update projects
        set status = 'archived', archived_at = e.occurred_at
        where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
    when 'project.repo.attached@1' then
      -- CO-340, CO-358: a folder is held by one row of an estate (the unique index on (estate_id, path)). Another
      -- row holding this path is either a REBUILD's later row (its own attach comes after this event in the
      -- journal: it is removed here and its attach puts it back in order) or a folder another row holds now
      -- (two projects held one folder before 0.3.7, or a race): the first attach keeps it and this one projects
      -- nothing. A projector never refuses (migration 70), so neither case raises and a replay cannot fail.
      select pr.id into v_holder from project_repos pr
       where pr.estate_id = e.estate_id and pr.path = e.payload->>'path' and pr.id <> (e.payload->>'id')::uuid
       limit 1;
      if v_holder is not null then
        if exists (select 1 from journal j
                    where j.estate_id = e.estate_id and j.type = 'project.repo.attached@1'
                      and j.payload->>'id' = v_holder::text and j.seq > e.seq) then
          delete from project_repos where id = v_holder and estate_id = e.estate_id;
        else
          return;
        end if;
      end if;
      insert into project_repos (id, estate_id, project_id, path, label, is_primary, attached_at)
      values ((e.payload->>'id')::uuid, e.estate_id, e.project_id,
              e.payload->>'path', e.payload->>'label',
              coalesce((e.payload->>'is_primary')::boolean, false), e.occurred_at)
      on conflict (id) do update set path = excluded.path, label = excluded.label
        where project_repos.estate_id = excluded.estate_id;
      if not exists (select 1 from project_repos where project_id = e.project_id and is_primary
                       and estate_id = e.estate_id) then
        update project_repos set is_primary = true where id = (e.payload->>'id')::uuid
               and estate_id = e.estate_id;
      end if;
      update projects
        set repo_path = (select path from project_repos
                          where project_id = e.project_id and is_primary
                            and estate_id = e.estate_id limit 1)
        where id = e.project_id
             and estate_id = e.estate_id;
    when 'project.repo.detached@1' then
      delete from project_repos where id = (e.payload->>'id')::uuid and project_id = e.project_id
             and estate_id = e.estate_id;
      if not exists (select 1 from project_repos where project_id = e.project_id and is_primary
                       and estate_id = e.estate_id) then
        select id into v_next_primary from project_repos
          where project_id = e.project_id and estate_id = e.estate_id
          order by attached_at limit 1;
        if v_next_primary is not null then
          update project_repos set is_primary = true where id = v_next_primary
                 and estate_id = e.estate_id;
        end if;
      end if;
      update projects
        set repo_path = (select path from project_repos
                          where project_id = e.project_id and is_primary
                            and estate_id = e.estate_id limit 1)
        where id = e.project_id
             and estate_id = e.estate_id;
    when 'project.configured@1' then
      -- One revision for everything the settings panel owns (UX28-11). The
      -- repository is attached through `project.repo.attached@1`, never set as
      -- a string by a settings save, so there is no `repo_path` here.
      update projects
        set name          = coalesce(e.payload->>'name', name),
            purpose       = case when e.payload ? 'purpose' then e.payload->>'purpose' else purpose end,
            default_agent = coalesce(e.payload->>'default_agent', default_agent),
            config_revision = e.seq
        where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
    else
      null;
  end case;
end $$;

revoke execute on function apply_estate_and_projects(journal) from public, anon, authenticated, service_role;

-- CO-341: what an older build left. Each (estate, path) keeps its first attached row (the one the projector above
-- keeps on a replay); the others are removed, the project that lost its primary promotes its oldest remaining folder,
-- and every project's folder is read again from its primary. Then the index migration 113 skipped where duplicates
-- existed. A database with none (every fresh one) changes nothing here.
do $$
declare v_project record;
begin
  create temporary table repo_dupes on commit drop as
    select id, estate_id, project_id
      from (select id, estate_id, project_id,
                   row_number() over (partition by estate_id, path order by attached_at, id) as rn
              from project_repos where estate_id is not null and path is not null) x
     where rn > 1;
  delete from project_repos pr using repo_dupes d where pr.id = d.id and pr.estate_id = d.estate_id;
  for v_project in select distinct estate_id, project_id from repo_dupes loop
    if not exists (select 1 from project_repos where estate_id = v_project.estate_id and project_id = v_project.project_id and is_primary) then
      update project_repos set is_primary = true
       where id = (select id from project_repos where estate_id = v_project.estate_id and project_id = v_project.project_id
                    order by attached_at, id limit 1)
         and estate_id = v_project.estate_id;
    end if;
    update projects set repo_path = (select path from project_repos where estate_id = v_project.estate_id
                                       and project_id = v_project.project_id and is_primary limit 1)
     where id = v_project.project_id and estate_id = v_project.estate_id;
  end loop;
end $$;
create unique index if not exists project_repos_unique_estate_path on project_repos(estate_id, path);

-- CO-341: `kind` is `is_primary` said again; after an attach or a detach (a promotion included) the project's rows
-- agree. A checkout or worktree that is not primary keeps its kind.
create or replace function apply_project_repo_kind(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if e.type not in ('project.repo.attached@1', 'project.repo.detached@1') or e.project_id is null then return; end if;
  update project_repos
     set kind = case when is_primary then 'primary' else 'checkout' end
   where estate_id = e.estate_id and project_id = e.project_id and is_primary <> (kind = 'primary');
end $$;
revoke execute on function apply_project_repo_kind(journal) from public, anon, authenticated, service_role;

update project_repos set kind = case when is_primary then 'primary' else 'checkout' end where is_primary <> (kind = 'primary');

-- CO-340, CO-358: the refusal the unique index gave a live attach of a folder another row holds, kept at the door. The
-- projector above no longer raises (a replay must not), so the door says it before anything is journalled. A restore
-- and a rebuild replay without this door, as they replay without every other one.
create or replace function refuse_held_folder(p_estate_id uuid, p_type text, p_payload jsonb)
returns void
language plpgsql
stable security definer set search_path = public
as $$
begin
  if p_type <> 'project.repo.attached@1' or nullif(p_payload->>'path', '') is null then return; end if;
  if exists (select 1 from project_repos
              where estate_id = p_estate_id and path = p_payload->>'path'
                and id is distinct from nullif(p_payload->>'id', '')::uuid) then
    raise exception 'the folder % is already attached in this estate; detach it first', p_payload->>'path'
      using errcode = 'unique_violation';
  end if;
end $$;
revoke execute on function refuse_held_folder(uuid, text, jsonb) from public, anon, authenticated, service_role;

-- Migration 82's `append_event`, plus the one line above; its grants stand.
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
  perform refuse_held_folder(p_estate_id, p_type, p_payload);   -- migration 124 (CO-340, CO-358): the index's refusal, at the door
  select coalesce(max(seq), 0) + 1 into v_seq from journal where estate_id = p_estate_id;
  insert into journal (estate_id, seq, type, schema_rev, actor, project_id, run_id, node_id, payload)
  values (p_estate_id, v_seq, p_type, p_schema_rev, p_actor, p_project_id, p_run_id, p_node_id, p_payload)
  returning * into v_event;
  perform apply_projections(v_event);
  return v_event;
end $$;


-- #endregion one-folder-one-row

-- #region withdrawn-answer-chain — docs: docs/evidence/plans/2026-10-26-release-0313-plan.md#the-one-schema-step-2026-10-26-on-agent0313-schema
-- CO-355: migration 116 closes the decision a withdrawal names while it is current. A decision the person corrected in
-- Memory first is already closed by the correction, and the correction (the chain's head) stayed current. This closes
-- every fact of the chain that starts at the question's decisions (the named one when the event names it) and is still
-- current, with the same `withdrawn_seq`. Facts written after the withdrawal are not touched.
create or replace function apply_withdrawn_answer_chain(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_decision uuid;
begin
  if e.type <> 'question.answer_withdrawn@1' then
    return;
  end if;
  v_decision := nullif(e.payload->>'decision_id', '')::uuid;
  with recursive chain as (
    select f.id, f.superseded_by
      from memory_facts f
     where f.estate_id = e.estate_id and f.kind = 'decision' and f.seq < e.seq
       and f.source_ref = 'question:' || (e.payload->>'id')
       and (v_decision is null or f.id = v_decision)
    union
    select n.id, n.superseded_by
      from memory_facts n join chain c on n.id = c.superseded_by
     where n.estate_id = e.estate_id and n.seq < e.seq
  )
  update memory_facts f
     set valid_to = e.occurred_at, withdrawn_seq = e.seq
   where f.estate_id = e.estate_id and f.valid_to is null and f.id in (select id from chain);
end $$;
revoke execute on function apply_withdrawn_answer_chain(journal) from public, anon, authenticated, service_role;

do $$
declare e journal;
begin
  for e in select * from journal where type = 'question.answer_withdrawn@1' order by seq loop
    perform apply_withdrawn_answer_chain(e);
  end loop;
end $$;

-- CO-357: `answer_question` writes the resolution beside the event, not in it, so the answered arm (migration 36) set
-- `resolution_id` to the payload's null on a replay that passed through a withdrawal. An answer that names none takes
-- the resolution its decision belongs to (`question_resolutions.decision_id` is unique).
create or replace function apply_question_resolution(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if e.type <> 'question.answered@1' or nullif(e.payload->>'resolution_id', '') is not null
     or nullif(e.payload->>'decision_id', '') is null then
    return;
  end if;
  update questions q
     set resolution_id = r.resolution_id
    from question_resolutions r
   where q.id = (e.payload->>'id')::uuid and q.estate_id = e.estate_id and q.status = 'answered'
     and q.decision_id = (e.payload->>'decision_id')::uuid and q.resolution_id is null
     and r.estate_id = e.estate_id and r.decision_id = q.decision_id;
end $$;
revoke execute on function apply_question_resolution(journal) from public, anon, authenticated, service_role;

update questions q set resolution_id = r.resolution_id
  from question_resolutions r
 where q.status = 'answered' and q.resolution_id is null and q.decision_id is not null
   and r.estate_id = q.estate_id and r.decision_id = q.decision_id;
-- #endregion withdrawn-answer-chain

-- #region project-business-owner — docs: docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md#decisions-the-questions-the-scenarios-leave-open
-- CO-418 (W2-4): who wrote the business last, a person or an agent. Null: nobody yet.
alter table projects add column if not exists business_set_by text
  check (business_set_by is null or business_set_by in ('person', 'agent'));

-- Migration 123's `apply_project_profile`, changed only in its business.
create or replace function apply_project_profile(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare r jsonb;
begin
  if e.type <> 'project.profiled@1' or e.project_id is null then return; end if;
  update projects set
    goal     = case when e.payload ? 'goal'     then nullif(btrim(e.payload->>'goal'), '')     else goal end,
    summary  = case when e.payload ? 'summary'  then nullif(btrim(e.payload->>'summary'), '')  else summary end,
    -- CO-418 (W2-4; 0.3.12 review i1 DA-2, i2 DA-2): a person's business (a value, or cleared) is the person's;
    -- anyone else's names a business only while none is recorded and no person ever wrote one, and never clears it.
    -- The rule the hub's tool keeps (`main/projectOnboarding.ts#agentProfilePayload`), now also on a rebuild.
    business = case
      when not (e.payload ? 'business') then business
      when coalesce(e.actor->>'kind', '') = 'person' then nullif(btrim(e.payload->>'business'), '')
      when business is null and business_set_by is distinct from 'person' then nullif(btrim(e.payload->>'business'), '')
      else business end,
    business_set_by = case
      when not (e.payload ? 'business') then business_set_by
      when coalesce(e.actor->>'kind', '') = 'person' then 'person'
      when business is null and business_set_by is distinct from 'person' and nullif(btrim(e.payload->>'business'), '') is not null then 'agent'
      else business_set_by end,
    plan     = case when e.payload ? 'plan'     then (case when jsonb_typeof(e.payload->'plan') = 'object' then e.payload->'plan' else null end) else plan end,
    profiled_at = e.occurred_at,
    profiled_by = coalesce(e.actor->>'id', profiled_by)
  where id = e.project_id and estate_id = e.estate_id;
  if e.payload ? 'relations' and jsonb_typeof(e.payload->'relations') = 'array' then
    delete from project_relations where estate_id = e.estate_id and project_id = e.project_id;
    for r in select value from jsonb_array_elements(e.payload->'relations') loop
      continue when jsonb_typeof(r) <> 'object'
        or coalesce(r->>'kind', '') not in ('depends-on', 'used-by', 'same-business', 'talks-to', 'other')
        or length(coalesce(btrim(r->>'target'), '')) not between 1 and 200;
      insert into project_relations (estate_id, project_id, kind, target, note, recorded_at)
      values (e.estate_id, e.project_id, r->>'kind', btrim(r->>'target'), left(nullif(btrim(r->>'note'), ''), 500), e.occurred_at)
      on conflict (estate_id, project_id, kind, target) do update set note = excluded.note, recorded_at = excluded.recorded_at;
    end loop;
  end if;
end $$;

revoke execute on function apply_project_profile(journal) from public, anon, authenticated, service_role;

-- History replayed through the rule once, so an upgraded database holds what a rebuild gives: every profile event in
-- order over projects whose business is unset (the other fields end where they were: each takes its last writer).
update projects set business = null, business_set_by = null where business is not null or business_set_by is not null;
do $$
declare e journal;
begin
  for e in select * from journal where type = 'project.profiled@1' order by seq loop
    perform apply_project_profile(e);
  end loop;
end $$;
-- #endregion project-business-owner

-- CO-418 (0.3.12 review i1 DA-7): a projection is written by its projector only (migration 95's shape); the projector
-- is `security definer` and needs no grant.
revoke insert, update, delete, truncate, references, trigger on project_relations from service_role;
grant select on project_relations to service_role;

-- CO-418 (0.3.12 review i3 DA-2): a delivery and a run carry their event's time. Their projectors insert with the
-- column default (the write's moment), so a restore gave every row the restore's time; this sets the event's.
create or replace function apply_projection_times(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if e.type = 'delivery.queued@1' then
    update deliveries set created_at = e.occurred_at
     where delivery_id = nullif(e.payload->>'delivery_id', '')::uuid and estate_id = e.estate_id and queued_seq = e.seq
       and created_at is distinct from e.occurred_at;
  elsif e.type = 'run.started@1' then
    update task_runs set created_at = e.occurred_at
     where task_run_id = nullif(e.payload->>'task_run_id', '')::uuid and estate_id = e.estate_id and admitted_seq = e.seq
       and created_at is distinct from e.occurred_at;
  end if;
end $$;
revoke execute on function apply_projection_times(journal) from public, anon, authenticated, service_role;

update deliveries d set created_at = j.occurred_at
  from journal j where j.estate_id = d.estate_id and j.seq = d.queued_seq and d.created_at is distinct from j.occurred_at;
update task_runs r set created_at = j.occurred_at
  from journal j where j.estate_id = r.estate_id and j.seq = r.admitted_seq and r.created_at is distinct from j.occurred_at;

-- #region board-schema-step — docs: docs/evidence/plans/2026-10-21-core-reliability/2026-10-21-board.md
-- CO-370 (BD-9): an epoch's age limit, 30 days plus 0 to 10 days fixed by its Project, so the epochs of Projects that
-- enrolled in one week rotate over ten days instead of in one tick.
create or replace function board_epoch_age_limit(p_project uuid) returns interval
language sql immutable set search_path = public as $$
  select board_epoch_max_age() + make_interval(hours => (abs(hashtextextended(coalesce(p_project::text, ''), 4244)) % 241)::integer)
$$;

-- CO-370 (BD-4): a reply goes to the sender of the message it answers. Null when that message is not held yet (a
-- restore replays before its threads exist) or was the replier's own: then the thread's participants, as before.
create or replace function board_reply_recipient(p_estate uuid, p_reply_to uuid, p_sender uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select m.sender_project from board_messages m
   where m.estate_id = p_estate and m.id = p_reply_to and m.sender_project <> p_sender
$$;

create or replace function apply_comms_reply_delivery(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare v_to uuid;
begin
  if e.type <> 'comms.message_submitted@1' or e.payload->>'kind' is distinct from 'reply'
     or nullif(e.payload->>'reply_to', '') is null then
    return;
  end if;
  v_to := board_reply_recipient(e.estate_id, (e.payload->>'reply_to')::uuid, (e.payload->>'sender_project_id')::uuid);
  if v_to is null then return; end if;
  delete from board_deliveries
   where estate_id = e.estate_id and message_id = (e.payload->>'message_id')::uuid and recipient_project <> v_to;
end $$;

-- CO-373: whether anyone can answer a (Project, capability) now, one test for the receipt's noResponder, the
-- operator's waiting count and the per-project waiting read: a holder whose lease has not lapsed, or a live
-- board.respond grant that would let a session take the slot.
create or replace function board_responder_live(p_estate uuid, p_project uuid, p_capability text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from board_responder_slots s
                  where s.estate_id = p_estate and s.project_id = p_project and s.capability = p_capability
                    and s.holder_enrollment is not null and s.lease_until > clock_timestamp())
      or p_capability = any (board_listed_capabilities(p_estate, p_project))
$$;

create or replace function board_list(p_estate_id uuid, p_reader uuid, p_thread uuid, p_after_seq bigint, p_limit integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100); v_rows jsonb; v_last bigint; v_more boolean;
begin
  if p_estate_id is null or p_reader is null or p_after_seq is null or p_after_seq < 0 then
    return board_refusal('invalid_arguments', 'The page request is not valid.');
  end if;
  if not board_is_project(p_estate_id, p_reader) then return board_refusal('not_authorized', 'This Project may not read the board.'); end if;
  if p_thread is not null and not exists (select 1 from board_threads t where t.id = p_thread and t.estate_id = p_estate_id and t.participants @> array[p_reader]) then
    return board_refusal('not_authorized', 'This Project does not take part in that thread.');
  end if;
  with page as (
    select m.id, m.seq from board_messages m join board_threads t on t.id = m.thread_id and t.estate_id = m.estate_id
     where m.estate_id = p_estate_id and t.participants @> array[p_reader] and m.seq > p_after_seq
       and (p_thread is null or m.thread_id = p_thread)
     order by m.seq limit v_limit + 1),
  kept as (select id, seq from page order by seq limit v_limit)
  select coalesce((select jsonb_agg(board_message_json(bm) order by bm.seq) from board_messages bm join kept k on k.id = bm.id), '[]'::jsonb),
         (select max(seq) from kept), (select count(*) from page) > v_limit
    into v_rows, v_last, v_more;
  return jsonb_build_object('ok', true, 'messages', v_rows, 'last_seq', coalesce(v_last, p_after_seq), 'more', coalesce(v_more, false));
end $$;


create or replace function board_get(p_estate_id uuid, p_reader uuid, p_message uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m board_messages;
begin
  if not board_is_project(p_estate_id, p_reader) then return board_refusal('not_authorized', 'This Project may not read the board.'); end if;
  select bm.* into m from board_messages bm join board_threads t on t.id = bm.thread_id and t.estate_id = bm.estate_id
   where bm.id = p_message and bm.estate_id = p_estate_id and t.participants @> array[p_reader];
  if not found then return board_refusal('not_authorized', 'This Project cannot read that message.'); end if;
  return jsonb_build_object('ok', true, 'message', board_message_json(m));
end $$;


-- Migration 120's `board_tick`, changed only in (b).
create or replace function board_tick(p_estate_id uuid) returns jsonb
language plpgsql security definer set search_path = public set lock_timeout = '3s' as $$
declare r board_requests; ep board_epochs; v_answered integer := 0; v_expired integer := 0; v_rotated integer := 0; v_receipts integer := 0; v_outbox integer := 0;
        v_retired jsonb := '[]'::jsonb; v_cutoff timestamptz := clock_timestamp() - board_receipt_retention(); n integer;
        v_system jsonb := jsonb_build_object('kind', 'system', 'id', 'board');
begin
  if p_estate_id is null then return board_refusal('invalid_arguments', 'The tick names no estate.'); end if;
  -- (a0) BD-1: a queued request its target already replied to is answered. The reply's own command answers it at once
  --      (board_insert_message); this pass settles what was stored before that rule, and is idle after.
  for r in select q.* from board_requests q where q.estate_id = p_estate_id and q.state = 'queued'
             and exists (select 1 from board_messages m where m.estate_id = q.estate_id and m.reply_to = q.message_id
                           and m.sender_project = q.target_project and m.kind <> 'request')
             order by q.submitted_seq for update of q skip locked loop
    perform board_transition(p_estate_id, r.message_id, 'answer', 'answered', r.effect, 'target-reply', v_system);
    v_answered := v_answered + 1;
  end loop;
  -- (a) A deadline passed: queued and claimed requests expire. An accepted one is held (C4) — its responder
  --     said it would act, and only an outcome or a cancel ends it. BD-1: a request stored with no deadline (before
  --     this release every request could be) is given the default age from its message, so nothing stays queued for ever.
  for r in select q.* from board_requests q where q.estate_id = p_estate_id and q.state in ('queued', 'claimed')
             and coalesce(q.deadline, (select m.at + board_request_default_ttl() from board_messages m
                                         where m.estate_id = q.estate_id and m.id = q.message_id)) < clock_timestamp()
             order by q.submitted_seq for update of q skip locked loop
    perform board_transition(p_estate_id, r.message_id, 'expire', 'expired', r.effect, 'deadline', v_system);
    v_expired := v_expired + 1;
  end loop;
  -- (b) An open epoch at 90 % of its capacity, or past its own age limit (30 days plus up to 10, per Project,
  --     CO-370), rotates: the epochs opened in one week no longer close in one burst.
  for ep in select * from board_epochs where estate_id = p_estate_id and state = 'open'
              and (keys >= ceil(board_epoch_capacity() * board_epoch_rotation_share()) or opened_at < clock_timestamp() - board_epoch_age_limit(project_id))
              for update skip locked loop
    perform board_rotate_epoch(p_estate_id, ep.project_id, ep.epoch,
      case when ep.keys >= ceil(board_epoch_capacity() * board_epoch_rotation_share()) then 'capacity' else 'age' end);
    v_rotated := v_rotated + 1;
  end loop;
  -- (c) A closed epoch 30 days after it closed: its receipts are compacted and it is retired for ever.
  perform set_config('fabric.board_compaction', txid_current()::text, true);
  for ep in select * from board_epochs where estate_id = p_estate_id and state = 'closed' and closed_at < v_cutoff
              order by project_id, epoch for update skip locked loop
    delete from board_idempotency where estate_id = p_estate_id and sender_project = ep.project_id and epoch = ep.epoch;
    get diagnostics n = row_count;
    v_receipts := v_receipts + n;
    v_retired := v_retired || jsonb_build_array(jsonb_build_object('project_id', ep.project_id, 'epoch', ep.epoch));
  end loop;
  perform set_config('fabric.board_compaction', '', true);
  -- (d) Outbox entries older than 7 days that every consumer cursor has passed. With no consumer, none waits.
  delete from board_outbox o where o.estate_id = p_estate_id and o.created_at < clock_timestamp() - board_outbox_retention()
     and not exists (select 1 from board_consumer_cursors c where c.estate_id = p_estate_id and c.last_seq < o.seq);
  get diagnostics v_outbox = row_count;
  -- Bodies are never deleted by age. One receipt per pass that did something; an idle pass writes nothing.
  if jsonb_array_length(v_retired) > 0 or v_outbox > 0 then
    perform board_append(p_estate_id, 'comms.retention_applied@1', v_system, jsonb_build_object(
      'policy', jsonb_build_object('receipt_days', 30, 'outbox_days', 7, 'bodies', 'kept-until-redacted'),
      'retired', v_retired, 'receipts_compacted', v_receipts, 'outbox_compacted', v_outbox, 'cutoff_at', board_at(v_cutoff)));
  end if;
  return jsonb_build_object('ok', true, 'answered', v_answered, 'expired', v_expired, 'rotated', v_rotated, 'retired', jsonb_array_length(v_retired),
    'receipts_compacted', v_receipts, 'outbox_compacted', v_outbox);
end $$;


-- Migration 120's `board_list_reader`, with unread meaning delivered and not marked.
create or replace function board_list_reader(p_estate_id uuid, p_reader uuid, p_thread uuid, p_after_seq bigint, p_limit integer,
  p_unread boolean, p_since timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100); v_rows jsonb; v_last bigint; v_more boolean;
        v_unread boolean := coalesce(p_unread, false);
begin
  if p_estate_id is null or p_reader is null or p_after_seq is null or p_after_seq < 0 then
    return board_refusal('invalid_arguments', 'The page request is not valid.');
  end if;
  if not board_is_project(p_estate_id, p_reader) then return board_refusal('not_authorized', 'This Project may not read the board.'); end if;
  if p_thread is not null and not exists (select 1 from board_threads t where t.id = p_thread and t.estate_id = p_estate_id and t.participants @> array[p_reader]) then
    return board_refusal('not_authorized', 'This Project does not take part in that thread.');
  end if;
  with page as (
    select m.id, m.seq from board_messages m join board_threads t on t.id = m.thread_id and t.estate_id = m.estate_id
     where m.estate_id = p_estate_id and t.participants @> array[p_reader] and m.seq > p_after_seq
       and (p_thread is null or m.thread_id = p_thread)
       and (p_since is null or m.at >= p_since)
       -- CO-370: unread to a reader is what was delivered to it and not marked (com.status counts the same), so a
       -- reply addressed to another participant is in the thread and is not unread here.
       and (not v_unread or (m.sender_project <> p_reader
              and exists (select 1 from board_deliveries d where d.estate_id = m.estate_id and d.message_id = m.id and d.recipient_project = p_reader)
              and not exists (select 1 from board_read_marks r where r.estate_id = m.estate_id and r.reader_project = p_reader and r.message_id = m.id)))
     order by m.seq limit v_limit + 1),
  kept as (select id, seq from page order by seq limit v_limit)
  select coalesce((select jsonb_agg(board_message_json(bm) || jsonb_build_object('read',
             bm.sender_project = p_reader
             or not exists (select 1 from board_deliveries d where d.estate_id = bm.estate_id and d.message_id = bm.id and d.recipient_project = p_reader)
             or exists (select 1 from board_read_marks r where r.estate_id = bm.estate_id and r.reader_project = p_reader and r.message_id = bm.id))
           order by bm.seq) from board_messages bm join kept k on k.id = bm.id), '[]'::jsonb),
         (select max(seq) from kept), (select count(*) from page) > v_limit
    into v_rows, v_last, v_more;
  return jsonb_build_object('ok', true, 'messages', v_rows, 'last_seq', coalesce(v_last, p_after_seq), 'more', coalesce(v_more, false));
end $$;


-- Migration 103's `board_backfill_deliveries` (a restore's deliveries), with the reply rule.
create or replace function board_backfill_deliveries(p_estate uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into board_deliveries (estate_id, message_id, recipient_project, seq, is_request, capability)
  select m.estate_id, m.id, p, m.seq, m.kind = 'request', r.capability
    from board_messages m
    join board_threads t on t.id = m.thread_id and t.estate_id = m.estate_id
    cross join lateral unnest(t.participants) p
    left join board_requests r on r.estate_id = m.estate_id and r.message_id = m.id
   where (p_estate is null or m.estate_id = p_estate) and p <> m.sender_project
     -- CO-370: a reply goes to the sender of the message it answers (apply_comms_reply_delivery).
     and (m.kind <> 'reply' or board_reply_recipient(m.estate_id, m.reply_to, m.sender_project) is null
          or p = board_reply_recipient(m.estate_id, m.reply_to, m.sender_project))
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;


-- Migration 120's three waiting reads, each with the one test.
create or replace function board_responder_possible(p_estate uuid, p_project uuid, p_capability text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if p_estate is null or p_project is null or coalesce(p_capability, '') !~ '^[a-z][a-z0-9._-]{1,127}$' then
    return board_refusal('invalid_arguments', 'Name a Project and a capability.');
  end if;
  return jsonb_build_object('ok', true, 'possible',
    board_responder_live(p_estate, p_project, p_capability));
end $$;


create or replace function board_pending_operator(p_estate uuid, p_limit integer) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 100); v_rows jsonb; v_total bigint;
begin
  if p_estate is null then return board_refusal('invalid_arguments', 'The pending request is not valid.'); end if;
  with waiting as (
    -- Delivered, held by the board (a delivery whose message the board holds), and not marked read by the recipient.
    select d.recipient_project, d.is_request, m.kind, m.at
      from board_deliveries d
      join board_messages m on m.estate_id = d.estate_id and m.id = d.message_id
     where d.estate_id = p_estate
       and not exists (select 1 from board_read_marks r where r.estate_id = d.estate_id and r.reader_project = d.recipient_project and r.message_id = d.message_id)
  ), unread as (
    select w.recipient_project as project, count(*) as unread, min(w.at) as oldest_at,
           count(*) filter (where w.kind = 'finding') as findings,
           count(*) filter (where w.is_request) as requests
      from waiting w group by w.recipient_project
  ), asked as (
    -- An open request addressed to this project that nobody can answer now (CO-373: the noResponder test), read or not.
    select br.target_project as project, count(*) as absent, min(m.at) as oldest_at
      from board_requests br
      join board_messages m on m.estate_id = br.estate_id and m.id = br.message_id
     where br.estate_id = p_estate and board_request_open(br.state)
       and not board_responder_live(p_estate, br.target_project, br.capability)
     group by br.target_project
  ), per as (
    select coalesce(u.project, a.project) as project, coalesce(u.unread, 0) as unread, least(u.oldest_at, a.oldest_at) as oldest_at,
           coalesce(u.findings, 0) as findings, coalesce(u.requests, 0) as requests, coalesce(a.absent, 0) as absent
      from unread u full join asked a on a.project = u.project
  )
  select coalesce((select jsonb_agg(jsonb_build_object('project', x.project, 'unread', x.unread, 'oldestAt', board_at(x.oldest_at),
                                                       'findings', x.findings, 'requests', x.requests, 'requestsWithAbsentResponder', x.absent)
                                    order by x.oldest_at, x.project)
                     from (select * from per order by oldest_at, project limit v_limit) x), '[]'::jsonb),
         (select count(*) from per)
    into v_rows, v_total;
  return jsonb_build_object('ok', true, 'projects', v_rows, 'more', v_total > v_limit);
end $$;


create or replace function board_waiting_operator(p_estate uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_requests integer; v_oldest_request timestamptz; v_unread integer; v_oldest_unread timestamptz;
begin
  if p_estate is null then return board_refusal('invalid_arguments', 'The waiting request is not valid.'); end if;
  select count(*)::integer, min(m.at) into v_requests, v_oldest_request
    from board_requests br join board_messages m on m.estate_id = br.estate_id and m.id = br.message_id
   where br.estate_id = p_estate and board_request_open(br.state)
     and not board_responder_live(p_estate, br.target_project, br.capability);
  select count(*)::integer, min(m.at) into v_unread, v_oldest_unread
    from board_deliveries d join board_messages m on m.estate_id = d.estate_id and m.id = d.message_id
   where d.estate_id = p_estate
     and not exists (select 1 from board_read_marks r where r.estate_id = d.estate_id and r.reader_project = d.recipient_project and r.message_id = d.message_id);
  return jsonb_strip_nulls(jsonb_build_object('ok', true, 'requests', v_requests, 'oldestRequestAt', board_at(v_oldest_request),
    'unread', v_unread, 'oldestUnreadAt', board_at(v_oldest_unread)));
end $$;


-- CO-418 (0.3.12 review i1 DO-18): migration 107's three refusals, their last sentence as com.enroll says it (CO-397,
-- DEC-0098, DEC-0102); nothing else in the three bodies changes.
create or replace function board_holder_enrollment(p_estate uuid, p_holder jsonb, p_project uuid, p_capability text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare e board_enrollments;
begin
  select * into e from board_enrollments where estate_id = p_estate and project_id = p_project and capability = p_capability
     and session_id = p_holder->>'session_id' and released_seq is null;
  if not found then
    if board_grant_for(p_estate, p_holder, p_project, p_capability) is null then
      return board_refusal('not_authorized', format('The operator has not let this agent answer %s requests for this project: the operator grants it in Fabric, Settings → Agent access. Until then a com.reply on the request is still your answer: a reply from the request''s target answers it, so reply with the answer itself.', p_capability));
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
    return board_refusal('not_authorized', format('The operator has not let this agent answer %s requests for this project: the operator grants it in Fabric, Settings → Agent access. Until then a com.reply on the request is still your answer: a reply from the request''s target answers it, so reply with the answer itself.', v_cap));
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
    return board_refusal('not_authorized', format('The operator has not let this agent answer %s requests for this project: the operator grants it in Fabric, Settings → Agent access. Until then a com.reply on the request is still your answer: a reply from the request''s target answers it, so reply with the answer itself.', v_cap));
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


revoke execute on function board_epoch_age_limit(uuid), board_reply_recipient(uuid, uuid, uuid),
  board_responder_live(uuid, uuid, text), apply_comms_reply_delivery(journal)
  from public, anon, authenticated, service_role;
-- #endregion board-schema-step

-- #region project-activity — docs: docs/evidence/plans/2026-10-26-release-0313-plan.md#the-one-schema-step-2026-10-26-on-agent0313-schema
-- CO-398: the finished tasks, newest move first (`main/workRead.ts#readHome`, «Закончили»).
create index if not exists project_tasks_done_moved on project_tasks (estate_id, moved_at desc nulls last) where status = 'done';

-- CO-418 (0.3.12 review i1 DA-4) and CO-307: a project's journal, newest first. Serves the project page's analytics
-- (its moves and closes) and each project's last activity below.
create index if not exists journal_by_project on journal (estate_id, project_id, seq desc) where project_id is not null;

-- CO-307: each project's newest journal event, one index probe per project, instead of the home reading the estate's
-- newest 3 000 events (a project quiet past that window had no «Тихо уже»). The caller's own rights apply
-- (`security_invoker`): a member reads its estates' rows through the policies of `projects` and `journal`.
create or replace view project_activity with (security_invoker = true) as
  select p.estate_id, p.id as project_id, a.occurred_at as last_occurred_at, a.seq as last_seq
    from projects p
    cross join lateral (select j.occurred_at, j.seq from journal j
                         where j.estate_id = p.estate_id and j.project_id = p.id
                         order by j.seq desc limit 1) a;
revoke all on project_activity from anon;
revoke insert, update, delete, truncate, references, trigger on project_activity from authenticated, service_role;
grant select on project_activity to authenticated, service_role;
-- #endregion project-activity

-- #region abandoned-sweep-receipt — docs: docs/evidence/specs/2026-10-26-0313-w2-abandoned-work-sweep.md#requirements
-- SW-7 (CO-427): the sweep of abandoned work's receipt. Journal-only, like `session.turn.observed@1`.
insert into event_types (type, projects, note) values
  ('work.swept@1', false, 'the sweep of abandoned work found something: counts of what it found by kind, how many it told, delivered into a terminal, queued as nudges and released, and which reads stopped at their bounds; never a task title or a message body (SW-7)')
on conflict (type) do nothing;
-- #endregion abandoned-sweep-receipt

-- The dispatcher: migration 123's, plus five lines.
create or replace function apply_projections(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform apply_estate_and_projects(e);
  perform apply_project_repo_identity(e);
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
  perform apply_question_answer_reopen(e);
  perform apply_withdrawn_answer_decision(e);
  perform apply_project_profile(e);
  perform apply_project_repo_kind(e);
  perform apply_withdrawn_answer_chain(e);
  perform apply_question_resolution(e);
  perform apply_comms_reply_delivery(e);
  perform apply_projection_times(e);
end;
$$;
revoke execute on function apply_projections(journal) from public, anon, authenticated, service_role;

-- ── schema 97 as a private-archive source ────────────────────────────────────────────────────────────────────────
-- Schema 97 adds no archive event shape, so an archive taken at 97 reads as one taken at 96 (the function of
-- migration 123, with 97 admitted).
-- #region private-archive-source-schema — docs: docs/adr/0079-private-conversation-archives-preserve-history-not-authority.md#decision
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb,'71'::jsonb,'72'::jsonb,'73'::jsonb,'74'::jsonb,'75'::jsonb,'76'::jsonb,'77'::jsonb,'78'::jsonb,'79'::jsonb,'80'::jsonb,'81'::jsonb,'82'::jsonb,'83'::jsonb,'84'::jsonb,'85'::jsonb,'86'::jsonb,'87'::jsonb,'88'::jsonb,'89'::jsonb,'90'::jsonb,'91'::jsonb,'92'::jsonb,'93'::jsonb,'94'::jsonb,'95'::jsonb,'96'::jsonb,'97'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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
  exception when check_violation then perform ceo_archive_fail('invalid_archive');
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
