-- `anon` cannot read this schema, and now that is stated rather than inherited (S02.acl).
--
-- WHAT WAS MEASURED, and it is a smaller story than "a bootstrap default differs".
-- Every table created before migration 26 carries an explicit
-- `revoke all … from anon` in its OWN migration — 6, 7, 8, 11, 13, 17 each do it.
-- Six tables do not: `proposals`, `routines`, `task_handoffs`, `questions`,
-- `question_blocks`, `estate_settings`. Those six are exactly the six the remote
-- `full` tier reports `anon` can SELECT (run 34070268253, log lines 2107–2108).
--
-- So the property has been held by a per-table statement for most of the schema
-- and by an INHERITED DEFAULT for the rest — and an inherited default is a
-- property of the environment. Both entries exist here and they disagree in
-- exactly one bit:
--
--   pg_default_acl, schema public, tables
--     grantor supabase_admin -> anon=arwdDxtm   (SELECT included)
--     grantor postgres       -> anon=xtm        (no SELECT)
--
-- Postgres applies the entry belonging to the role that creates the object, so
-- the same migrations produce different grants depending on who runs them. This
-- migration does NOT assert which role the remote used; that would be a guess
-- dressed as a cause, and the fix must not depend on the answer.
--
-- TWO THINGS ARE NOT AVAILABLE HERE, both measured rather than assumed:
--   `alter default privileges for role supabase_admin …` -> permission denied
--   `set role supabase_admin`                            -> permission denied
-- The migration role cannot make the inherited default uniform. So it stops
-- inheriting.

-- ————————————————————————————————————————————————— 1 · what exists, stated
--
-- Set-based rather than six names: naming them is how six became six in the
-- first place. `authenticated` keeps SELECT — RLS is what filters it — and
-- `service_role` keeps the rights the app connects with.

do $$
declare t record;
begin
  for t in
    select format('%I.%I', schemaname, tablename) as name
      from pg_tables where schemaname = 'public'
     order by tablename
  loop
    execute format('revoke all on %s from anon', t.name);
    execute format('revoke all on %s from public', t.name);
  end loop;
end $$;

-- ————————————————————————————————————————————————— 2 · and what comes next
--
-- The loop above fixes today's tables. Migration 33 will create another one, and
-- "remember to revoke" is the discipline that already failed six times — the same
-- shape as the estate predicate in S02.store, where the safe form was the longer
-- one. So the revoke stops being a thing to remember.
--
-- IT KILLS INHERITANCE, NOT INTENT. The trigger fires at `ddl_command_end`, so a
-- later `grant select on t to anon` in the same migration still wins: what
-- disappears is the grant nobody wrote, which is the only kind this schema has
-- ever had by accident.
--
-- The function is deliberately NOT security definer: it runs as whoever ran the
-- DDL, who owns the new table and can therefore revoke on it. That is what makes
-- it work regardless of which role the environment creates tables as — the
-- question this migration refuses to answer.

create or replace function deny_anon_on_new_tables()
returns event_trigger
language plpgsql
as $$
declare o record;
begin
  for o in
    select object_identity
      from pg_event_trigger_ddl_commands()
     where command_tag = 'CREATE TABLE' and schema_name = 'public'
  loop
    execute format('revoke all on %s from anon', o.object_identity);
    execute format('revoke all on %s from public', o.object_identity);
  end loop;
end $$;

drop event trigger if exists deny_anon_on_new_tables;
create event trigger deny_anon_on_new_tables
  on ddl_command_end when tag in ('CREATE TABLE')
  execute function deny_anon_on_new_tables();

-- A failed revoke aborts the CREATE TABLE that caused it. That is deliberate: a
-- table this cannot secure is a table the schema should not gain quietly.
