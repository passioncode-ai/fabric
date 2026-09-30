-- A reservation is released only with proof it was never dispatched (S03).
--
-- MEASURED: there was no release at all. A reservation taken and then abandoned
-- stayed `reserved` forever, and `one_live_reservation_per_grant` means the
-- grant behind it could never be used again — so an act the operator authorised
-- and the agent then decided not to perform BURNED the permission silently. The
-- operator would have to issue another, with no way to see why the first was
-- unusable.
--
-- AND THE ABSENCE OF A RECEIPT IS NOT PROOF. This is the whole rule. A
-- reservation with no dispatch attempt recorded may mean nothing was started —
-- or it may mean the process died between the external call and the record of
-- it, which is precisely the case `outcome_unknown` exists for (ADR-0050).
-- Releasing on "we see no attempt" would hand back a permission for something
-- that may already have happened, and one-shot authority would authorise a
-- second act.
--
-- So release requires the intent to be in a state that PROVES no dispatch:
-- `reserved` and nothing else. Anything that reached `dispatching` — or that
-- has any attempt row at all — is unreleasable, and stays that way until
-- reconciliation produces evidence.

create or replace function release_grant_reservation(
  p_estate_id      uuid,
  p_reservation_id uuid,
  p_actor          jsonb,
  p_proof_ref      text
)
returns journal
language plpgsql
security definer set search_path = public
as $$
declare
  r       grant_reservations;
  receipt journal;
begin
  if p_proof_ref is null or length(trim(p_proof_ref)) = 0 then
    raise exception 'a release needs a reference to what proves nothing was dispatched'
      using errcode = 'invalid_parameter_value';
  end if;

  select * into r from grant_reservations
   where estate_id = p_estate_id and reservation_id = p_reservation_id
   for update;
  if not found then
    raise exception 'no such reservation in this estate' using errcode = 'no_data_found';
  end if;

  if r.state = 'released' then
    -- Idempotent: a retry after a lost response is not a second release.
    select * into receipt from journal
     where estate_id = p_estate_id and type = 'grant.reservation_released@1'
       and payload->>'reservation_id' = p_reservation_id::text
     limit 1;
    return receipt;
  end if;

  if r.state <> 'reserved' then
    raise exception 'a % reservation cannot be released: the grant behind it is already spent or gone', r.state
      using errcode = 'check_violation';
  end if;

  -- THE PROOF. Any attempt row means something may have reached the outside
  -- world, and no record of a result is not evidence that there was none.
  if exists (
    select 1 from effect_attempts a
     join effect_intents i on i.estate_id = a.estate_id and i.command_id = a.command_id
    where a.estate_id = p_estate_id and i.reservation_id = p_reservation_id
  ) then
    raise exception 'this reservation has a dispatch attempt recorded, so it cannot be proven undispatched. Reconcile the effect first; an absent receipt is not proof that nothing happened.'
      using errcode = 'check_violation';
  end if;

  update grant_reservations
     set state = 'released', released_at = now(), release_proof_ref = p_proof_ref
   where estate_id = p_estate_id and reservation_id = p_reservation_id;

  -- The grant returns to usable ONLY if it is still live on its own terms. A
  -- revoked or expired grant stays unusable; releasing its reservation must not
  -- resurrect it.
  select * into receipt from append_event(
    p_estate_id, 'grant.reservation_released@1', p_actor,
    jsonb_build_object(
      'reservation_id', p_reservation_id,
      'grant_id', r.grant_id,
      'command_id', r.command_id,
      'proof_ref', p_proof_ref
    ),
    '1', r.project_id
  );
  return receipt;
end;
$$;

insert into event_types (type, projects, note) values
  ('grant.reservation_released@1', true,
   'a reservation was released with proof nothing was dispatched; the grant behind it is usable again if it is still live')
on conflict (type) do nothing;

revoke execute on function release_grant_reservation(uuid, uuid, jsonb, text) from public;
revoke execute on function release_grant_reservation(uuid, uuid, jsonb, text) from anon;
grant execute on function release_grant_reservation(uuid, uuid, jsonb, text) to service_role;
