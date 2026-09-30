-- Migration 6 — close the door that was left open beside the only door.
--
-- `append_event` and `rebuild_estate_projections` were explicitly revoked from
-- PUBLIC when they were written (migration 1). `apply_projections` never was,
-- and it is SECURITY DEFINER — so PostgREST exposed it as an RPC that any holder
-- of the anon key could call with a hand-built journal row, writing a projection
-- with no event, no seq and no actor behind it.
--
-- Measured against the live local stack on 2026-08-31 before this migration:
--   POST /rest/v1/journal            → 401
--   POST /rest/v1/rpc/append_event   → 401
--   POST /rest/v1/rpc/apply_projections → 204, and memory_facts gained a row
--   while journal gained nothing.
--
-- Revoking is safe: append_event is itself SECURITY DEFINER owned by postgres,
-- so its internal call runs as the definer and needs no grant on the caller.

revoke execute on function apply_projections(journal) from public;
revoke execute on function apply_projections(journal) from anon, authenticated, service_role;

-- Also tighten what the table grants gave away by accident: anon was left with
-- TRUNCATE/REFERENCES/TRIGGER/MAINTAIN on every projection and on the journal,
-- which migration 1 never intended and no code path needs.
revoke all on persons, estates, memberships, projects, goals, agent_bindings,
              grants, effect_intents, journal, memory_facts, project_repos,
              project_tasks, agent_stages
  from anon;
