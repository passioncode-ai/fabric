-- The seed as 0.3.0–0.3.3 shipped it (supabase/seed.sql at 9d0d9ec9), kept to make the database those installs made.
-- first-install-db.test.mjs builds that database from it; never applied anywhere else.
-- Seed: org #1 and the operator. Identity-plane rows are seeded (they are not
-- estate events); the estate itself enters through the journal like everything else.
-- Idempotent: `supabase db reset` may run this against an empty schema any number
-- of times conceptually — guards keep it re-runnable.

do $$
declare
  org1     constant uuid := '00000000-0000-0000-0000-000000000001';
  operator constant uuid := '00000000-0000-0000-0000-000000000002';
begin
  if not exists (select 1 from persons where id = operator) then
    insert into persons (id, display_name, auth_user) values (operator, 'Operator', null);
  end if;

  if not exists (select 1 from estates where id = org1) then
    perform append_event(
      org1,
      'estate.created@1',
      jsonb_build_object('kind', 'system', 'id', 'seed'),
      jsonb_build_object('name', 'org #1')
    );
  end if;

  if not exists (select 1 from memberships where person_id = operator and estate_id = org1) then
    insert into memberships (person_id, estate_id, role) values (operator, org1, 'owner');
  end if;
end $$;
