-- A delivery is written; being accepted is somebody else's word (M103).
--
-- MEASURED: `deliverWhenReady` pastes the instruction into a pty and returns.
-- No record, no state, no acknowledgement — the write returning IS the delivery
-- as far as anything downstream can tell. And S04's launch moved the task to
-- `running` immediately after, so a task read as running on the strength of
-- bytes having reached a terminal.
--
-- Bytes reach a terminal in all of these: the agent read them and started; the
-- CLI printed its prompt and exited; the paste landed in a pager; the process is
-- wedged and its buffer took the write anyway. Four situations, one record.
--
-- THE DIGEST IS WHAT MAKES AN ACK MEAN ANYTHING. Without it an agent could
-- acknowledge a delivery it never saw — the previous instruction in that
-- session, or one addressed to another task — and the task would read running
-- on a confirmation about something else.

create table if not exists deliveries (
  delivery_id   uuid primary key,
  estate_id     uuid not null,
  project_id    uuid,
  task_id       uuid not null,
  session_id    uuid,
  -- Of the instruction. An ack must quote it.
  input_digest  text not null,
  state         text not null default 'queued'
                  check (state in ('queued','waiting_ready','written_unconfirmed',
                                   'accepted','failed_before_write','outcome_unknown')),
  -- Who said it arrived. An ADAPTER ack records that bytes moved; it is never
  -- promoted to an agent ack, because a transport accepting bytes proves
  -- nothing about a reader.
  ack_source    text check (ack_source in ('agent','adapter','operator')),
  queued_seq    bigint not null,
  written_seq   bigint,
  ack_seq       bigint,
  created_at    timestamptz not null default now(),
  constraint accepted_needs_an_agent_ack
    check (state <> 'accepted' or ack_source = 'agent'),
  constraint accepted_needs_a_receipt
    check (state <> 'accepted' or ack_seq is not null)
);

create index if not exists deliveries_by_task on deliveries (estate_id, task_id);

alter table deliveries enable row level security;

insert into event_types (type, projects, note) values
  ('delivery.queued@1', true, 'an instruction was recorded for delivery, with the digest an acknowledgement must quote'),
  ('delivery.written@1', true, 'the bytes went out; nobody has yet said they arrived anywhere useful'),
  ('delivery.accepted@1', true, 'the agent quoted back the digest of what it received, so this instruction is the one it has'),
  ('delivery.unknown@1', true, 'the deadline passed with no word; the instruction may have been read or may not, and nothing is resent')
on conflict (type) do nothing;

create or replace function apply_deliveries(e journal)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid := nullif(e.payload->>'delivery_id', '')::uuid;
begin
  if v_id is null then return; end if;

  if e.type = 'delivery.queued@1' then
    insert into deliveries (delivery_id, estate_id, project_id, task_id, session_id,
                            input_digest, state, queued_seq)
    values (v_id, e.estate_id, e.project_id, (e.payload->>'task_id')::uuid,
            nullif(e.payload->>'session_id','')::uuid, e.payload->>'input_digest',
            'queued', e.seq)
    on conflict (delivery_id) do nothing;

  elsif e.type = 'delivery.written@1' then
    update deliveries
       set state = 'written_unconfirmed', written_seq = e.seq,
           session_id = coalesce(nullif(e.payload->>'session_id','')::uuid, session_id)
     where estate_id = e.estate_id and delivery_id = v_id and state in ('queued','waiting_ready');

  elsif e.type = 'delivery.accepted@1' then
    -- The digest is compared HERE too, not only in the caller. A projection
    -- that takes any acceptance for a delivery would let a bypass of the tool
    -- mark a task running.
    update deliveries
       set state = 'accepted', ack_source = coalesce(e.payload->>'source','agent'), ack_seq = e.seq
     where estate_id = e.estate_id and delivery_id = v_id
       and input_digest = e.payload->>'input_digest'
       and state in ('written_unconfirmed','outcome_unknown');

  elsif e.type = 'delivery.unknown@1' then
    update deliveries
       set state = 'outcome_unknown'
     where estate_id = e.estate_id and delivery_id = v_id and state = 'written_unconfirmed';
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
  perform apply_heartbeats(e);
  perform apply_deliveries(e);
end;
$$;

grant select on deliveries to authenticated, service_role;
revoke insert, update, delete on deliveries from anon, authenticated;
revoke all on deliveries from anon;

drop policy if exists deliveries_read on deliveries;
create policy deliveries_read on deliveries for select
  using (estate_id in (select estate_id from memberships where person_id = auth.uid()));

revoke execute on function apply_deliveries(journal) from public;
revoke execute on function apply_deliveries(journal) from anon, authenticated, service_role;
