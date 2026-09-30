-- Deciding a proposal is one act (M168).
--
-- MEASURED BEFORE THIS: `proposals.decide` read the row, checked `decided_at is
-- null` in the client, then appended `task.created@1` and `proposal.decided@1`
-- as two separate calls. Two defects, and neither is visible in a single-window
-- test:
--
--   1. TWO WINDOWS BOTH PASS. Both read `decided_at = null` a moment apart, both
--      proceed, and one proposal produces two tasks and two decisions — the
--      projection quietly applying the second over the first.
--   2. THE PAIR CAN SPLIT. A process that dies between the two appends leaves a
--      task in the estate with no record of the decision that created it. The
--      journal is append-only, so there is no way back.
--
-- The lock and both appends are one transaction here, so the recheck happens
-- against the row nobody else can be holding.

create or replace function decide_proposal(
  p_estate_id   uuid,
  p_proposal_id uuid,
  p_decision    text,
  p_actor       jsonb,
  p_task_id     uuid,
  p_checker_version int default 1
)
returns journal
language plpgsql
security definer set search_path = public
as $$
declare
  pr      proposals;
  receipt journal;
begin
  if p_decision not in ('accepted', 'declined') then
    raise exception 'unknown_decision: "%" is not a decision', p_decision using errcode = 'invalid_parameter_value';
  end if;

  select * into pr from proposals
   where estate_id = p_estate_id and id = p_proposal_id
   for update;

  if not found then
    raise exception 'not_found: no such proposal in this estate' using errcode = 'no_data_found';
  end if;

  -- THE RECHECK, under the lock. In the client it ran against a row read a
  -- moment earlier, which two windows can both do.
  if pr.decided_at is not null then
    raise exception 'already_decided: that proposal was already %', coalesce(pr.decision, 'decided')
      using errcode = 'check_violation';
  end if;

  if p_decision = 'accepted' then
    if p_task_id is null then
      raise exception 'accepting a proposal needs the id of the task it becomes' using errcode = 'invalid_parameter_value';
    end if;
    if not exists (select 1 from projects where estate_id = p_estate_id and id = pr.project_id) then
      -- Checked again HERE, not only in the checker: a project can be removed
      -- between the check and this line, and a task in a project nobody has is
      -- not visible anywhere.
      raise exception 'project_missing: the project this proposal belongs to is gone' using errcode = 'check_violation';
    end if;
    perform append_event(
      p_estate_id, 'task.created@1', p_actor,
      jsonb_build_object(
        'id', p_task_id,
        'title', pr.title,
        'instruction', pr.title,
        'task_type', 'development',
        -- The origin is the PROPOSAL, not the chain: this task exists because a
        -- person said so, and that is the evidence.
        'origin', jsonb_build_object('kind', 'person', 'ref', p_actor->>'id')
      ),
      '1', pr.project_id
    );
  end if;

  select * into receipt from append_event(
    p_estate_id, 'proposal.decided@1', p_actor,
    jsonb_build_object('id', p_proposal_id, 'decision', p_decision,
                       'task_id', p_task_id, 'checker_version', p_checker_version),
    '1', pr.project_id
  );
  return receipt;
end;
$$;

revoke execute on function decide_proposal(uuid, uuid, text, jsonb, uuid, int) from public;
revoke execute on function decide_proposal(uuid, uuid, text, jsonb, uuid, int) from anon;
grant execute on function decide_proposal(uuid, uuid, text, jsonb, uuid, int) to service_role;
