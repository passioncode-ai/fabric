-- An estate keeps an owner, and revoking one invalidates what was read (S09).
--
-- MEASURED BEFORE THIS EXISTED, and the first half is a way to lose an estate
-- permanently:
--
--   `memberships` has held `(person_id, estate_id, role)` since migration one
--   and NOTHING protects the last owner. `delete from memberships` removes it,
--   and the application runs on the service role — so this is not a theoretical
--   path through an API, it is the path the product itself uses. After it there
--   is no owner, nobody can grant one, and every RLS policy in the schema keys
--   off a membership that no longer exists. The estate's data is intact and
--   unreachable, which is worse than deleted because it looks recoverable.
--
--   And there is no REVISION. Authority is read, a decision is made on it, and
--   the write happens later; between the two, a revoke can land. Every other
--   authority in this repository already carries a revision for exactly that —
--   questions, policy, proposals — and membership, which is where authority
--   comes from, had none.
--
-- THE FLOOR IS A TRIGGER, NOT A COMMAND CHECK. A check inside the command is a
-- rule that holds until somebody writes the table another way, and the service
-- role can. The estate keeps an owner whoever is writing and however they got
-- there (ADR-0049).
--
-- WHAT THIS IS NOT. It is not an authentication system: there is no login here,
-- `OPERATOR_ACTOR` is the literal string 'operator', and every RLS policy that
-- keys off `auth.uid()` has never been exercised by this application because it
-- connects as the service role. This is the floor that has to exist BEFORE
-- identity arrives, and it is enforced against the writer the product actually
-- is.

alter table memberships
  -- Bumped on every change to this membership. A command that read revision 3
  -- and writes against revision 4 is acting on authority that has moved.
  add column if not exists revision bigint not null default 1,
  -- Who last changed it and when. A membership is an authority fact; one that
  -- cannot say when it changed cannot be audited.
  add column if not exists changed_at timestamptz not null default now(),
  add column if not exists changed_by text;

-- ── the floor: an estate keeps an owner ──────────────────────────────────────

create or replace function an_estate_keeps_an_owner()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_estate uuid := coalesce(old.estate_id, new.estate_id);
  v_owners int;
begin
  -- Counted AFTER the row change, inside the same statement, so two concurrent
  -- revokes cannot both observe a surviving owner. `for update` on the estate's
  -- rows serialises them: the second waits, then counts the world the first
  -- left behind.
  perform 1 from memberships where estate_id = v_estate for update;
  select count(*) into v_owners from memberships
   where estate_id = v_estate and role = 'owner';

  if v_owners = 0 then
    raise exception 'this would leave estate % with no owner. The data would stay intact and unreachable — nobody could grant a membership, and every policy keys off one. Add the new owner first; a transfer is one transaction, not two.', v_estate
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

drop trigger if exists an_estate_keeps_an_owner on memberships;
-- AFTER, and per STATEMENT, because the count has to see the finished change.
-- A row-level BEFORE trigger cannot: it runs while the row it is judging is
-- still the old one, and a multi-row delete would pass each row on the strength
-- of the ones not yet removed.
create constraint trigger an_estate_keeps_an_owner
  after update or delete on memberships
  deferrable initially immediate
  for each row execute function an_estate_keeps_an_owner();

-- ── the revision moves on every change ───────────────────────────────────────

create or replace function membership_revision_moves()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Not the caller's to set. A writer that could choose the revision could
  -- write the one somebody else is holding, which is the whole failure the
  -- revision exists to catch.
  new.revision := coalesce(old.revision, 0) + 1;
  new.changed_at := now();
  return new;
end;
$$;

drop trigger if exists membership_revision_moves on memberships;
create trigger membership_revision_moves
  before update on memberships
  for each row execute function membership_revision_moves();

-- ── the command: one act, idempotent by its id ───────────────────────────────

create table if not exists membership_commands (
  command_id  uuid primary key,
  estate_id   uuid not null,
  -- The receipt this command produced. Returned verbatim on a retry, so a lost
  -- response is re-read rather than re-executed: two tabs accepting one invite
  -- is one membership and two identical answers.
  receipt     jsonb not null,
  created_at  timestamptz not null default now()
);

