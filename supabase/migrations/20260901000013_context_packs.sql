-- Migration 13 — M49: one entrance to the model, and a lockfile of what went in.
--
-- `federation.md` §5 has said this since the federation was designed: memory
-- reaches a model only through a compiled bundle, bounded and cited, "so one
-- entrance carries one supply-chain gate and the lockfile pins what the agent
-- knew". Nothing implemented it. Agents pulled memory themselves, whenever they
-- thought to, in whatever quantity matched — which means the answer to "what did
-- this agent know when it said that" was: nobody recorded it, and it is not
-- recoverable.
--
-- That question is not academic. Every judgement about an agent's output — was
-- it wrong, was it under-informed, did memory fail it — is unanswerable without
-- it, and it cannot be reconstructed later because the store has moved on. A
-- fact recorded an hour after the session cannot be told apart from one the
-- session had, unless something wrote down which it had.
--
-- So: at spawn, one pack is compiled and handed to the session, and this table
-- is the lockfile. It records WHICH facts and WHICH transcripts went in, by id
-- and by journal seq, plus the sha256 of the text actually written. It does not
-- store the pack itself — the pack is derivable from the ids, and storing both
-- would create two representations with one hash between them (the same reason
-- transcripts keep no raw stream, migration 8).

create table session_context_packs (
  session_id   uuid primary key,
  estate_id    uuid not null,
  project_id   uuid not null,
  task_id      uuid,
  -- The content address of the text the session was actually given.
  sha256       text not null,
  chars        integer not null,
  -- The lockfile proper: exactly what was in it, citable back to the journal.
  fact_ids     uuid[] not null default '{}',
  fact_seqs    bigint[] not null default '{}',
  transcript_ids uuid[] not null default '{}',
  -- What was left out because the budget ran out. A pack that silently truncates
  -- is a pack that lies about being the project's memory.
  omitted_facts       integer not null default 0,
  omitted_transcripts integer not null default 0,
  compiled_at  timestamptz not null default now(),
  seq          bigint not null
);

create index session_context_packs_project on session_context_packs(project_id, compiled_at desc);
create index session_context_packs_estate  on session_context_packs(estate_id);

alter table session_context_packs enable row level security;

create policy member_packs_read on session_context_packs
  for select to authenticated
  using (estate_id in (select member_estates()));

revoke all on session_context_packs from anon;
grant select on session_context_packs to authenticated;
grant select, insert, update, delete on session_context_packs to service_role;

insert into event_types (type, projects, note) values
  ('context.compiled@1', true,
   'the lockfile: exactly what memory a session was handed, by id and by seq, before it did anything');

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
           and valid_to is null;
      end if;
    else
      null;
  end case;
end $$;

revoke execute on function apply_projections(journal) from public;
revoke execute on function apply_projections(journal) from anon, authenticated, service_role;
