-- Migration 17 made every table created after it unreadable by the app.
--
-- WHAT HAPPENED, measured rather than reasoned about. `20260905000017` closed a
-- real hole — TRUNCATE on append-only tables — and its durable half was
--
--     alter default privileges in schema public revoke truncate on tables from …
--
-- Revoking from a default that has no explicit entry does not subtract from
-- Supabase's grant-everything default: it CREATES an entry equal to Postgres's
-- built-in default minus the revoked bit, and the built-in default gives other
-- roles nothing. So the generous default was replaced by a mean one, silently,
-- and it applies to every table created afterwards.
--
-- Measured on this database: a table created today inherited
-- `anon=xtm, authenticated=xtm, service_role=xtm` — references, trigger,
-- maintain, and NO select. `goals`, created before 17, has
-- `service_role=arwdxtm`. `routines` and `proposals` were the first two tables
-- after 17 and both shipped dead: PostgREST answered `permission denied`, the
-- supabase client returned `{ data: null, error }` rather than throwing, and the
-- calling code read `data ?? []` and rendered an empty list. **A missing grant
-- looks exactly like an empty table.**
--
-- The fix restates the default EXPLICITLY rather than trying to undo the
-- revoke, and takes the chance to make it tighter than the one it replaces:
-- `anon` gets nothing, which is what the RLS policies already say and what the
-- grants should have said too.

alter default privileges in schema public
  grant select on tables to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges for role postgres in schema public
  grant select on tables to authenticated;
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;

-- And truncate stays revoked, which was migration 17's actual intent.
alter default privileges in schema public
  revoke truncate on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke truncate on tables from anon, authenticated, service_role;
