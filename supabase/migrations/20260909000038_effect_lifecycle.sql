-- An effect has a lifecycle, and an observation is not a claim (ADR-0050, S03.effects).
--
-- MEASURED BEFORE THIS: `fabric_effect_request` called `policy.decide` and then,
-- with nothing in between, `policy.recordEffect` — which appends
-- `effect.executed@1`, shown to the operator as "an effect was carried out".
-- The act happens afterwards, outside Fabric, and may never happen. The
-- operator's own file-overwrite path records only after the write succeeds, so
-- the two paths disagreed and the dishonest one carried the higher risk.
--
-- And `effect_intents` had no state column at all: a crash between an
-- irreversible external act and its receipt left no row, so a completed effect
-- and one that never started were the same absence.
--
-- THE FLOOR HERE IS A CONSTRAINT, NOT A CONVENTION (ADR-0049). A row may only
-- reach `succeeded` while an attempt carrying an observation reference exists.
-- A caller that appends a claim and sets success is refused by the database, the
-- same way a floored effect with no live reservation already is.

-- ————————————————————————————————————————————————————————— the lifecycle
alter table effect_intents add column if not exists command_id uuid;
alter table effect_intents add column if not exists state text;
alter table effect_intents add column if not exists provenance text;
alter table effect_intents add column if not exists target text;
alter table effect_intents add column if not exists project_id uuid;

-- Existing rows are the OLD permission path's claim. They keep their journal
-- events untouched (ADR-0014) and are classified rather than promoted: reading
-- them as verified would launder the exact defect this migration names.
update effect_intents set provenance = 'legacy_unverified' where provenance is null;
update effect_intents set state = 'outcome_unknown' where state is null;

