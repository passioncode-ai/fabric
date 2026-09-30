-- The estate says which schema it is at, so a build can refuse honestly (S07).
--
-- MEASURED BEFORE THIS EXISTED: nothing could ask. The application had no way
-- to know whether the database in front of it was older than the code, newer
-- than the code, or exactly right — so every start assumed "right", which is
-- the assumption that turns an upgrade into data loss.
--
-- COUNTED FROM WHAT WAS APPLIED, not from what this build ships. A number read
-- out of the local migrations directory is a fact about the ARTIFACT; the whole
-- question is whether the artifact and the estate agree, and answering it with
-- the artifact's own number makes them agree by construction.
--
-- `security definer` because `supabase_migrations` is not a schema an ordinary
-- role may read, and handing out that read to answer one integer would be a
-- much larger grant than the question needs.

create or replace function schema_version()
returns integer
language sql
security definer set search_path = public, supabase_migrations
as $$
  select count(*)::integer from supabase_migrations.schema_migrations;
$$;

revoke execute on function schema_version() from public;
revoke execute on function schema_version() from anon;
grant execute on function schema_version() to authenticated, service_role;

comment on function schema_version() is
  'How many migrations this estate has applied. The application compares it with the window its build manifest declares; outside that window the build goes read-only or refuses, and it never migrates on its own (S07).';
