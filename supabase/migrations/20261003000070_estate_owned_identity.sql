-- An id names ONE estate's row, and another estate's event cannot rewrite it
-- (release review 2026-10-03, iteration 1, data finding 1).
--
-- MEASURED on an owned cluster with the whole chain applied: estate B appended
-- `project.created@1` carrying a project id that estate A owned. The append was
-- ACCEPTED, and A's row came back renamed with `repo_path` cleared, because the
-- projector arm ends `on conflict (id) do update set name = …` and nothing in
-- that clause asks which estate the conflicting row belongs to. Projection rows
-- are keyed by the entity id GLOBALLY (migration 65 says so about restores), so
-- the conflict is found in A and the update is written there. Worse,
-- `import_declared_snapshot` into a brand-new estate C answered COMMITTED with
-- `estate.imported@1 {"events":1}` while C held no project and A's had been
-- renamed `from mirror` — a workspace folder written by one estate, adopted by
-- another on the same database, edits the first in silence. `memory_facts`
-- has the same shape: its owner check reads `where id = … and estate_id =
-- e.estate_id`, finds nothing in B, and the upsert then rewrites A's claim.
--
-- Seven projector upserts had it. Every `do update` keyed on a global id
-- without an estate predicate, enumerated from the latest definition of every
-- `apply_*` function rather than from the two the review named:
--
--   projects, project_repos                       (apply_estate_and_projects)
--   memory_facts                                  (apply_memory_facts)
--   project_tasks, agent_stages,
--   session_transcripts @1, session_context_packs (apply_task_lifecycle_base)
--
-- `apply_transcript_capture` (@2) and `apply_heartbeats` already carried the
-- predicate; they are the precedent, not new ground.
--
-- TWO HALVES, BECAUSE ADR-0014 SPLITS THE QUESTION IN TWO.
--
-- 1. THE DOOR REFUSES. `append_event` is the write boundary, and migration 16
--    states the rule this follows: "A PROJECTION MAY NOT REFUSE WHAT THE
--    JOURNAL ACCEPTED … a guard belongs at the write boundary." An event whose
--    project, or whose entity id, belongs to another estate raises
--    `check_violation` before it is journalled. The caller reads a sentence
--    naming the type and the table; the other estate is never named, because
--    an id that leaks which estate holds it is a cross-estate read. A refused
--    append inside `import_declared_snapshot` aborts the whole import, so C
--    is left empty and the receipt is never written — which is what "an import
--    lands whole or not at all" (migration 39) already promised.
--
--    Refusing rather than skipping is the choice for a NEW event because a
--    skip journals a fact in B that no projection of B will ever show: the
--    estate's history would say a project was created that its own screens can
--    never find, and nothing would say why.
--
-- 2. THE PROJECTOR SKIPS. Journals written before this migration may already
--    hold such an event, and `rebuild_estate_projections` replays them over
--    the existing rows. A raise there would make the estate unrebuildable for
--    as long as the event sits in the journal — the failure migration 50
--    measured and refused. So every one of the seven upserts gains
--    `where <table>.estate_id = excluded.estate_id`: on replay the foreign row
--    is left exactly as its owner wrote it, deterministically, and the replay
--    completes. The concurrent case lands here too: two estates appending the
--    same new id at once take different advisory locks, both pass the door,
--    and the second insert finds the first's row and changes nothing.
--
-- AND ONE ADJACENT DEFECT IN THE SAME CLAUSE (data finding 6). A repeated
-- `project.created@1` in the SAME estate set `repo_path = excluded.repo_path`,
-- and a repeat carries none, so the project lost its folder while its primary
-- `project_repos` row remained — and `rebuild_estate_projections` reproduced
-- the null. `repo_path` is derived from the primary repository everywhere
-- else in this function, so the created arm now derives it too and falls back
-- to the payload only when no repository is attached.
--
-- Additive: no table, no event type and no grant changes. The redefined
-- functions keep their signatures, so their existing grants and revokes stand;
-- the one new function is revoked from every API role.

-- #region estate-owned-identity — docs: docs/adr/0103-an-id-belongs-to-one-estate-at-the-write-boundary.md#decision
-- ── the door ────────────────────────────────────────────────────────────────

