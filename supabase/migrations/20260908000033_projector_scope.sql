-- The projector narrows by estate too (CO-110, ADR-0049).
--
-- PROVEN BEFORE IT WAS FIXED, because a boundary nobody has crossed is a story:
--
--   estate B: task bbbb…ff is running
--   estate A: append task.abandoned@1 with payload {"id": "bbbb…ff"}
--   estate B: task bbbb…ff is now cancelled, carrying A's reason
--
-- 26 mutating statements across eight projector functions matched a row by a UUID
-- taken from `e.payload` with no estate predicate. Twenty-four updates and two
-- deletes; every one of them ends in a WHERE clause, so every one of them gains
-- the same line.
--
-- WHY THIS IS NOT COVERED BY VALIDATING THE WRITER. Under ADR-0014 a projection
-- is derived, and `rebuild_estate_projections(A)` replays A's journal with no
-- writer present at all. A rebuild is supposed to be a pure function of one
-- estate's events; while an arm matches on a bare id it is a function of every
-- estate's rows. The floor cannot be the caller's diligence — vision claim 2:
-- the floor lives in the database, and it is broken the moment it turns out to
-- live in something that can be reasoned around.
--
-- Two subqueries are narrowed for the other direction: the write was already
-- confined by the outer predicate, but `select path from project_repos where
-- project_id = …` would still have READ another estate's repository into the
-- value being written.
--
-- Bodies extracted by script from their current definitions rather than retyped
-- (M97's lesson), and `check-scope.mjs` now refuses a projector statement that
-- omits the predicate, so arm twenty-seven cannot.

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
            repo_path = excluded.repo_path,
            memory_backend = excluded.memory_backend,
            default_agent = excluded.default_agent;
    when 'project.updated@1' then
      update projects
        set name      = coalesce(e.payload->>'name', name),
            purpose   = case when e.payload ? 'purpose'   then e.payload->>'purpose'   else purpose end,
            repo_path = case when e.payload ? 'repo_path' then e.payload->>'repo_path' else repo_path end,
            config_revision = config_revision + 1
        where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;
    when 'project.settings.updated@1' then
      update projects
        set memory_backend = coalesce(e.payload->>'memory_backend', memory_backend),
            default_agent  = coalesce(e.payload->>'default_agent', default_agent),
            config_revision = config_revision + 1
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
      on conflict (id) do update set path = excluded.path, label = excluded.label;
      if not exists (select 1 from project_repos where project_id = e.project_id and is_primary) then
        update project_repos set is_primary = true where id = (e.payload->>'id')::uuid
               and estate_id = e.estate_id;
      end if;
      update projects
        set repo_path = (select path from project_repos
                          where project_id = e.project_id and is_primary limit 1)
        where id = e.project_id
             and estate_id = e.estate_id;
    when 'project.repo.detached@1' then
      delete from project_repos where id = (e.payload->>'id')::uuid and project_id = e.project_id
             and estate_id = e.estate_id;
      if not exists (select 1 from project_repos where project_id = e.project_id and is_primary) then
        select id into v_next_primary from project_repos
          where project_id = e.project_id order by attached_at limit 1;
        if v_next_primary is not null then
          update project_repos set is_primary = true where id = v_next_primary
                 and estate_id = e.estate_id;
        end if;
      end if;
      update projects
        set repo_path = (select path from project_repos
                          where project_id = e.project_id and is_primary limit 1)
        where id = e.project_id
             and estate_id = e.estate_id;
    else
      null;
  end case;
end $$;

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
            session_id = excluded.session_id, preset = excluded.preset;
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
            task_id = coalesce(excluded.task_id, agent_stages.task_id);
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
            excerpt = excluded.excerpt, body = excluded.body, seq = excluded.seq;
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
            compiled_at = excluded.compiled_at, seq = excluded.seq;
    else
      null;
  end case;
end $$;

create or replace function apply_memory_facts(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_supersedes   uuid;
begin
  case e.type
    when 'memory.retrieved@1' then
      insert into memory_retrievals (id, estate_id, project_id, session_id, actor_kind,
                                     actor_id, store, query, hits, asked_at, seq)
      values ((e.payload->>'id')::uuid, e.estate_id, e.project_id,
              nullif(e.payload->>'session_id', '')::uuid,
              e.actor->>'kind', e.actor->>'id',
              e.payload->>'store', e.payload->>'query',
              coalesce((e.payload->>'hits')::integer, 0),
              e.occurred_at, e.seq)
      on conflict (id) do nothing;
    when 'memory.project.recorded@1' then
      insert into memory_facts (id, estate_id, project_id, claim, source_ref, kind,
                                actor_kind, actor_id, recorded_at, valid_from, seq)
      values ((e.payload->>'id')::uuid, e.estate_id, e.project_id,
              e.payload->>'claim', e.payload->>'source_ref',
              coalesce(e.payload->>'kind', 'note'),
              e.actor->>'kind', e.actor->>'id',
              e.occurred_at,
              coalesce((e.payload->>'valid_from')::timestamptz, e.occurred_at),
              e.seq)
      on conflict (id) do update
        set claim = excluded.claim, source_ref = excluded.source_ref, kind = excluded.kind,
            actor_kind = excluded.actor_kind, actor_id = excluded.actor_id,
            valid_from = excluded.valid_from;

      v_supersedes := nullif(e.payload->>'supersedes', '')::uuid;
      if v_supersedes is not null then
        update memory_facts
           set valid_to = e.occurred_at,
               superseded_by = (e.payload->>'id')::uuid
         where id = v_supersedes
           and project_id = e.project_id
           and valid_to is null
           -- An agent may supersede an agent; a person may supersede anyone; an
           -- agent may NOT bury what a person recorded. The agent's own claim is
           -- still written above — only the burial is refused, so both sit side
           -- by side and a human decides.
           and not (memory_facts.actor_kind = 'person' and e.actor->>'kind' = 'agent')
               and estate_id = e.estate_id;
      end if;
    else
      null;
  end case;
end $$;

create or replace function apply_operating_surfaces(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  case e.type
    -- the ladder post-fix: the legacy body wrote its old vocabulary a statement
    -- ago in this same transaction; rows never rest with it.
    when 'task.started@1' then
      update project_tasks set status = 'running' where id = (e.payload->>'id')::uuid and status = 'open'
             and estate_id = e.estate_id;
    when 'task.finished@1' then
      update project_tasks set status = 'done' where id = (e.payload->>'id')::uuid and status = 'finished'
             and estate_id = e.estate_id;
    when 'task.abandoned@1' then
      -- Not a mere normalisation: the legacy branch guards on status='open',
      -- which no longer exists at rest, so an orphaned RUNNING task would never
      -- close at all — the reconcile suite caught exactly that. This branch IS
      -- the abandon now; the guard still protects a real outcome from damage.
      update project_tasks
        set status = 'cancelled',
            abandoned_reason = coalesce(abandoned_reason, e.payload->>'reason', 'unknown'),
            closed_reason    = coalesce(closed_reason, abandoned_reason, e.payload->>'reason', 'unknown'),
            finished_at      = coalesce(finished_at, e.occurred_at)
        where id = (e.payload->>'id')::uuid
          and status in ('abandoned','backlog','running','review')
             and estate_id = e.estate_id;

    when 'task.created@1' then
      insert into project_tasks (id, estate_id, project_id, instruction, option_id,
                                 status, title, task_type, section,
                                 origin_kind, origin_ref, started_at, seq)
      values ((e.payload->>'id')::uuid, e.estate_id, e.project_id,
              coalesce(e.payload->>'instruction', e.payload->>'title'),
              coalesce(e.payload->>'option_id', ''),
              'backlog',
              e.payload->>'title', e.payload->>'task_type', e.payload->>'section',
              e.payload->'origin'->>'kind', e.payload->'origin'->>'ref',
              e.occurred_at, e.seq)
      on conflict (id) do nothing;
    when 'task.assigned@1' then
      update project_tasks
        set assigned_by = e.payload->>'assigned_by',
            assigned_to = e.payload->>'assigned_to'
        where id = (e.payload->>'task_id')::uuid
             and estate_id = e.estate_id;
    when 'task.moved@1' then
      update project_tasks set status = e.payload->>'to'
        where id = (e.payload->>'task_id')::uuid
          and status in ('backlog','running','review','done','cancelled')
             and estate_id = e.estate_id;
    when 'task.closed@1' then
      update project_tasks
        set status = case when e.payload->>'outcome' = 'done' then 'done' else 'cancelled' end,
            closed_reason = e.payload->>'reason',
            finished_at = e.occurred_at
        where id = (e.payload->>'task_id')::uuid
             and estate_id = e.estate_id;
    when 'task.linked@1' then
      -- The projector never refuses; see would_close_cycle's header.
      if e.payload->>'target_kind' <> 'task'
         or not would_close_cycle((e.payload->>'task_id')::uuid, (e.payload->>'target_id')::uuid) then
        insert into task_links (estate_id, project_id, task_id, rel, target_kind, target_id, seq)
        values (e.estate_id, e.project_id, (e.payload->>'task_id')::uuid,
                e.payload->>'rel', e.payload->>'target_kind', (e.payload->>'target_id')::uuid, e.seq)
        on conflict do nothing;
      else
        raise warning 'task.linked@1 at seq %: edge % -> % dropped, it closes a cycle',
          e.seq, e.payload->>'task_id', e.payload->>'target_id';
      end if;
    when 'task.note.added@1' then
      insert into task_notes (id, estate_id, project_id, task_id, author_kind, author_id, body_md, seq, created_at)
      values ((e.payload->>'note_id')::uuid, e.estate_id, e.project_id,
              (e.payload->>'task_id')::uuid, e.actor->>'kind', e.actor->>'id',
              e.payload->>'body_md', e.seq, e.occurred_at)
      on conflict (id) do nothing;
    when 'task.note.promoted@1' then
      update task_notes set promoted_fact_id = (e.payload->>'fact_id')::uuid
        where id = (e.payload->>'note_id')::uuid and promoted_fact_id is null
             and estate_id = e.estate_id;
    when 'task.brief.edited@1' then
      update project_tasks
        set brief_what     = case when e.payload->>'section' = 'what'     then e.payload->>'body_md' else brief_what end,
            brief_why      = case when e.payload->>'section' = 'why'      then e.payload->>'body_md' else brief_why end,
            brief_expected = case when e.payload->>'section' = 'expected' then e.payload->>'body_md' else brief_expected end,
            brief_author   = (e.actor->>'kind') || ':' || (e.actor->>'id'),
            brief_draft    = case when brief_draft is null and e.actor->>'kind' = 'agent'
                                  then jsonb_build_object('section', e.payload->>'section', 'body_md', e.payload->>'body_md')
                                  else brief_draft end
        where id = (e.payload->>'task_id')::uuid
             and estate_id = e.estate_id;

    when 'work.claimed@1' then
      insert into leases (work_id, estate_id, project_id, owner_session,
                          idempotency_key, expires_at, write_scopes, claimed_seq)
      values ((e.payload->>'work')::uuid, e.estate_id, e.project_id,
              (e.payload->>'owner')::uuid, e.payload->>'idempotency_key',
              (e.payload->>'expires_at')::timestamptz,
              coalesce(array(select jsonb_array_elements_text(e.payload->'write_scopes')), '{}'),
              e.seq)
      on conflict (work_id) do update
        set owner_session = excluded.owner_session,
            idempotency_key = excluded.idempotency_key,
            expires_at = excluded.expires_at,
            write_scopes = excluded.write_scopes,
            claimed_seq = excluded.claimed_seq
        -- deterministic on replay: the takeover is judged against the event's
        -- own clock, never the wall clock.
        where leases.expires_at <= e.occurred_at;
    when 'work.renewed@1' then
      update leases set expires_at = (e.payload->>'expires_at')::timestamptz
        where work_id = (e.payload->>'work')::uuid
          and owner_session = (e.payload->>'owner')::uuid
             and estate_id = e.estate_id;
    when 'work.released@1' then
      delete from leases
        where work_id = (e.payload->>'work')::uuid
          and owner_session = (e.payload->>'owner')::uuid
             and estate_id = e.estate_id;

    when 'task.prioritised@1' then
      update project_tasks
        set goal_id = (e.payload->>'goal_id')::uuid,
            position = (e.payload->>'position')::integer
        where id = (e.payload->>'task_id')::uuid
             and estate_id = e.estate_id;

    when 'agent.registered@1' then
      -- Still nothing, and step 6 decided so ON PURPOSE rather than deferring
      -- again. The registry is `apps/desktop/src/shared/agents.ts`: code, not
      -- rows, because a row would let an agent be added at runtime and that is
      -- M17's job, which is not scheduled. A table nobody writes to is a schema
      -- pretending to be a feature. Return trigger: the first agent that must
      -- exist without a release.

    else
      null;
  end case;
end;
$$;

create or replace function apply_move_provenance(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if e.payload->>'task_id' is null then return; end if;

  if e.type = 'task.moved@1' then
    update project_tasks
       set moved_by      = e.actor->>'id',
           moved_by_kind = e.actor->>'kind',
           moved_at      = e.occurred_at
     where id = (e.payload->>'task_id')::uuid
       and status = e.payload->>'to'
           and estate_id = e.estate_id;

  elsif e.type = 'task.closed@1' then
    update project_tasks
       set moved_by      = e.actor->>'id',
           moved_by_kind = e.actor->>'kind',
           moved_at      = e.occurred_at
     where id = (e.payload->>'task_id')::uuid
       and status in ('done', 'cancelled')
           and estate_id = e.estate_id;
  end if;
end;
$$;

create or replace function apply_routines(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  case e.type
    when 'routine.defined@1' then
      insert into routines (id, estate_id, project_id, instruction, option_id,
                            every_minutes, kind, created_by, created_at)
      values ((e.payload->>'id')::uuid, e.estate_id, (e.payload->>'project_id')::uuid,
              e.payload->>'instruction', e.payload->>'option_id',
              (e.payload->>'every_minutes')::int,
              coalesce(e.payload->>'kind', 'fixed'),
              e.actor->>'id', e.occurred_at)
      on conflict (id) do nothing;

    when 'routine.ran@1' then
      update routines
         set last_run_at = e.occurred_at, last_task_id = (e.payload->>'task_id')::uuid
       where id = (e.payload->>'id')::uuid
             and estate_id = e.estate_id;

    when 'routine.updated@1' then
      update routines
         set enabled = coalesce((e.payload->>'enabled')::boolean, enabled),
             every_minutes = coalesce((e.payload->>'every_minutes')::int, every_minutes)
       where id = (e.payload->>'id')::uuid
             and estate_id = e.estate_id;

    else
      null;
  end case;
end;
$$;

create or replace function apply_link_needs(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if e.type <> 'task.linked@1' or e.payload->'needs' is null then return; end if;
  update task_links
     set needs = coalesce(
           (select array_agg(value::text order by ordinality)
              from jsonb_array_elements_text(e.payload->'needs')
                   with ordinality as t(value, ordinality)),
           '{}')
   where task_id    = (e.payload->>'task_id')::uuid
     and rel         = e.payload->>'rel'
     and target_kind = e.payload->>'target_kind'
     and target_id   = (e.payload->>'target_id')::uuid
         and estate_id = e.estate_id;
end;
$$;

create or replace function apply_proposals(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  case e.type
    when 'proposal.filed@1' then
      insert into proposals (id, estate_id, project_id, title, origin_kind, origin_ref,
                             from_task_id, depth, bound, proposed_by, created_at)
      values ((e.payload->>'id')::uuid, e.estate_id, (e.payload->>'project_id')::uuid,
              e.payload->>'title', e.payload->'origin'->>'kind', e.payload->'origin'->>'ref',
              nullif(e.payload->>'from_task_id','')::uuid,
              (e.payload->>'depth')::int, (e.payload->>'bound')::int,
              e.actor->>'id', e.occurred_at)
      on conflict (id) do nothing;

    when 'proposal.decided@1' then
      update proposals
         set decided_at = e.occurred_at,
             decision   = e.payload->>'decision',
             task_id    = nullif(e.payload->>'task_id','')::uuid
       where id = (e.payload->>'id')::uuid and decided_at is null
             and estate_id = e.estate_id;

    else
      null;
  end case;
end;
$$;

revoke execute on function apply_estate_and_projects(journal) from public;
revoke execute on function apply_estate_and_projects(journal) from anon, authenticated, service_role;
revoke execute on function apply_task_lifecycle_base(journal) from public;
revoke execute on function apply_task_lifecycle_base(journal) from anon, authenticated, service_role;
revoke execute on function apply_memory_facts(journal) from public;
revoke execute on function apply_memory_facts(journal) from anon, authenticated, service_role;
revoke execute on function apply_operating_surfaces(journal) from public;
revoke execute on function apply_operating_surfaces(journal) from anon, authenticated, service_role;
revoke execute on function apply_move_provenance(journal) from public;
revoke execute on function apply_move_provenance(journal) from anon, authenticated, service_role;
revoke execute on function apply_routines(journal) from public;
revoke execute on function apply_routines(journal) from anon, authenticated, service_role;
revoke execute on function apply_link_needs(journal) from public;
revoke execute on function apply_link_needs(journal) from anon, authenticated, service_role;
revoke execute on function apply_proposals(journal) from public;
revoke execute on function apply_proposals(journal) from anon, authenticated, service_role;
