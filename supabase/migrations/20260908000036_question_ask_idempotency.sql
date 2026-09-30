-- One ask, one question, however many times the call is retried (M149).
--
-- An agent's transport can drop the response after the append committed. Without
-- a key, its retry asks the operator the same thing twice — and two questions
-- with the same text are NOT deduplicated automatically, deliberately: telling
-- two similar questions apart is a judgement, and a mechanical merge would
-- silently drop the one that was different in a way nobody read.
--
-- So the retry is made identical instead of being detected afterwards. The
-- caller's `command_id` is the key, and the second call gets the first call's
-- receipt.

alter table questions add column if not exists asked_command_id uuid;
alter table questions add column if not exists topic            text;

create unique index if not exists questions_one_per_command
  on questions(asked_command_id)
  where asked_command_id is not null;

comment on column questions.asked_command_id is
  'The asking command''s own id. A retry returns the first receipt rather than asking a person twice.';
comment on column questions.topic is
  'What it is about, beside the kind. A recurring-trap question is kind=decision, topic=process — a fifth kind would move every priority weight that switches on kind, for a label.';

-- The arm carries them. Extracted from migration 35 and edited only where the
-- new columns land, so the diff is the change.
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
                             options, kind, about, topic, asked_command_id,
                             asked_by_kind, asked_by_id, asked_at, status, seq)
      values ((e.payload->>'id')::uuid, e.estate_id, (e.payload->>'project_id')::uuid,
              nullif(e.payload->>'task_id','')::uuid,
              e.payload->>'text', e.payload->>'why_blocked',
              e.payload->'options',
              coalesce(e.payload->>'kind','decision'),
              nullif(e.payload->>'about',''),
              nullif(e.payload->>'topic',''),
              nullif(e.payload->>'command_id','')::uuid,
              coalesce(e.actor->>'kind','agent'),
              coalesce(e.actor->>'id','unknown'),
              e.occurred_at, 'open', e.seq)
      on conflict (id) do nothing;

      for t in select jsonb_array_elements_text(coalesce(e.payload->'blocks','[]'::jsonb))::uuid
      loop
        insert into question_blocks (question_id, task_id, estate_id, project_id)
        select q.id, pt.id, q.estate_id, q.project_id
          from questions q
          join project_tasks pt on pt.id = t and pt.estate_id = e.estate_id
         where q.id = (e.payload->>'id')::uuid
        on conflict do nothing;
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

revoke execute on function apply_questions(journal) from public;
revoke execute on function apply_questions(journal) from anon, authenticated, service_role;