alter table membership_commands enable row level security;
grant select on membership_commands to authenticated, service_role;
revoke insert, update, delete on membership_commands from anon, authenticated;
revoke all on membership_commands from anon;

drop policy if exists membership_commands_read on membership_commands;
create policy membership_commands_read on membership_commands for select
  using (estate_id in (select estate_id from memberships where person_id = auth.uid()));

create or replace function change_membership(
  p_command_id uuid,
  p_estate_id uuid,
  p_target_person uuid,
  p_role text,
  p_action text,
  p_expected_revision bigint,
  p_changed_by text
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_existing jsonb;
  v_current  memberships;
  v_receipt  jsonb;
begin
  -- ── already done? ──
  select receipt into v_existing from membership_commands where command_id = p_command_id;
  if found then return v_existing; end if;

  if p_action not in ('grant', 'revoke') then
    return jsonb_build_object('status', 'refused', 'reason_code', 'unknown_action',
      'says', format('%s is not an action this command performs', p_action));
  end if;
  if p_role is not null and p_role not in ('owner', 'member') then
    return jsonb_build_object('status', 'refused', 'reason_code', 'unknown_role',
      'says', format('%s is not a role this estate has', p_role));
  end if;

  -- Lock the estate's memberships so a concurrent change cannot land between
  -- the reading and the write this decision rests on.
  perform 1 from memberships where estate_id = p_estate_id for update;
  select * into v_current from memberships
   where estate_id = p_estate_id and person_id = p_target_person;

  -- ── the compare-and-set ──
  --
  -- A caller that read revision 3 and writes against 4 is acting on authority
  -- that has moved. Refused rather than applied, and NOT recorded as a command:
  -- a conflict is the caller's to retry with a fresh reading.
  if p_expected_revision is not null
     and coalesce(v_current.revision, 0) is distinct from p_expected_revision then
    return jsonb_build_object('status', 'conflict', 'reason_code', 'revision_moved',
      'expected', p_expected_revision, 'actual', coalesce(v_current.revision, 0),
      'says', 'this membership changed while the decision was being made; read it again');
  end if;

  if p_action = 'grant' then
    insert into memberships (person_id, estate_id, role, changed_by)
    values (p_target_person, p_estate_id, p_role, p_changed_by)
    on conflict (person_id, estate_id) do update
      set role = excluded.role, changed_by = excluded.changed_by;
    select * into v_current from memberships
     where estate_id = p_estate_id and person_id = p_target_person;
    v_receipt := jsonb_build_object('status', 'committed', 'action', 'grant',
      'role', v_current.role, 'revision', v_current.revision);
  else
    delete from memberships
     where estate_id = p_estate_id and person_id = p_target_person;
    if not found then
      -- UNIFORM with the absent case on purpose: a caller learns nothing about
      -- whether a person exists in an estate it may not read.
      return jsonb_build_object('status', 'refused', 'reason_code', 'not_found',
        'says', 'there is no such membership in this estate');
    end if;
    v_receipt := jsonb_build_object('status', 'committed', 'action', 'revoke',
      'revision', coalesce(v_current.revision, 0));
  end if;

  insert into membership_commands (command_id, estate_id, receipt)
  values (p_command_id, p_estate_id, v_receipt);
  return v_receipt;
end;
$$;

revoke execute on function change_membership(uuid, uuid, uuid, text, text, bigint, text) from public;
revoke execute on function change_membership(uuid, uuid, uuid, text, text, bigint, text) from anon, authenticated;
grant execute on function change_membership(uuid, uuid, uuid, text, text, bigint, text) to service_role;

revoke execute on function an_estate_keeps_an_owner() from public;
revoke execute on function an_estate_keeps_an_owner() from anon, authenticated, service_role;
revoke execute on function membership_revision_moves() from public;
revoke execute on function membership_revision_moves() from anon, authenticated, service_role;

comment on function change_membership(uuid, uuid, uuid, text, text, bigint, text) is
  'Grant or revoke one membership. Idempotent by command_id, compare-and-set on the membership revision, and it cannot remove the last owner — that floor is a trigger, so it holds against a direct write too (S09).';