create function refuse_foreign_identity(
  p_estate_id  uuid,
  p_type       text,
  p_payload    jsonb,
  p_project_id uuid
) returns void
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_table text;
  v_id    uuid;
  v_found boolean := false;
begin
  -- Every project-scoped event, whatever its type. One primary-key lookup.
  if p_project_id is not null
     and exists (select 1 from projects where id = p_project_id and estate_id <> p_estate_id) then
    raise exception using
      errcode = 'check_violation',
      message = format('%s names a project that belongs to another estate. A project id is global; '
                       'appending this event here would write into that estate. Mint a new id.', p_type);
  end if;

  -- The entity the event creates, for the seven upserts keyed on a global id.
  case p_type
    when 'project.created@1' then
      v_table := 'projects';
      v_id := nullif(p_payload->>'id', '')::uuid;
      v_found := exists (select 1 from projects where id = v_id and estate_id <> p_estate_id);
    when 'project.repo.attached@1' then
      v_table := 'project_repos';
      v_id := nullif(p_payload->>'id', '')::uuid;
      v_found := exists (select 1 from project_repos where id = v_id and estate_id <> p_estate_id);
    when 'memory.project.recorded@1' then
      v_table := 'memory_facts';
      v_id := nullif(p_payload->>'id', '')::uuid;
      v_found := exists (select 1 from memory_facts where id = v_id and estate_id <> p_estate_id);
    when 'task.started@1' then
      v_table := 'project_tasks';
      v_id := nullif(p_payload->>'id', '')::uuid;
      v_found := exists (select 1 from project_tasks where id = v_id and estate_id <> p_estate_id);
    when 'agent.stage.reported@1' then
      v_table := 'agent_stages';
      v_id := nullif(p_payload->>'session_id', '')::uuid;
      v_found := exists (select 1 from agent_stages where session_id = v_id and estate_id <> p_estate_id);
    when 'transcript.captured@1' then
      v_table := 'session_transcripts';
      v_id := nullif(p_payload->>'session_id', '')::uuid;
      v_found := exists (select 1 from session_transcripts where session_id = v_id and estate_id <> p_estate_id);
    when 'context.compiled@1' then
      v_table := 'session_context_packs';
      v_id := nullif(p_payload->>'session_id', '')::uuid;
      v_found := exists (select 1 from session_context_packs where session_id = v_id and estate_id <> p_estate_id);
    else
      return;
  end case;

  if v_found then
    raise exception using
      errcode = 'check_violation',
      message = format('%s carries a %s id that belongs to another estate. The id is global; '
                       'appending this event here would rewrite that estate''s row. Mint a new id.',
                       p_type, v_table);
  end if;
end $$;

revoke execute on function refuse_foreign_identity(uuid, text, jsonb, uuid) from public;
revoke execute on function refuse_foreign_identity(uuid, text, jsonb, uuid) from anon, authenticated, service_role;

comment on function refuse_foreign_identity(uuid, text, jsonb, uuid) is
  'Write-boundary guard for append_event: refuses an event whose project, or whose created entity id, belongs to another estate. The projector arms carry the matching estate predicate for events journalled before it existed.';

-- append_event: migration 64's body, unchanged except for the one call marked
-- below. It is placed AFTER the CEO and transcript authorisations, so those
-- refusals keep their own sentences, and BEFORE the estate lock, so a refusal
-- costs no serialisation.
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
  -- (migration 70) an id owned by another estate is refused here, at the door.
  perform refuse_foreign_identity(p_estate_id, p_type, p_payload, p_project_id);
  perform pg_advisory_xact_lock(hashtextextended(p_estate_id::text, 4242));
  select coalesce(max(seq), 0) + 1 into v_seq from journal where estate_id = p_estate_id;
  insert into journal (estate_id, seq, type, schema_rev, actor, project_id, run_id, node_id, payload)
  values (p_estate_id, v_seq, p_type, p_schema_rev, p_actor, p_project_id, p_run_id, p_node_id, p_payload)
  returning * into v_event;
  perform apply_projections(v_event);
  return v_event;
end $$;

-- ── the projector: estates and projects ─────────────────────────────────────
--
-- Migration 65's body. Changed: the `projects` and `project_repos` upserts
-- carry the estate predicate; the created arm derives `repo_path`; every read
-- of `project_repos` by project id also names the estate.

