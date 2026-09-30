-- TRUNCATE is a privilege of its own, and revoking UPDATE and DELETE never
-- touched it (IMP-08, audit 2026-09-05).
--
-- Measured before this migration: TWENTY tables in `public` where anon,
-- authenticated or service_role could TRUNCATE — the journal among them. The
-- journal is the spine (ADR-0014): every projection is derived from it and
-- `rebuild_estate_projections` replays it, so a role that can empty it can
-- erase the estate's entire history in one statement and leave the projections
-- to be rebuilt from nothing.
--
-- IT ALSO FALSIFIED A CLAIM THIS RUN MADE. `task_notes` shipped in migration 16
-- with `revoke update, delete` and a comment calling it "append-only by
-- construction". It was not: anon and authenticated held TRUNCATE on it, by
-- default, because a newly created table inherits the default privileges of the
-- role that made it. Append-only means no UPDATE, no DELETE and NO TRUNCATE, or
-- it means nothing.
--
-- Nothing in this repository truncates. The probes delete by key, the rebuild
-- replays rather than clearing, and the projector upserts.

do $$
declare t record;
begin
  for t in
    select c.oid::regclass as name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('revoke truncate on %s from anon, authenticated, service_role', t.name);
  end loop;
end $$;

-- The durable half: a table created after this migration would otherwise
-- inherit TRUNCATE again, and the next append-only table would ship with the
-- same false comment. Default privileges are set for the role that creates
-- tables here.
alter default privileges in schema public revoke truncate on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke truncate on tables from anon, authenticated, service_role;

-- `anon` has no business with the operating-surface tables at all. RLS already
-- refuses it; the grants should say the same thing, because a grant nobody
-- intended is what an audit finds and nobody can explain.
revoke all on task_notes, task_links, leases from anon;
