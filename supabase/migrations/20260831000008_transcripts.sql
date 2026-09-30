-- Migration 8 — transcripts: the first memory work, and the one ADR-0032 puts
-- ahead of everything else.
--
-- Until now the only durable account of what a session did was the AGENT'S OWN
-- CLAIM (`agent_stages`). The thing Fabric observes — the session's actual
-- output — lived in main-process memory, capped at 400 000 characters, and died
-- with the app. ADR-0008 hosted the terminal so progress could be read rather
-- than believed; keeping only the claim inverted that the moment the app quit.
--
-- ADR-0032 puts verbatim text first for a measured reason: holding model,
-- retriever, reranker and judge fixed and varying only the representation,
-- verbatim chunks beat LLM-extracted artifacts by 16–22 points (arXiv:2601.00821).
-- So nothing here summarises, extracts or judges. The three tiers are mechanical:
--
--   L0 `annotation` — one line, composed from facts (agent, duration, size, exit)
--   L1 `excerpt`    — a bounded head and tail of the real text, never a summary
--   L2 `body`       — the whole thing, unaltered
--
-- WHY THE INDEX IS BOUNDED AND THE COLUMN IS NOT. The projector runs inside the
-- append transaction (ADR-0027), so a projector that throws rolls back the event
-- as well — losing the transcript AND the session's exit record. `to_tsvector`
-- throws 54000 above 1 048 575 bytes of output. Measured on this stack with
-- high-entropy text: 400 000 chars -> 491 164 bytes; 900 000 -> 1 105 182;
-- 2 000 000 -> FAILS. Real transcripts repeat paths and words far more than that
-- test did, but an append transaction is the wrong place to bet on it, so the
-- index covers the first 400 000 characters — a margin of more than two — while
-- `body` keeps everything. Full-text search over the tail of a very long session
-- is a measured, later problem; silently losing a session's record is not.

create table session_transcripts (
  session_id  uuid primary key,
  estate_id   uuid not null,
  project_id  uuid not null,
  task_id     uuid,
  option_id   text,
  -- The content address. Nothing reads it yet; it is here from day one so that
  -- moving L2 into content-addressed blob storage later (federation.md §5) needs
  -- no new event type and no migration of history.
  sha256      text not null,
  bytes       integer not null,
  lines       integer not null,
  truncated   boolean not null default false,
  started_at  timestamptz not null,
  ended_at    timestamptz not null,
  exit_code   integer,
  annotation  text not null,
  excerpt     text not null,
  body        text not null,
  search      tsvector generated always as (to_tsvector('english', left(body, 400000))) stored,
  seq         bigint not null
);

create index session_transcripts_project on session_transcripts(project_id, ended_at desc);
create index session_transcripts_estate  on session_transcripts(estate_id);
create index session_transcripts_search  on session_transcripts using gin(search);
create index session_transcripts_sha     on session_transcripts(sha256);

alter table session_transcripts enable row level security;

create policy member_transcripts_read on session_transcripts
  for select to authenticated
  using (estate_id in (select member_estates()));

revoke all on session_transcripts from anon;
grant select on session_transcripts to authenticated;
grant select, insert, update, delete on session_transcripts to service_role;

insert into event_types (type, projects, note) values
  ('transcript.captured@1', true,
   'the whole output of one session, verbatim — the OBSERVATION beside agent_stages'' claim');

create or replace function apply_projections(e journal)
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
    when 'agent.stage.reported@1' then
      -- One row per session: the latest claim. The history stays in the journal,
      -- which is where a claim's provenance belongs.
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
      -- The OBSERVATION half of the pair agent_stages holds the claim half of.
      -- Upsert on session_id: a session captures once, and a replay converges.
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
    when 'memory.project.recorded@1' then
      insert into memory_facts (id, estate_id, project_id, claim, source_ref, kind, recorded_at, seq)
      values ((e.payload->>'id')::uuid, e.estate_id, e.project_id,
              e.payload->>'claim', e.payload->>'source_ref',
              coalesce(e.payload->>'kind', 'note'), e.occurred_at, e.seq)
      on conflict (id) do update
        set claim = excluded.claim, source_ref = excluded.source_ref, kind = excluded.kind;
    else
      -- Reached only by a type the registry accepted and no projector claims
      -- (terminal.*, project.kickoff@1 — the feed reads those directly).
      null;
  end case;
end $$;

revoke execute on function apply_projections(journal) from public;
revoke execute on function apply_projections(journal) from anon, authenticated, service_role;