alter table effect_intents
  alter column state set default 'reserved',
  alter column provenance set default 'observed';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'effect_state_is_known') then
    alter table effect_intents add constraint effect_state_is_known
      check (state in ('reserved', 'dispatching', 'succeeded', 'failed_known',
                       'outcome_unknown', 'cancelled_before_dispatch'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'effect_provenance_is_known') then
    alter table effect_intents add constraint effect_provenance_is_known
      check (provenance in ('observed', 'claimed', 'legacy_unverified'));
  end if;
  -- A CLAIM CANNOT SUCCEED. An agent performing an act Fabric cannot see leaves
  -- an effect whose outcome Fabric honestly does not know; saying otherwise is
  -- the whole thing ADR-0050 exists to refuse.
  if not exists (select 1 from pg_constraint where conname = 'claimed_effect_is_never_resolved') then
    alter table effect_intents add constraint claimed_effect_is_never_resolved
      check (provenance <> 'claimed' or state in ('reserved', 'dispatching', 'outcome_unknown', 'cancelled_before_dispatch'));
  end if;
end $$;

create unique index if not exists one_intent_per_command
  on effect_intents (estate_id, command_id) where command_id is not null;

-- ————————————————————————————————————————————————————————— the attempts
--
-- One row per dispatch of one logical effect. The idempotency key is the same
-- across retries BY DESIGN: an adapter retrying is not a second effect, and a
-- key that changed per attempt is how one payment becomes two.
create table if not exists effect_attempts (
  attempt_id          uuid primary key default gen_random_uuid(),
  estate_id           uuid not null,
  command_id          uuid not null,
  attempt_no          int  not null,
  idempotency_key     text not null,
  adapter_revision    text,
  dispatch_started_seq bigint not null,
  provider_effect_ref text,
  -- Null until somebody OBSERVED the result. Its presence is what a `succeeded`
  -- state is allowed to rest on.
  observation_ref     text,
  status              text not null default 'dispatched'
                        check (status in ('dispatched', 'observed', 'abandoned')),
  created_at          timestamptz not null default now(),
  constraint one_attempt_number_per_command unique (estate_id, command_id, attempt_no),
  constraint observed_attempt_carries_its_evidence
    check (status <> 'observed' or observation_ref is not null)
);

create index if not exists effect_attempts_by_command on effect_attempts (estate_id, command_id);

alter table effect_attempts enable row level security;

-- ————————————————————————————————————————————— the floor: success needs evidence
create or replace function effect_success_needs_an_observation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.state = 'succeeded' then
    if not exists (
      select 1 from effect_attempts a
       where a.estate_id = new.estate_id
         and a.command_id = new.command_id
         and a.observation_ref is not null
    ) then
      -- Named as a floor, not as a validation error: the sentence is what a
      -- caller sees, and it has to say which rule refused and why.
      raise exception 'an effect cannot be recorded as succeeded without an attempt carrying an observation: what was observed, and by whom?'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists effect_success_needs_an_observation on effect_intents;
create trigger effect_success_needs_an_observation
  before insert or update on effect_intents
  for each row execute function effect_success_needs_an_observation();

-- ————————————————————————————————————————————————————————— the vocabulary
insert into event_types (type, projects, note) values
  ('effect.reserved@1', true,
   'authority was reserved for a specific act; nothing has been done yet'),
  ('effect.dispatch_started@1', true,
   'the act was started and the grant is spent at this fence, because after it the outcome may be unknowable'),
  ('effect.observed@1', true,
   'the result of the act was observed with evidence, by the party that performed it'),
  ('effect.claimed@1', true,
   'an agent reported performing an act Fabric could not observe; recorded and attributed, never resolving the outcome'),
  ('effect.reconciled@1', true,
   'an unknown outcome was resolved by looking the effect up again with its own key')
on conflict (type) do nothing;

-- ————————————————————————————————————————————————————————— the projector
--
-- A per-concern function off the thin dispatcher (M97). Extended by ADDING an
-- arm, never by rewriting a monolith.
create or replace function apply_effect_lifecycle(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_command uuid := nullif(e.payload->>'command_id', '')::uuid;
begin
  if v_command is null then return; end if;

  if e.type = 'effect.reserved@1' then
    insert into effect_intents (estate_id, project_id, command_id, action_class, floor_class,
                                target, reservation_id, receipt_seq, state, provenance)
    values (e.estate_id, e.project_id, v_command, e.payload->>'action_class',
            nullif(e.payload->>'floor_class', ''), e.payload->>'target',
            nullif(e.payload->>'reservation_id', '')::uuid, e.seq, 'reserved', 'observed')
    -- The index is PARTIAL, so the inference must repeat its predicate or
    -- Postgres cannot match it and the insert fails at runtime rather than at
    -- migration time — found by the probe, not by reading.
    on conflict (estate_id, command_id) where command_id is not null do nothing;

  elsif e.type = 'effect.dispatch_started@1' then
    insert into effect_attempts (estate_id, command_id, attempt_no, idempotency_key,
                                 adapter_revision, dispatch_started_seq, provider_effect_ref)
    values (e.estate_id, v_command, coalesce((e.payload->>'attempt_no')::int, 1),
            e.payload->>'idempotency_key', nullif(e.payload->>'adapter_revision', ''),
            e.seq, nullif(e.payload->>'provider_effect_ref', ''))
    on conflict (estate_id, command_id, attempt_no) do nothing;

    update effect_intents
       set state = 'dispatching', receipt_seq = e.seq
     where estate_id = e.estate_id and command_id = v_command
       and state in ('reserved', 'outcome_unknown');

  elsif e.type in ('effect.observed@1', 'effect.reconciled@1') then
    update effect_attempts
       set observation_ref = coalesce(e.payload->>'observation_ref', e.seq::text),
           provider_effect_ref = coalesce(nullif(e.payload->>'provider_effect_ref', ''), provider_effect_ref),
           status = 'observed'
     where estate_id = e.estate_id and command_id = v_command
       and attempt_no = coalesce((e.payload->>'attempt_no')::int, 1);

    update effect_intents
       set state = case e.payload->>'outcome'
                     when 'succeeded'    then 'succeeded'
                     when 'failed_known' then 'failed_known'
                     -- Anything else stays unresolved. A vocabulary this
                     -- projector does not recognise is not a success.
                     else 'outcome_unknown'
                   end,
           provenance = 'observed',
           receipt_seq = e.seq
     where estate_id = e.estate_id and command_id = v_command;

  elsif e.type = 'effect.claimed@1' then
    -- Recorded and attributed; the state is NOT resolved. The constraint above
    -- refuses it even if a future arm here tried.
    update effect_intents
       set provenance = 'claimed',
           state = case when state = 'dispatching' then 'outcome_unknown' else state end,
           receipt_seq = e.seq
     where estate_id = e.estate_id and command_id = v_command;
  end if;
end;
$$;

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
  perform apply_effect_lifecycle(e);
end;
$$;

-- P21: a missing grant looks exactly like an empty table.
grant select on effect_attempts to authenticated, service_role;
revoke insert, update, delete on effect_attempts from anon, authenticated;
revoke all on effect_attempts from anon;

drop policy if exists effect_attempts_read on effect_attempts;
create policy effect_attempts_read on effect_attempts for select
  using (estate_id in (select estate_id from memberships where person_id = auth.uid()));

revoke execute on function apply_effect_lifecycle(journal) from public;
revoke execute on function apply_effect_lifecycle(journal) from anon, authenticated, service_role;
revoke execute on function effect_success_needs_an_observation() from public;
revoke execute on function effect_success_needs_an_observation() from anon, authenticated, service_role;
