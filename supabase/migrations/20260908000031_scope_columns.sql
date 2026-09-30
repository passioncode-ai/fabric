-- The scope floor reaches the two tables that could not be narrowed (S02.a).
--
-- MEASURED: 23 of the 26 projection tables already carry `estate_id`. Two do
-- not, and they are the two the new scope map could not express —
--
--   goals            carries project_id only
--   question_blocks  carries neither; it is (question_id, task_id) and nothing else
--
-- A join table with no owner is not a small omission. `question_blocks` is
-- written from an AGENT-SUPPLIED array (`payload->'blocks'`), so without an
-- owning estate the only thing standing between one estate's question and
-- another estate's task is that nobody has tried.
--
-- The backfill derives ownership from the authoritative parent — a goal's
-- project, a block's question — and then `set not null` does the asserting. A
-- row that failed to map fails the migration, which is the loud version of the
-- alternative: silently dropping the rows that did not join and calling the
-- result a clean backfill.

alter table goals add column if not exists estate_id uuid;

update goals g
   set estate_id = p.estate_id
  from projects p
 where p.id = g.project_id
   and g.estate_id is null;

alter table goals alter column estate_id set not null;
create index if not exists goals_estate on goals(estate_id);

alter table question_blocks add column if not exists estate_id  uuid;
alter table question_blocks add column if not exists project_id uuid;

update question_blocks qb
   set estate_id  = q.estate_id,
       project_id = q.project_id
  from questions q
 where q.id = qb.question_id
   and qb.estate_id is null;

alter table question_blocks alter column estate_id  set not null;
alter table question_blocks alter column project_id set not null;
create index if not exists question_blocks_estate on question_blocks(estate_id, project_id);

-- The policy can now say what it means directly. The subquery form was correct
-- and cost a scan of `questions` per row to answer a question the row itself
-- can answer once the column exists.
drop policy if exists member_question_blocks_read on question_blocks;
create policy member_question_blocks_read on question_blocks
  for select to authenticated
  using (estate_id in (select member_estates()));

-- ————————————————————————————————————————————————— the goal arm moves out
--
-- `goal.defined@1` lived inside `apply_operating_surfaces`, and the arm has to
-- change to fill the new column. Per the standing rule the projector is extended
-- by ADDING a function rather than by rewriting a monolith, so the arm becomes
-- one, and `apply_operating_surfaces` below is its previous body with that arm
-- removed — extracted by script rather than retyped, because M97 is the record
-- of what retyping a projector body costs.