create or replace function apply_estate_and_projects(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_next_primary uuid;
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
        insert into memberships (person_id, estate_id, role, changed_by)
        values ((e.payload->>'owner_person_id')::uuid, e.estate_id, 'owner', 'estate.created@1')
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

-- ── the projector: memory ───────────────────────────────────────────────────
--
-- Migration 50's body. Changed: a fact id owned by another estate ends the arm,
-- and the upsert carries the estate predicate.

create or replace function apply_memory_facts(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_supersedes uuid;
  v_occurrence uuid;
  v_origin     jsonb := e.payload->'occurrence';
  v_grouping   text;
  v_outcome    text := 'not_requested';
  v_reason     text;
  v_target     record;
  v_owner_seq  bigint;
begin
  -- The retrieval arm, carried forward unchanged. THIS FUNCTION PROJECTS TWO
  -- TYPES, and the first version of this migration replaced it with a body that
  -- handled one — silently dropping every `memory.retrieved@1` row, which is
  -- what the miss backlog and the retrieval count are made of. Caught by
  -- `agent-surface.test.mjs` on a full run: "three searches produced 0
  -- retrieval rows". Replacing a projector means carrying every arm it had.
  if e.type = 'memory.retrieved@1' then
    insert into memory_retrievals (id, estate_id, project_id, session_id, actor_kind,
                                   actor_id, store, query, hits, asked_at, seq)
    values ((e.payload->>'id')::uuid, e.estate_id, e.project_id,
            nullif(e.payload->>'session_id', '')::uuid,
            e.actor->>'kind', e.actor->>'id',
            e.payload->>'store', e.payload->>'query',
            coalesce((e.payload->>'hits')::integer, 0),
            e.occurred_at, e.seq)
    on conflict (id) do nothing;
    return;
  end if;

  if e.type <> 'memory.project.recorded@1' then return; end if;

  -- ── A FACT ID IS NOT A MUTABLE SLOT, and the refusal has to be replayable ──
  --
  -- The upsert below exists so a REPLAY is idempotent: the same event applied
  -- twice writes the same row and changes nothing. A DIFFERENT event carrying
  -- the same fact id is not a replay — it is a rewrite of history using the
  -- projector's own idempotency as the tool, and the earlier claim would vanish
  -- with no correction, no lineage and no receipt.
  --
  -- THE FIRST EVENT OWNS THE IDENTITY, and the second changes nothing.
  --
  -- It was a trigger raising `check_violation` first, and the probe showed why
  -- that is the wrong floor HERE. `rebuild_estate_projections` replays the
  -- whole journal, so a raise inside a projector arm does not refuse one write
  -- — it makes the entire estate unrebuildable, for as long as the offending
  -- pair sits in the journal. Refusing an append is a small failure; an estate
  -- whose projections can never be rebuilt is a large one, and ADR-0014 rests
  -- on the rebuild. Ignoring the later event is deterministic, replay-safe, and
  -- keeps exactly what the raise was protecting: the first claim stands.
  select seq into v_owner_seq
    from memory_facts
   where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
  if v_owner_seq is not null and v_owner_seq <> e.seq then return; end if;
  -- (migration 70) AND THE IDENTITY IS ONE ESTATE'S. The check above looks in
  -- this event's estate only, so a fact id owned by another estate read as
  -- "no owner yet" and the upsert below rewrote that estate's claim. The door
  -- now refuses such an append; a replay of an older journal stops here,
  -- before an occurrence or a correction is computed for a row it may not
  -- touch.
  if exists (select 1 from memory_facts
              where id = (e.payload->>'id')::uuid and estate_id <> e.estate_id) then
    return;
  end if;

  -- ── the occurrence, before the fact that cites it ──
  --
  -- Upserted on the episode tuple, so three facts about one incident find the
  -- one row rather than making a third. `first_observed_at` never moves
  -- backwards past what is already recorded; `last_observed_at` extends.
  if v_origin is not null
     and coalesce(v_origin->>'system', '') <> ''
     and coalesce(v_origin->>'source_id', '') <> ''
     and coalesce(v_origin->>'episode_key', '') <> '' then
    -- An agent's own assertion is provisional whoever it names; only an actor
    -- that is not the agent can promote it. The actor comes from the credential
    -- the event was appended under, never from the payload.
    v_grouping := case
                    when e.actor->>'kind' = 'agent' then 'agent_proposed'
                    when e.actor->>'kind' = 'person' then 'reviewed'
                    else 'host_observed'
                  end;
    insert into memory_occurrences (estate_id, project_id, origin_system, source_id,
                                    episode_key, grouping, first_observed_at, last_observed_at)
    values (e.estate_id, e.project_id, v_origin->>'system', v_origin->>'source_id',
            v_origin->>'episode_key', v_grouping, e.occurred_at, e.occurred_at)
    on conflict (estate_id, project_id, origin_system, source_id, episode_key)
      do update set
        last_observed_at = greatest(memory_occurrences.last_observed_at, excluded.last_observed_at),
        first_observed_at = least(memory_occurrences.first_observed_at, excluded.first_observed_at),
        -- Promotion only. A host observation establishes distinctness an agent
        -- had merely claimed; an agent citing an episode a host observed does
        -- not demote it back to provisional.
        grouping = case
                     when memory_occurrences.grouping = 'host_observed' then 'host_observed'
                     when excluded.grouping = 'host_observed' then 'host_observed'
                     when memory_occurrences.grouping = 'reviewed' or excluded.grouping = 'reviewed'
                       then 'reviewed'
                     else memory_occurrences.grouping
                   end
    returning occurrence_id into v_occurrence;
  end if;

  -- ── the correction, and what actually happened to it ──
  v_supersedes := nullif(e.payload->>'supersedes', '')::uuid;
  if v_supersedes is not null then
    select id, actor_kind, valid_to, superseded_by into v_target
      from memory_facts
     where id = v_supersedes
       and estate_id = e.estate_id
       and project_id = e.project_id;

    if not found then
      v_outcome := 'rejected';
      v_reason  := 'there is no such fact in this project';
    elsif v_target.valid_to is not null
          and v_target.superseded_by is distinct from (e.payload->>'id')::uuid then
      -- Already corrected BY SOMEBODY ELSE. Closing it again would silently
      -- overwrite whichever correction got there first.
      --
      -- "By somebody else" is the whole clause, and P24 is why: projections are
      -- REBUILT by replaying the journal OVER the existing rows rather than
      -- into an empty table (`rebuild_estate_projections`), so every arm has to
      -- be idempotent. Written as a bare `valid_to is not null`, this branch
      -- read the state its own previous application had produced: on the first
      -- pass the correction succeeded, on the rebuild it saw a closed target
      -- and demoted itself to a conflict. A projection that does not survive
      -- its own replay is not a projection (ADR-0014), and no unit test can
      -- see it — the defect only exists on the second application.
      v_outcome := 'conflict_proposed';
      v_reason  := 'that fact had already been corrected; this claim stands beside the correction';
    elsif v_target.actor_kind = 'person' and e.actor->>'kind' = 'agent' then
      v_outcome := 'conflict_proposed';
      v_reason  := 'an agent may not bury what a person recorded; both claims stand and a person decides';
    else
      v_outcome := 'superseded';
    end if;
  end if;

  insert into memory_facts (id, estate_id, project_id, claim, source_ref, kind,
                            actor_kind, actor_id, recorded_at, valid_from, seq,
                            category, about_namespace, about_key, occurrence_id,
                            supersedes_requested, correction_outcome, correction_reason)
  values ((e.payload->>'id')::uuid, e.estate_id, e.project_id,
          e.payload->>'claim', e.payload->>'source_ref',
          coalesce(e.payload->>'kind', 'note'),
          e.actor->>'kind', e.actor->>'id',
          e.occurred_at,
          coalesce((e.payload->>'valid_from')::timestamptz, e.occurred_at),
          e.seq,
          -- Absent means the project. Every fact recorded before this migration
          -- replays to exactly that, which is what it is.
          coalesce(nullif(e.payload->>'category', ''), 'project'),
          nullif(e.payload#>>'{about,namespace}', ''),
          nullif(e.payload#>>'{about,key}', ''),
          v_occurrence,
          v_supersedes, v_outcome, v_reason)
  on conflict (id) do update
    set claim = excluded.claim, source_ref = excluded.source_ref, kind = excluded.kind,
        actor_kind = excluded.actor_kind, actor_id = excluded.actor_id,
        valid_from = excluded.valid_from,
        -- CARRIED, and the probe is why. Without it `new.seq` equals `old.seq`
        -- on every upsert, so the trigger below — which tells a replay from a
        -- rewrite by exactly that difference — could never see one. The floor
        -- was installed, the trigger existed, and it was unreachable.
        seq = excluded.seq,
        category = excluded.category,
        about_namespace = excluded.about_namespace,
        about_key = excluded.about_key,
        occurrence_id = excluded.occurrence_id,
        supersedes_requested = excluded.supersedes_requested,
        correction_outcome = excluded.correction_outcome,
        correction_reason = excluded.correction_reason
    where memory_facts.estate_id = excluded.estate_id;

  if v_outcome = 'superseded' then
    update memory_facts
       set valid_to = e.occurred_at,
           superseded_by = (e.payload->>'id')::uuid
     where id = v_supersedes
       and estate_id = e.estate_id
       and project_id = e.project_id
       and valid_to is null;
  end if;
end $$;


revoke execute on function apply_memory_facts(journal) from public, anon, authenticated, service_role;

-- ── the projector: the task lifecycle ───────────────────────────────────────
--
-- Migration 33's body. Changed: the four upserts carry the estate predicate.

create or replace function apply_task_lifecycle_base(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  case e.type
    when 'task.started@1' then
      insert into project_tasks (id, estate_id, project_id, instruction, option_id,
                                 session_id, preset, started_at, seq)
      values ((e.payload->>'id')::uuid, e.estate_id, e.project_id,
              e.payload->>'instruction', e.payload->>'option_id',
              nullif(e.payload->>'session_id', '')::uuid,
              e.payload->>'preset', e.occurred_at, e.seq)
      on conflict (id) do update
        set instruction = excluded.instruction, option_id = excluded.option_id,
            session_id = excluded.session_id, preset = excluded.preset
        where project_tasks.estate_id = excluded.estate_id;
    when 'task.session.attached@1' then
      update project_tasks
        set session_id = (e.payload->>'session_id')::uuid
        where id = (e.payload->>'id')::uuid
             and estate_id = e.estate_id;
    when 'task.finished@1' then
      update project_tasks
        set status = 'finished',
            exit_code = nullif(e.payload->>'exit_code', '')::integer,
            finished_at = e.occurred_at
        where id = (e.payload->>'id')::uuid
             and estate_id = e.estate_id;
    when 'task.abandoned@1' then
      update project_tasks
        set status = 'abandoned',
            abandoned_reason = coalesce(e.payload->>'reason', 'unknown'),
            finished_at = e.occurred_at
        where id = (e.payload->>'id')::uuid and status = 'open'
             and estate_id = e.estate_id;
    when 'agent.stage.reported@1' then
      insert into agent_stages (session_id, estate_id, project_id, task_id, stage,
                                step, of_steps, note, reported_at, seq)
      values ((e.payload->>'session_id')::uuid, e.estate_id, e.project_id,
              nullif(e.payload->>'task_id', '')::uuid,
              e.payload->>'stage',
              nullif(e.payload->>'step', '')::integer,
              nullif(e.payload->>'of_steps', '')::integer,
              e.payload->>'note', e.occurred_at, e.seq)
      on conflict (session_id) do update
        set stage = excluded.stage, step = excluded.step, of_steps = excluded.of_steps,
            note = excluded.note, reported_at = excluded.reported_at, seq = excluded.seq,
            task_id = coalesce(excluded.task_id, agent_stages.task_id)
        where agent_stages.estate_id = excluded.estate_id;
    when 'transcript.captured@1' then
      insert into session_transcripts (session_id, estate_id, project_id, task_id, option_id,
                                       sha256, bytes, lines, truncated, started_at, ended_at,
                                       exit_code, annotation, excerpt, body, seq)
      values ((e.payload->>'session_id')::uuid, e.estate_id, e.project_id,
              nullif(e.payload->>'task_id', '')::uuid,
              e.payload->>'option_id',
              e.payload->>'sha256',
              coalesce((e.payload->>'bytes')::integer, 0),
              coalesce((e.payload->>'lines')::integer, 0),
              coalesce((e.payload->>'truncated')::boolean, false),
              coalesce((e.payload->>'started_at')::timestamptz, e.occurred_at),
              coalesce((e.payload->>'ended_at')::timestamptz, e.occurred_at),
              nullif(e.payload->>'exit_code', '')::integer,
              coalesce(e.payload->>'annotation', ''),
              coalesce(e.payload->>'excerpt', ''),
              coalesce(e.payload->>'body', ''),
              e.seq)
      on conflict (session_id) do update
        set sha256 = excluded.sha256, bytes = excluded.bytes, lines = excluded.lines,
            truncated = excluded.truncated, ended_at = excluded.ended_at,
            exit_code = excluded.exit_code, annotation = excluded.annotation,
            excerpt = excluded.excerpt, body = excluded.body, seq = excluded.seq
        where session_transcripts.estate_id = excluded.estate_id;
    when 'context.compiled@1' then
      insert into session_context_packs (session_id, estate_id, project_id, task_id, sha256,
                                         chars, fact_ids, fact_seqs, transcript_ids,
                                         omitted_facts, omitted_transcripts, compiled_at, seq)
      values ((e.payload->>'session_id')::uuid, e.estate_id, e.project_id,
              nullif(e.payload->>'task_id', '')::uuid,
              e.payload->>'sha256',
              coalesce((e.payload->>'chars')::integer, 0),
              coalesce((select array_agg(value::uuid) from jsonb_array_elements_text(e.payload->'fact_ids')), '{}'),
              coalesce((select array_agg(value::bigint) from jsonb_array_elements_text(e.payload->'fact_seqs')), '{}'),
              coalesce((select array_agg(value::uuid) from jsonb_array_elements_text(e.payload->'transcript_ids')), '{}'),
              coalesce((e.payload->>'omitted_facts')::integer, 0),
              coalesce((e.payload->>'omitted_transcripts')::integer, 0),
              e.occurred_at, e.seq)
      on conflict (session_id) do update
        set sha256 = excluded.sha256, chars = excluded.chars,
            fact_ids = excluded.fact_ids, fact_seqs = excluded.fact_seqs,
            transcript_ids = excluded.transcript_ids,
            omitted_facts = excluded.omitted_facts,
            omitted_transcripts = excluded.omitted_transcripts,
            compiled_at = excluded.compiled_at, seq = excluded.seq
        where session_context_packs.estate_id = excluded.estate_id;
    else
      null;
  end case;
end $$;

revoke execute on function apply_task_lifecycle_base(journal) from public, anon, authenticated, service_role;

-- ── schema 70 as a private-archive source ───────────────────────────────────
--
-- ADR-0079 decision 5: a later schema is a source only once it is qualified,
-- and migrations 67, 68 and 69 each did it for their own number. Migration 70
-- changes no archived table and registers no event type — it adds a guard at
-- the door and estate predicates to the projector — so a schema-70 journal has
-- exactly the shape of a schema-69 one. Left unqualified, an export taken at
-- schema 70 would still say `source_schema_version: 69`, a false statement
-- about its own origin. An export now names 70; import accepts 66 to 70. The
-- bodies are migration 69's, changed only at those two points.
create or replace function ceo_private_archive_canonical(a jsonb) returns text language plpgsql immutable set search_path=public as $$
declare m jsonb:=a->'estate_archive';x jsonb;r jsonb;envelope text;vals text[];v text;result text:='';
begin
 if not ceo_archive_keys(a,array['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest']) then
  perform ceo_archive_fail('invalid_archive'); end if;
 if a->>'schema' is distinct from 'CeoPrivateArchive@1' or not coalesce(a->'source_schema_version' in ('66'::jsonb,'67'::jsonb,'68'::jsonb,'69'::jsonb,'70'::jsonb),false) then perform ceo_archive_fail('unsupported_schema'); end if;
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

  v_archive:=jsonb_build_object('schema','CeoPrivateArchive@1','archive_id',gen_random_uuid(),'source_schema_version',70,'owner_person_id',p_person_id,
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

-- #endregion estate-owned-identity
