-- The floor validates a LIVE, MATCHING grant — not a non-null column (S03.boundary).
--
-- WHAT WAS PROVEN AGAINST THIS DATABASE BEFORE ANY OF IT WAS WRITTEN. Migration
-- one carries the constraint
--
--     constraint floored_needs_grant check (floor_class is null or grant_id is not null)
--
-- under the comment "Code that bypasses the policy module still hits this line".
-- It does. And then it passes:
--
--   a floored effect citing a grant that EXPIRED ten days ago  -> accepted
--   …that was already CONSUMED                                 -> accepted
--   …issued for a completely DIFFERENT target                  -> accepted
--   …belonging to ANOTHER ESTATE                               -> accepted
--
-- `policy.ts#findGrantFor` checks every one of those, correctly. That is the
-- problem: the check lives in the caller, and the schema line that exists so a
-- bypass is impossible only asks whether a uuid is present. The vision names
-- this exact failure as the one that would falsify its second claim — *the floor
-- turns out to live in an instruction a model can reason its way around*.
--
-- THE SHAPE OF THE FIX, and it is ADR-0049's rule applied to authority.
-- A floored effect no longer cites a GRANT. It cites a RESERVATION, and a
-- reservation can only be created by `reserve_effect`, which validates
-- everything `findGrantFor` validates — inside the database, in one transaction,
-- under a lock. Direct INSERT on the reservation table is revoked from every
-- role, exactly as migration 6 closed the projection door. There is no way to
-- write a reservation without passing the check, so there is no way to write a
-- floored effect without a live matching grant.
--
-- SINGLE USE IS AN INDEX, NOT A SEQUENCE OF STATEMENTS. `policy.ts` read the
-- grant and then updated `consumed_at` with no guard, so two commands racing for
-- one grant both found it unconsumed and both spent it. A partial unique index
-- on the grant makes the loser's INSERT fail; the function turns that into a
-- typed refusal instead of a second authorisation.
--
-- NOT IN THIS SLICE: dispatch, adapters, attempts and unknown reconciliation are
-- S03.effects. Nothing here executes anything, and nothing here reports that
-- anything was executed.

-- ————————————————————————————————————————————————— 1 · a grant names its scope
--
-- A grant was (estate, floor_class, target). It could not say WHICH project, and
-- it could not say which action class — so a deletion grant for one project
-- authorised the same target in another, and `action_class` was checked only in
-- the caller.

alter table grants add column if not exists project_id   uuid;
alter table grants add column if not exists action_class text;
alter table grants add column if not exists revoked_at   timestamptz;

comment on column grants.project_id is
  'The project this grant is confined to. NULL is estate-wide and is deliberate: file overwrite is granted outside any project.';
comment on column grants.revoked_at is
  'Withdrawn before use. Distinct from consumed_at: one means it was spent, the other means it never should be.';

create index if not exists grants_live on grants(estate_id, floor_class, target)
  where consumed_at is null and revoked_at is null;

-- ————————————————————————————————————————————————— 2 · the reservation
--
-- Immutable lineage: a released reservation KEEPS its row. "This grant was once
-- reserved by a command that then proved it never dispatched" is evidence, and
-- deleting it would make a re-reservation indistinguishable from a first one.

create table if not exists grant_reservations (
  reservation_id    uuid primary key default gen_random_uuid(),
  estate_id         uuid not null,
  project_id        uuid,
  grant_id          uuid not null references grants(id),
  command_id        uuid not null,
  action_class      text not null,
  floor_class       text not null check (floor_class in ('money', 'deletion', 'publication')),
  target            text not null,
  state             text not null check (state in ('reserved', 'consumed', 'released', 'revoked')),
  acquired_at       timestamptz not null default now(),
  released_at       timestamptz,
  release_proof_ref text,
  constraint released_needs_proof
    check (state <> 'released' or (released_at is not null and release_proof_ref is not null))
);

-- AT MOST ONE LIVE RESERVATION PER GRANT. This index is the single-use rule:
-- `released` is excluded so a proven-undispatched reservation frees the grant,
-- and everything else holds it. Two commands racing produce one INSERT and one
-- unique violation, which is a refusal rather than a second authorisation.
create unique index if not exists one_live_reservation_per_grant
  on grant_reservations(grant_id)
  where state in ('reserved', 'consumed', 'revoked');

create index if not exists grant_reservations_estate
  on grant_reservations(estate_id, project_id);

-- ————————————————————————————————————————————————— 3 · the only way in
--
-- Security definer, and the table's own INSERT is revoked below. Everything
-- `findGrantFor` checked in TypeScript is checked here, in the same transaction
-- that takes the row lock.
create or replace function reserve_effect(
  p_estate_id    uuid,
  p_project_id   uuid,
  p_action_class text,
  p_floor_class  text,
  p_target       text,
  p_command_id   uuid
)
returns grant_reservations
language plpgsql
security definer set search_path = public
as $$
declare
  g grants;
  r grant_reservations;
