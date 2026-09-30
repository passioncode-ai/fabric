-- The Board's authored half (M148, ADR-0035).
--
-- Two kinds of thing reach the Board and must never share a record, because they
-- end differently: a DERIVED obligation (in review, refused, abandoned) leaves
-- when the state changes and can never be marked read; an AUTHORED question
-- resolves only when an answer is recorded, and the answer must reach whoever
-- continues the work. `attention.ts` already computes the derived half. This
-- migration is the authored half — the only new table the Board needs — plus the
-- blocking it causes, held as COLUMNS on the task rather than a rung of the
-- ladder.
--
-- Why blocked is a flag, not a status: a task blocked in `running` is running
-- work that stopped; a task blocked in `backlog` is work that must not be picked
-- up. A single `blocked` status could express neither, and it would let a task
-- leave `running` by being blocked, after which "how much is running" stops
-- being true.

create table questions (
  id            uuid primary key,
  estate_id     uuid not null,
  project_id    uuid not null,
  task_id       uuid,
  text          text not null,
  why_blocked   text,
  options       jsonb,
  kind          text not null default 'decision'
                check (kind in ('decision','access','priority','fact','approval')),
  -- The subject as a stable key ('db.version', 'deploy.window'): the whole
  -- mechanism by which a CEO with no model settles anything (ADR-0036) — a
  -- decision fact with the same key answers this question by equality.
  about         text,
  asked_by_kind text not null check (asked_by_kind in ('agent','person')),
  asked_by_id   text not null,
  asked_at      timestamptz not null,
  status        text not null default 'open'
                check (status in ('open','answered','withdrawn','stale')),
  -- Assigned by the CEO, never the asker (ADR-0036); the components travel with
  -- it so the order can be explained rather than trusted.
  priority      integer,
  priority_why  jsonb,
  answer          text,
  chosen_option   text,
  answered_by     text,
  answered_by_kind text check (answered_by_kind in ('person','ceo')),
  -- What the CEO cited when it settled this itself. NULL for a person: an
  -- operator's answer needs no basis, and a CEO answer with none is invented.
  settled_basis   jsonb,
  answered_at     timestamptz,
  -- The memory fact the answer became — the route by which the next session is
  -- told (ADR-0035 §4.3). Null until answered.
  decision_id   uuid,
  withdrawn_reason text,
  seq           bigint not null
);
create index questions_project on questions(project_id);
create index questions_estate  on questions(estate_id);
create index questions_open    on questions(estate_id, status) where status = 'open';
create index questions_about    on questions(project_id, about) where about is not null;

-- One question can block several tasks; "what is blocked" is asked far more
-- often than "what did this block", so the join lives in its own table.
create table question_blocks (
  question_id uuid not null,
  task_id     uuid not null,
  primary key (question_id, task_id)
);
create index question_blocks_task on question_blocks(task_id);

-- Blocking is a fact about the world, not a rung. Two columns, not a status.
alter table project_tasks add column blocked_by uuid;
alter table project_tasks add column blocked_since timestamptz;

-- ── the projector, one per-concern function called from the dispatcher (M97) ──
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
        insert into question_blocks (question_id, task_id)
        values ((e.payload->>'id')::uuid, t) on conflict do nothing;
        update project_tasks
           set blocked_by = coalesce(blocked_by, (e.payload->>'id')::uuid),
               blocked_since = coalesce(blocked_since, e.occurred_at)
         where id = t;
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
       where id = (e.payload->>'id')::uuid and status = 'open';

      -- Unblock every task this question held, but only where THIS question is
      -- the one recorded as blocking it: another open question may still hold it.
      update project_tasks pt
         set blocked_by = null, blocked_since = null
       where pt.blocked_by = (e.payload->>'id')::uuid;

    when 'question.withdrawn@1' then
      update questions
         set status = 'withdrawn', withdrawn_reason = e.payload->>'reason'
       where id = (e.payload->>'id')::uuid and status = 'open';
      update project_tasks pt
         set blocked_by = null, blocked_since = null
       where pt.blocked_by = (e.payload->>'id')::uuid;

    when 'question.prioritised@1' then
      update questions
         set priority = (e.payload->>'priority')::int,
             priority_why = e.payload->'components'
       where id = (e.payload->>'id')::uuid;

    else
      null;
  end case;
end;
$$;

create or replace function apply_projections(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform apply_projections_legacy(e);
  perform apply_operating_surfaces(e);
  perform apply_move_provenance(e);
  perform apply_project_servers(e);
  perform apply_created_agents(e);
  perform apply_routines(e);
  perform apply_proposals(e);
  perform apply_handoffs(e);
  perform apply_link_needs(e);
  perform apply_questions(e);
end;
$$;

-- Grants and RLS in the shape migration 4 set — the P21 lesson: a missing grant
-- looks exactly like an empty table, and a fresh table inherits neither.
alter table questions       enable row level security;
alter table question_blocks enable row level security;

create policy member_questions_read on questions
  for select to authenticated
  using (estate_id in (select member_estates()));

create policy member_question_blocks_read on question_blocks
  for select to authenticated
  using (question_id in (select id from questions where estate_id in (select member_estates())));

grant select on questions, question_blocks to authenticated;
grant select, insert, update, delete on questions       to service_role;
grant select, insert, update, delete on question_blocks to service_role;

revoke execute on function apply_questions(journal) from public;
revoke execute on function apply_questions(journal) from anon, authenticated, service_role;
revoke execute on function apply_projections(journal) from public;
revoke execute on function apply_projections(journal) from anon, authenticated, service_role;

-- The event types this migration introduces (the registry gates unknown types).
insert into event_types (type, projects, note) values
  ('question.asked@1',       true, 'an agent asks the owner a question it is not entitled to answer, blocking named tasks (M148)'),
  ('question.answered@1',    true, 'the operator or the CEO records an answer; blocked tasks unblock'),
  ('question.withdrawn@1',   true, 'a question is retired — worked out, or its blocked work is gone — with a reason'),
  ('question.prioritised@1', true, 'the CEO assigns a priority with the components that produced it')
on conflict (type) do nothing;
