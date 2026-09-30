-- Migration 11 — M46: what memory was asked, and what it did not answer.
--
-- The doctrine's sentence is the whole reason this table exists: memory that was
-- never queried and empty memory score identically, and only the log tells them
-- apart. Without it "memory is working" is unfalsifiable — a project whose agents
-- never think to search looks exactly like a project whose memory is full and
-- whose search never matches, and both look exactly like a project with good
-- memory that is quietly answering everything.
--
-- The NEGATIVE result is the point, and it is the one a retrieval log usually
-- drops. A hit is self-evident to whoever got it; a miss is invisible to
-- everyone, including the agent, which simply carries on without the thing it
-- did not find. Every retrieval is recorded here whether it matched or not, and
-- `hits = 0` is the row that earns the table.
--
-- Recorded through the journal like everything else, so the same replay that
-- rebuilds memory rebuilds what was asked of it.

create table memory_retrievals (
  id          uuid primary key,
  estate_id   uuid not null,
  project_id  uuid not null,
  -- Which session asked. Null when the operator searched from the interface.
  session_id  uuid,
  actor_kind  text not null,
  actor_id    text,
  -- 'facts' | 'transcripts' — which store was consulted, so a miss can be
  -- attributed to the store that missed rather than to "memory" in general.
  store       text not null check (store in ('facts', 'transcripts')),
  query       text not null,
  hits        integer not null,
  asked_at    timestamptz not null default now(),
  seq         bigint not null
);

create index memory_retrievals_project on memory_retrievals(project_id, asked_at desc);
create index memory_retrievals_estate  on memory_retrievals(estate_id);
-- The index that exists for the question this table was built to answer.
create index memory_retrievals_misses  on memory_retrievals(project_id, asked_at desc)
  where hits = 0;

alter table memory_retrievals enable row level security;

create policy member_retrievals_read on memory_retrievals
  for select to authenticated
  using (estate_id in (select member_estates()));

revoke all on memory_retrievals from anon;
grant select on memory_retrievals to authenticated;
grant select, insert, update, delete on memory_retrievals to service_role;

insert into event_types (type, projects, note) values
  ('memory.retrieved@1', true,
   'memory was asked something — recorded whether it answered or not; hits = 0 is the row that matters');

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
                                actor_kind, actor_id, recorded_at, seq)
      values ((e.payload->>'id')::uuid, e.estate_id, e.project_id,
              e.payload->>'claim', e.payload->>'source_ref',
              coalesce(e.payload->>'kind', 'note'),
              e.actor->>'kind', e.actor->>'id',
              e.occurred_at, e.seq)
      on conflict (id) do update
        set claim = excluded.claim, source_ref = excluded.source_ref, kind = excluded.kind,
            actor_kind = excluded.actor_kind, actor_id = excluded.actor_id;
    else
      null;
  end case;
end $$;

revoke execute on function apply_projections(journal) from public;
revoke execute on function apply_projections(journal) from anon, authenticated, service_role;

-- The strip gains the number this table exists for: how often memory was asked
-- and had nothing. A project where that ratio is high has memory nobody can use;
-- a project where nothing was asked at all has memory nobody thought to use.
-- Those are different problems and the strip could not tell them apart.
-- `create or replace` cannot change a function's OUT parameters (42P13), and the
-- shape below gains two columns. Dropping first is the only way, and it is safe
-- because nothing holds a reference across a migration.
drop function if exists project_stats(uuid);

create function project_stats(p_project_id uuid)
returns table (
  repos             integer,
  memory_facts      integer,
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
    (select count(*)::integer from memory_facts        where project_id = p_project_id),
    (select count(*)::integer from session_transcripts where project_id = p_project_id),
    (select coalesce(sum(bytes), 0)::bigint from session_transcripts where project_id = p_project_id),
    (select count(*)::integer from memory_retrievals   where project_id = p_project_id),
    (select count(*)::integer from memory_retrievals   where project_id = p_project_id and hits = 0),
    (select count(*)::integer from journal             where project_id = p_project_id),
    (select max(occurred_at)  from journal             where project_id = p_project_id)
$$;

revoke execute on function project_stats(uuid) from public;
grant  execute on function project_stats(uuid) to authenticated, service_role;