create or replace function apply_goals(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  case e.type
    when 'goal.defined@1' then
      insert into goals (id, estate_id, project_id, title, autonomy)
      values ((e.payload->>'id')::uuid, e.estate_id, e.project_id, e.payload->>'title',
              coalesce(e.payload->>'autonomy', 'safe'))
      on conflict (id) do nothing;
    else
      null;
  end case;
end;
$$;

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
      update project_tasks set status = 'running' where id = (e.payload->>'id')::uuid and status = 'open';
    when 'task.finished@1' then
      update project_tasks set status = 'done' where id = (e.payload->>'id')::uuid and status = 'finished';
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
          and status in ('abandoned','backlog','running','review');

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
        where id = (e.payload->>'task_id')::uuid;
    when 'task.moved@1' then
      update project_tasks set status = e.payload->>'to'
        where id = (e.payload->>'task_id')::uuid
          and status in ('backlog','running','review','done','cancelled');
    when 'task.closed@1' then
      update project_tasks
        set status = case when e.payload->>'outcome' = 'done' then 'done' else 'cancelled' end,
            closed_reason = e.payload->>'reason',
            finished_at = e.occurred_at
        where id = (e.payload->>'task_id')::uuid;
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
        where id = (e.payload->>'note_id')::uuid and promoted_fact_id is null;
    when 'task.brief.edited@1' then
      update project_tasks
        set brief_what     = case when e.payload->>'section' = 'what'     then e.payload->>'body_md' else brief_what end,
            brief_why      = case when e.payload->>'section' = 'why'      then e.payload->>'body_md' else brief_why end,
            brief_expected = case when e.payload->>'section' = 'expected' then e.payload->>'body_md' else brief_expected end,
            brief_author   = (e.actor->>'kind') || ':' || (e.actor->>'id'),
            brief_draft    = case when brief_draft is null and e.actor->>'kind' = 'agent'
                                  then jsonb_build_object('section', e.payload->>'section', 'body_md', e.payload->>'body_md')
                                  else brief_draft end
        where id = (e.payload->>'task_id')::uuid;

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
          and owner_session = (e.payload->>'owner')::uuid;
    when 'work.released@1' then
      delete from leases
        where work_id = (e.payload->>'work')::uuid
          and owner_session = (e.payload->>'owner')::uuid;

    when 'task.prioritised@1' then
      update project_tasks
        set goal_id = (e.payload->>'goal_id')::uuid,
            position = (e.payload->>'position')::integer
        where id = (e.payload->>'task_id')::uuid;

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
-- ————————————————————————————————————————————————— the block arm gains an owner
--
-- Two changes, and the second is the one that matters. The insert fills the new
-- columns from the QUESTION — its parent — so the join table can never disagree
-- with the row it hangs off. And the task is JOINED inside the event's own
-- estate rather than merely named: `blocks[]` is agent-supplied, and matching on
-- the id alone would let a question in one estate freeze work in another.
--
-- The join is what makes the row honest rather than just labelled. Adding the
-- predicate to the `update` alone was tried and watched: the block row was still
-- written, carrying THIS estate's id and pointing at another estate's task — a
-- row that blocks nothing, in a table whose whole purpose is to say what is
-- blocked. A block row now exists only where it can actually block.

create or replace function apply_questions(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  t uuid;
begin
  case e.type
    when 'question.asked@1' then
      insert into questions (id, estate_id, project_id, task_id, text, why_blocked,
                             options, kind, about, asked_by_kind, asked_by_id,
                             asked_at, status, seq)
      values ((e.payload->>'id')::uuid, e.estate_id, (e.payload->>'project_id')::uuid,
              nullif(e.payload->>'task_id','')::uuid,
              e.payload->>'text', e.payload->>'why_blocked',
              e.payload->'options',
              coalesce(e.payload->>'kind','decision'),
              nullif(e.payload->>'about',''),
              coalesce(e.actor->>'kind','agent'),
              coalesce(e.actor->>'id','unknown'),
              e.occurred_at, 'open', e.seq)
      on conflict (id) do nothing;

      -- Block every task the question names, and record the link. `blocked_by`
      -- carries the FIRST question to block a task; the join table carries all.
      for t in select jsonb_array_elements_text(coalesce(e.payload->'blocks','[]'::jsonb))::uuid
      loop
        insert into question_blocks (question_id, task_id, estate_id, project_id)
        select q.id, pt.id, q.estate_id, q.project_id
          from questions q
          join project_tasks pt on pt.id = t and pt.estate_id = e.estate_id
         where q.id = (e.payload->>'id')::uuid
        on conflict do nothing;
        update project_tasks
           set blocked_by = coalesce(blocked_by, (e.payload->>'id')::uuid),
               blocked_since = coalesce(blocked_since, e.occurred_at)
         where id = t and estate_id = e.estate_id;
      end loop;

    when 'question.answered@1' then
      update questions
         set status = 'answered',
             answer = e.payload->>'answer',
             chosen_option = nullif(e.payload->>'chosen_option',''),
             answered_by = coalesce(e.payload->>'answered_by', e.actor->>'id'),
             answered_by_kind = coalesce(e.payload->>'answered_by_kind', 'person'),
             settled_basis = e.payload->'settled_basis',
             decision_id = nullif(e.payload->>'decision_id','')::uuid,
             answered_at = e.occurred_at
       where id = (e.payload->>'id')::uuid and status = 'open' and estate_id = e.estate_id;

      -- Unblock every task this question held, but only where THIS question is
      -- the one recorded as blocking it: another open question may still hold it.
      update project_tasks pt
         set blocked_by = null, blocked_since = null
       where pt.blocked_by = (e.payload->>'id')::uuid and pt.estate_id = e.estate_id;

    when 'question.withdrawn@1' then
      update questions
         set status = 'withdrawn', withdrawn_reason = e.payload->>'reason'
       where id = (e.payload->>'id')::uuid and status = 'open' and estate_id = e.estate_id;
      update project_tasks pt
         set blocked_by = null, blocked_since = null
       where pt.blocked_by = (e.payload->>'id')::uuid and pt.estate_id = e.estate_id;

    when 'question.prioritised@1' then
      update questions
         set priority = (e.payload->>'priority')::int,
             priority_why = e.payload->'components'
       where id = (e.payload->>'id')::uuid and estate_id = e.estate_id;

    else
      null;
  end case;
end;
$$;

-- The dispatcher gains the new function where the arm used to run: after the
-- lifecycle base, in the same place `apply_operating_surfaces` sits, so replay
-- order is unchanged.
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
end;
$$;

revoke execute on function apply_goals(journal) from public;
revoke execute on function apply_goals(journal) from anon, authenticated, service_role;
revoke execute on function apply_operating_surfaces(journal) from public;
revoke execute on function apply_operating_surfaces(journal) from anon, authenticated, service_role;
revoke execute on function apply_questions(journal) from public;
revoke execute on function apply_questions(journal) from anon, authenticated, service_role;
revoke execute on function apply_projections(journal) from public;
revoke execute on function apply_projections(journal) from anon, authenticated, service_role;
