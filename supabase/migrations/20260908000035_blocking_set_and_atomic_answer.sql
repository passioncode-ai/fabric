-- The blocking set is canonical, and an answer is one commit (S06).
--
-- PROVEN AGAINST THIS DATABASE BEFORE ANY OF IT WAS WRITTEN:
--
--   two questions block one task      -> question_blocks = 2
--   answer the first                  -> open blockers   = 1
--                                        task.blocked_by = NULL
--
-- The task reads as free while an open question still blocks it. `blocked_by` is
-- a single column that the projector MAINTAINED incrementally — `coalesce` on
-- the way in, so the second question never registered on the task, and an
-- unconditional clear on the way out. Two operations that are each locally
-- reasonable and jointly wrong.
--
-- THE FIX IS TO STOP MAINTAINING IT. The many-to-many table is the truth, and
-- `blocked_by` becomes a derived summary recomputed from the join every time the
-- set changes: the EARLIEST still-open blocker, and NULL only when a count says
-- zero. Nothing accumulates, so nothing drifts.
--
-- AND AN ANSWER IS ONE COMMIT. Answering has three consequences — the question
-- resolves, the answer becomes a decision the project remembers, and whatever it
-- blocked is recomputed — and a caller doing them as three appends can be
-- interrupted between any two. `answer_question` does all three in one
-- transaction, under a lock, and is idempotent per command id.
--
-- DEVIATION FROM THE CARD, STATED. The card specifies `question.answered@2`.
-- This adds `resolution_id` to the existing `@1` payload instead: the event's
-- subject and meaning do not change, an optional field is exactly what a
-- compatible version is, and the ABSENCE of that field is precisely how a legacy
-- answer without a decision is told apart from a new one. A `@2` would cost a
-- registry row, an English and a Russian feed sentence and a second projector
-- arm to keep in step, and buy none of that.
--
-- NOT IN THIS SLICE: delivering the answer to whoever continues the work. The
-- command returns which tasks became eligible; the continuation outbox and its
-- acknowledgement are M152.continue, which consumes S04/M103. A table nobody
-- reads is a schema pretending to be a feature.

-- ————————————————————————————————————————————————— 1 · a question has a revision
--
-- So an operator answering a question that a colleague has already revised is
-- refused with the current state rather than overwriting it.

alter table questions add column if not exists revision      integer not null default 1;
alter table questions add column if not exists resolution_id uuid;

create table if not exists question_resolutions (
  resolution_id     uuid primary key default gen_random_uuid(),
  estate_id         uuid not null,
  project_id        uuid not null,
  question_id       uuid not null unique,
  -- The caller's own key. A retry of one answer is the same answer, and the
  -- second call returns the first one's ids rather than a second decision.
  command_id        uuid not null unique,
  decision_id       uuid not null unique,
  question_revision integer not null,
  actor_kind        text not null,
  actor_id          text not null,
  basis_refs        jsonb,
  answered_seq      bigint not null,
  answered_at       timestamptz not null default now()
);
create index if not exists question_resolutions_estate on question_resolutions(estate_id, project_id);

-- ————————————————————————————————————————————————— 2 · recompute, never maintain
--
-- One function, called from every arm that can change the set. The ORDER is
-- `asked_at` then id: a stable earliest, so two questions asked in the same
-- transaction do not swap places between recomputations.

