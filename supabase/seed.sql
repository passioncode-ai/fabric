-- Seed: org #1, owned by the person the app runs as. The estate enters through the journal like
-- everything else, and its owner with it: `estate.created@1` names `owner_person_id`, exactly as the
-- app's own bootstrap writes it (`apps/desktop/src/main/index.ts#bootstrapReady`), and the projector
-- grants that person the estate (migration 58).
--
-- The operator is `LOCAL_OPERATOR_PERSON` (`apps/desktop/src/main/identity.ts`), the row migration 58
-- inserts. Until 0.3.4 this seed made a second person, `…0002`, the owner instead, and a fresh install
-- could not open its own estate (CO-241; `apps/desktop/test/first-install-db.test.mjs` holds it).
--
-- Idempotent: `supabase start` on a new volume and `supabase db reset` run it; guards keep it re-runnable.

do $$
declare
  org1     constant uuid := '00000000-0000-0000-0000-000000000001';
  operator constant uuid := '00000000-0000-0000-0000-00000000000a';
begin
  if not exists (select 1 from persons where id = operator) then
    insert into persons (id, display_name, auth_user) values (operator, 'operator', null);
  end if;

  if not exists (select 1 from estates where id = org1) then
    perform append_event(
      org1,
      'estate.created@1',
      jsonb_build_object('kind', 'system', 'id', 'seed'),
      jsonb_build_object('name', 'org #1', 'owner_person_id', operator)
    );
  end if;
end $$;