begin
  -- The OLDEST usable grant, locked. Newest-first would leave an earlier grant
  -- to expire unused while the operator believes they authorised the act once.
  select * into g
    from grants
   where estate_id = p_estate_id
     and floor_class = p_floor_class
     and target = p_target
     and consumed_at is null
     and revoked_at is null
     and expires_at > now()
     -- NULL project_id is estate-wide and satisfies any project; a grant bound
     -- to a project satisfies only that one.
     and (project_id is null or project_id is not distinct from p_project_id)
     -- NULL action_class predates this column and is not narrowed by it; a grant
     -- that names an action authorises only that action.
     and (action_class is null or action_class = p_action_class)
     -- …and NOT already held by a different command. `for update skip locked`
     -- skips row LOCKS, not reservations, so without this the oldest live grant
     -- is chosen even when another command holds it, and the caller is refused
     -- while a second, unreserved grant sits beside it unused. Found by the
     -- policy probe: an operator who authorised twice has two authorisations.
     and not exists (
       select 1 from grant_reservations gr
        where gr.grant_id = grants.id
          and gr.state in ('reserved', 'consumed', 'revoked')
          and gr.command_id <> p_command_id
     )
   order by created_at
   for update skip locked
   limit 1;

  if g.id is null then
    -- Before refusing, ask whether THIS command already holds a reservation.
    -- `decide` is called more than once for one command — to answer the
    -- operator, then again before recording — and a second call must return the
    -- authority it already has rather than be refused by its own reservation.
    -- Single use is per COMMAND, not per call.
    select * into r from grant_reservations
     where estate_id = p_estate_id and command_id = p_command_id
       and floor_class = p_floor_class and target = p_target
       and state in ('reserved', 'consumed');
    if r.reservation_id is not null then
      return r;
    end if;

    raise exception 'no live grant matches (%, %, %)', p_floor_class, p_target, p_action_class
      using errcode = 'insufficient_privilege';
  end if;

  -- The same idempotency on the happy path: the grant is still live and this
  -- command already reserved it.
  select * into r from grant_reservations
   where grant_id = g.id and command_id = p_command_id and state in ('reserved', 'consumed');
  if r.reservation_id is not null then
    return r;
  end if;

  begin
    insert into grant_reservations
      (estate_id, project_id, grant_id, command_id, action_class, floor_class, target, state)
    values (p_estate_id, p_project_id, g.id, p_command_id, p_action_class, p_floor_class, p_target, 'reserved')
    returning * into r;
  exception when unique_violation then
    -- The partial index refused a second live reservation. One winner, and the
    -- loser is told so rather than handed the same authority.
    raise exception 'that grant is already reserved by another command'
      using errcode = 'insufficient_privilege';
  end;

  return r;
end $$;

-- ————————————————————————————————————————————————— 4 · the floor itself
--
-- A CHECK constraint cannot look at another table, so the floor is a trigger —
-- which is the same category of thing and refuses the same way. It fires for
-- every writer, including one that never heard of `reserve_effect`.

alter table effect_intents add column if not exists reservation_id uuid references grant_reservations(reservation_id);

create or replace function floored_effect_needs_live_reservation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare r grant_reservations;
begin
  if new.floor_class is null then
    return new;   -- unfloored effects need no grant and never did
  end if;

  if new.reservation_id is null then
    raise exception 'a floored effect must cite a reservation, not a grant id'
      using errcode = 'insufficient_privilege';
  end if;

  select * into r from grant_reservations where reservation_id = new.reservation_id;

  if r.reservation_id is null then
    raise exception 'that reservation does not exist' using errcode = 'insufficient_privilege';
  end if;
  if r.state not in ('reserved', 'consumed') then
    raise exception 'that reservation is %, not live', r.state using errcode = 'insufficient_privilege';
  end if;
  if r.estate_id <> new.estate_id then
    raise exception 'that reservation belongs to another estate' using errcode = 'insufficient_privilege';
  end if;
  if r.floor_class <> new.floor_class or r.action_class <> new.action_class then
    raise exception 'that reservation authorises % / %, not % / %',
      r.floor_class, r.action_class, new.floor_class, new.action_class
      using errcode = 'insufficient_privilege';
  end if;

  -- Lineage: the grant behind the reservation is recorded on the intent too, so
  -- an existing reader that joins on grant_id keeps working.
  new.grant_id := r.grant_id;
  return new;
end $$;

drop trigger if exists floored_effect_needs_live_reservation on effect_intents;
create trigger floored_effect_needs_live_reservation
  before insert or update on effect_intents
  for each row execute function floored_effect_needs_live_reservation();

-- The old constraint stays as well. It is weaker and it is not wrong: a floored
-- intent still may not carry a null grant, and the trigger fills that column
-- from the reservation it validated.

-- ————————————————————————————————————————————————— 5 · the door
--
-- Migration 6 closed the projection door for the same reason: a table that any
-- writer can insert into is not a floor, whatever its rows say. Only
-- `reserve_effect` writes reservations.

revoke insert, update, delete on grant_reservations from anon, authenticated, service_role;
revoke all on grant_reservations from public;
grant select on grant_reservations to service_role;
grant execute on function reserve_effect(uuid, uuid, text, text, text, uuid) to service_role;
revoke execute on function reserve_effect(uuid, uuid, text, text, text, uuid) from anon, authenticated, public;
revoke execute on function floored_effect_needs_live_reservation() from anon, authenticated, service_role, public;

alter table grant_reservations enable row level security;
create policy member_grant_reservations_read on grant_reservations
  for select to authenticated
  using (estate_id in (select member_estates()));
grant select on grant_reservations to authenticated;
