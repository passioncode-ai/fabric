-- Migration 12 — M48: a contradiction annotates, it does not delete (ADR-0032 §4).
--
-- Project memory had one time on it: when a fact was recorded. That is enough to
-- say what was written and useless for saying what was TRUE, and the two come
-- apart the moment anything changes. "The build runs on Node 22" recorded in
-- June and "the build runs on Node 24" recorded in August are not a conflict to
-- resolve — they are one fact with a history, and a store that keeps only the
-- latest cannot answer "what did this project believe in June", which is exactly
-- the question a person asks when reading a three-month-old transcript.
--
-- Two times, therefore: `recorded_at` (when we learned it) stays, and
-- `valid_from` / `valid_to` (when it was true) arrive. A later fact CLOSES the
-- earlier one's window and links to it. Nothing is deleted and nothing is
-- overwritten, so every correction is reversible and every supersession is
-- visible as an act rather than as an absence.
--
-- The alternative — updating the row in place — loses the earlier claim, and
-- loses it silently: the projection would look tidy and the journal would still
-- hold the truth nobody could see. That is the failure mode of every memory
-- system that resolves contradictions by writing over them.

alter table memory_facts add column valid_from    timestamptz;
alter table memory_facts add column valid_to      timestamptz;
alter table memory_facts add column superseded_by uuid;

-- Everything already recorded was true from the moment it was written and has
-- not been contradicted. That is a statement, not a guess: nothing until now
-- could express a supersession, so none exists.
update memory_facts set valid_from = recorded_at where valid_from is null;

alter table memory_facts alter column valid_from set not null;
alter table memory_facts alter column valid_from set default now();

-- A closed window needs the fact that closed it, and an open one must not have
-- one. Without this a row could claim to be superseded by nothing.
alter table memory_facts add constraint memory_facts_supersession_shape
  check ((valid_to is null and superseded_by is null)
      or (valid_to is not null and superseded_by is not null));

-- The index that serves the default read: what is true NOW.
create index memory_facts_current on memory_facts(project_id, recorded_at desc)
  where valid_to is null;

comment on column memory_facts.valid_to is
  'When this stopped being true. Null means it still is. Never set without '
  'superseded_by — a fact does not expire on its own, something replaces it.';

create or replace function apply_projections(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_next_primary uuid;
  v_supersedes   uuid;
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

      -- A fact that replaces another closes its window rather than removing it
      -- (ADR-0032 §4). Scoped to the same project, so a supersession cannot
      -- reach across projects, and only ever closes a window that is still open:
      -- replaying must not rewrite which fact did the closing.
      v_supersedes := nullif(e.payload->>'supersedes', '')::uuid;
      if v_supersedes is not null then
        update memory_facts
           set valid_to = e.occurred_at,
               superseded_by = (e.payload->>'id')::uuid
         where id = v_supersedes
           and project_id = e.project_id
           and valid_to is null;
      end if;
    else
      null;
  end case;
end $$;

revoke execute on function apply_projections(journal) from public;
revoke execute on function apply_projections(journal) from anon, authenticated, service_role;

-- The strip counts what is CURRENTLY true, and separately what has been
-- superseded — a project with a long tail of corrected facts is a project that
-- learned something, not one with a bloated store.
drop function if exists project_stats(uuid);

create function project_stats(p_project_id uuid)
returns table (
  repos             integer,
  memory_facts      integer,
  memory_superseded integer,
  transcripts       integer,
  transcript_chars  bigint,
  retrievals        integer,
  retrieval_misses  integer,
  events            integer,
  last_activity_at  timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select count(*)::integer from project_repos       where project_id = p_project_id),
    (select count(*)::integer from memory_facts        where project_id = p_project_id and valid_to is null),
    (select count(*)::integer from memory_facts        where project_id = p_project_id and valid_to is not null),
    (select count(*)::integer from session_transcripts where project_id = p_project_id),
    (select coalesce(sum(bytes), 0)::bigint from session_transcripts where project_id = p_project_id),
    (select count(*)::integer from memory_retrievals   where project_id = p_project_id),
    (select count(*)::integer from memory_retrievals   where project_id = p_project_id and hits = 0),
    (select count(*)::integer from journal             where project_id = p_project_id),
    (select max(occurred_at)  from journal             where project_id = p_project_id)
$$;

revoke execute on function project_stats(uuid) from public;
grant  execute on function project_stats(uuid) to authenticated, service_role;
