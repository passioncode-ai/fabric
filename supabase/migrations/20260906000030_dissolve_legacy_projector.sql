-- One projector, not ten copies (M97).
--
-- `apply_projections_legacy` was the pre-0016 monolith, renamed rather than
-- dissolved: 211 lines and 15 arms that nine migrations had rewritten whole,
-- while every NEW concern correctly went into its own function off the
-- dispatcher. This migration finishes that move. The arms below are copied
-- BYTE-IDENTICAL from the LAST legacy body — 20260901000014, not 0012, and it
-- carries SIXTEEN arms rather than the fifteen an inventory of 0012 counts.
-- Both errors were caught by probes within a minute of each other: taking 0012
-- dropped the rule that an agent may not supersede a PERSON's fact (P18 red),
-- and the arm count missed `context.compiled@1`, added by 0013. Fifteen
-- migrations redefine `apply_projections`; "the latest" is a thing to measure,
-- never to assume. Behaviour is the
-- thing this migration must not change, and the proof is P24 plus the full
-- planted suite passing unchanged.
--
-- THE OVERLAP INVENTORY, measured before splitting (the brief's step 1):
-- twelve arms live only in legacy; THREE event types are handled by BOTH legacy
-- and `apply_operating_surfaces` — task.started@1, task.finished@1,
-- task.abandoned@1 — and 0016's own comments record that both-run semantics as
-- deliberate (the legacy arm guards on statuses that no longer occur at rest,
-- and the operating-surfaces arm is the live one). The dispatcher therefore
-- calls the three new functions FIRST, exactly where the legacy call stood, so
-- for the overlapped events the base arm still runs before operating_surfaces.
--
-- `apply_projections_legacy` is DROPPED rather than left callable-but-empty:
-- no caller remains, and an empty function with a load-bearing name is a place
-- somebody edits believing it runs.

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
        update project_repos set is_primary = true where id = (e.payload->>'id')::uuid;
      end if;
      update projects
        set repo_path = (select path from project_repos
                          where project_id = e.project_id and is_primary limit 1)
        where id = e.project_id;
    when 'project.repo.detached@1' then
      delete from project_repos where id = (e.payload->>'id')::uuid and project_id = e.project_id;
      if not exists (select 1 from project_repos where project_id = e.project_id and is_primary) then
        select id into v_next_primary from project_repos
          where project_id = e.project_id order by attached_at limit 1;
        if v_next_primary is not null then
          update project_repos set is_primary = true where id = v_next_primary;
        end if;
      end if;
      update projects
        set repo_path = (select path from project_repos
                          where project_id = e.project_id and is_primary limit 1)
        where id = e.project_id;
    else
      null;
  end case;
end $$;

revoke execute on function apply_estate_and_projects(journal) from public;
revoke execute on function apply_estate_and_projects(journal) from anon, authenticated, service_role;

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
        where id = (e.payload->>'id')::uuid;
    when 'task.finished@1' then
      update project_tasks
        set status = 'finished',
            exit_code = nullif(e.payload->>'exit_code', '')::integer,
            finished_at = e.occurred_at
        where id = (e.payload->>'id')::uuid;
    when 'task.abandoned@1' then
      update project_tasks
        set status = 'abandoned',
            abandoned_reason = coalesce(e.payload->>'reason', 'unknown'),
            finished_at = e.occurred_at
        where id = (e.payload->>'id')::uuid and status = 'open';
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

revoke execute on function apply_task_lifecycle_base(journal) from public;
revoke execute on function apply_task_lifecycle_base(journal) from anon, authenticated, service_role;

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
           and not (memory_facts.actor_kind = 'person' and e.actor->>'kind' = 'agent');
      end if;
    else
      null;
  end case;
end $$;

revoke execute on function apply_memory_facts(journal) from public;
revoke execute on function apply_memory_facts(journal) from anon, authenticated, service_role;

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
  perform apply_move_provenance(e);
  perform apply_project_servers(e);
  perform apply_created_agents(e);
  perform apply_routines(e);
  perform apply_proposals(e);
  perform apply_handoffs(e);
  perform apply_link_needs(e);
  perform apply_questions(e);
  perform apply_priority(e);
end;
$$;

revoke execute on function apply_projections(journal) from public;
revoke execute on function apply_projections(journal) from anon, authenticated, service_role;

drop function apply_projections_legacy(journal);