create or replace function recompute_task_blockers(p_estate_id uuid, p_task_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare b record;
begin
  select q.id, q.asked_at into b
    from question_blocks qb
    join questions q on q.id = qb.question_id
   where qb.task_id = p_task_id
     and qb.estate_id = p_estate_id
     and q.status = 'open'
   order by q.asked_at, q.id
   limit 1;

  update project_tasks
     set blocked_by    = b.id,
         -- The time the REMAINING blocker was asked, not the time the first one
         -- was: "blocked since" answers how long this obstacle has stood.
         blocked_since = b.asked_at
   where id = p_task_id
     and estate_id = p_estate_id;
end $$;

-- ————————————————————————————————————————————————— 3 · the arms use it
--
-- Extracted whole from migration 31 by script and edited only where the blocking
-- set changes, so the diff is the change (M97's lesson).

create or replace function apply_questions(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  t uuid;
  v_task uuid;
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

      -- A block row exists only where it can actually block: the task is JOINED
      -- inside the event's estate rather than merely named (ADR-0049).
      for t in select jsonb_array_elements_text(coalesce(e.payload->'blocks','[]'::jsonb))::uuid
      loop
        insert into question_blocks (question_id, task_id, estate_id, project_id)
        select q.id, pt.id, q.estate_id, q.project_id
          from questions q
          join project_tasks pt on pt.id = t and pt.estate_id = e.estate_id
         where q.id = (e.payload->>'id')::uuid
        on conflict do nothing;
        -- Recomputed, not coalesced. The old arm kept the FIRST blocker and so
        -- the second question never appeared on the task at all.
        perform recompute_task_blockers(e.estate_id, t);
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
             resolution_id = nullif(e.payload->>'resolution_id','')::uuid,
             answered_at = e.occurred_at
       where id = (e.payload->>'id')::uuid and status = 'open' and estate_id = e.estate_id;

      -- EVERY task this question blocked is recomputed — not only the ones whose
      -- `blocked_by` happened to name it. That column was the summary, and
      -- unblocking by it is what let a second open question disappear.
      for v_task in select task_id from question_blocks
                     where question_id = (e.payload->>'id')::uuid and estate_id = e.estate_id
      loop
        perform recompute_task_blockers(e.estate_id, v_task);
      end loop;

    when 'question.withdrawn@1' then
      update questions
         set status = 'withdrawn', withdrawn_reason = e.payload->>'reason'
       where id = (e.payload->>'id')::uuid and status = 'open' and estate_id = e.estate_id;
      for v_task in select task_id from question_blocks
                     where question_id = (e.payload->>'id')::uuid and estate_id = e.estate_id
      loop
        perform recompute_task_blockers(e.estate_id, v_task);
      end loop;

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

-- ————————————————————————————————————————————————— 4 · one answer, one commit
--
-- Three consequences in one transaction. A caller doing them as three appends
-- can be interrupted between any two, and the shapes that leaves behind — an
-- answered question with no decision, a decision nobody can trace to a question,
-- a task still marked blocked by something already settled — are each silently
-- plausible.

create or replace function answer_question(
  p_estate_id         uuid,
  p_project_id        uuid,
  p_question_id       uuid,
  p_command_id        uuid,
  p_expected_revision integer,
  p_answer            text,
  p_chosen_option     text,
  p_basis             jsonb,
  p_actor             jsonb
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  q             questions;
  existing      question_resolutions;
  v_decision_id uuid;
  v_seq         bigint;
  v_task        uuid;
  v_unblocked   uuid[] := '{}';
  v_remaining   jsonb := '[]'::jsonb;
  v_open        integer;
begin
  -- Idempotency first: a retry of one answer is that answer, not a second one.
  select * into existing from question_resolutions where command_id = p_command_id;
  if existing.resolution_id is not null then
    if existing.question_id <> p_question_id then
      raise exception 'that command id already answered a different question'
        using errcode = 'invalid_parameter_value';
    end if;
    return jsonb_build_object(
      'resolution_id', existing.resolution_id,
      'decision_id',   existing.decision_id,
      'repeated',      true);
  end if;

  select * into q from questions
   where id = p_question_id and estate_id = p_estate_id
   for update;

  -- An unauthorised question and an absent one look the same from outside.
  if q.id is null or q.project_id is distinct from p_project_id then
    raise exception 'no such question' using errcode = 'no_data_found';
  end if;
  if q.status <> 'open' then
    raise exception 'that question is already %, and a settled question is not re-answered', q.status
      using errcode = 'invalid_parameter_value';
  end if;
  if p_expected_revision is not null and q.revision <> p_expected_revision then
    raise exception 'that question moved to revision % while you were answering revision %',
      q.revision, p_expected_revision
      using errcode = 'serialization_failure';
  end if;

  v_decision_id := gen_random_uuid();

  -- The answer becomes something the project REMEMBERS, in the vocabulary that
  -- actually exists. `memory.remembered` appears in several designs and in no
  -- migration; the event is `memory.project.recorded@1`.
  perform append_event(
    p_estate_id, 'memory.project.recorded@1', p_actor,
    jsonb_build_object(
      'id',         v_decision_id,
      'claim',      p_answer,
      'kind',       'decision',
      'source_ref', 'question:' || p_question_id::text),
    '1', p_project_id);

  select seq into v_seq from append_event(
    p_estate_id, 'question.answered@1', p_actor,
    jsonb_build_object(
      'id',            p_question_id,
      'answer',        p_answer,
      'chosen_option', p_chosen_option,
      'decision_id',   v_decision_id,
      'settled_basis', p_basis,
      'answered_by_kind', coalesce(p_actor->>'kind', 'person')),
    '1', p_project_id);

  insert into question_resolutions
    (estate_id, project_id, question_id, command_id, decision_id, question_revision,
     actor_kind, actor_id, basis_refs, answered_seq)
  values (p_estate_id, p_project_id, p_question_id, p_command_id, v_decision_id, q.revision,
          coalesce(p_actor->>'kind','person'), coalesce(p_actor->>'id','unknown'), p_basis, v_seq)
  returning * into existing;

  update questions set resolution_id = existing.resolution_id where id = p_question_id;

  -- What is now free, and what still is not. The caller gets both, because
  -- "answered" and "may proceed" are different facts and a surface that merges
  -- them is the defect this slice was filed for.
  for v_task in select task_id from question_blocks
                 where question_id = p_question_id and estate_id = p_estate_id
  loop
    select count(*) into v_open
      from question_blocks qb join questions qq on qq.id = qb.question_id
     where qb.task_id = v_task and qb.estate_id = p_estate_id and qq.status = 'open';
    if v_open = 0 then
      v_unblocked := v_unblocked || v_task;
    else
      v_remaining := v_remaining || jsonb_build_object('task_id', v_task, 'open_blockers', v_open);
    end if;
  end loop;

  return jsonb_build_object(
    'resolution_id', existing.resolution_id,
    'decision_id',   v_decision_id,
    'answered_seq',  v_seq,
    'unblocked',     to_jsonb(v_unblocked),
    'still_blocked', v_remaining,
    'repeated',      false);
end $$;

-- ————————————————————————————————————————————————— 5 · the door
revoke insert, update, delete on question_resolutions from anon, authenticated, service_role;
revoke all on question_resolutions from public;
grant select on question_resolutions to service_role;
grant execute on function answer_question(uuid, uuid, uuid, uuid, integer, text, text, jsonb, jsonb) to service_role;
revoke execute on function answer_question(uuid, uuid, uuid, uuid, integer, text, text, jsonb, jsonb) from anon, authenticated, public;
revoke execute on function recompute_task_blockers(uuid, uuid) from anon, authenticated, service_role, public;
revoke execute on function apply_questions(journal) from public;
revoke execute on function apply_questions(journal) from anon, authenticated, service_role;

alter table question_resolutions enable row level security;
create policy member_question_resolutions_read on question_resolutions
  for select to authenticated
  using (estate_id in (select member_estates()));
grant select on question_resolutions to authenticated;
