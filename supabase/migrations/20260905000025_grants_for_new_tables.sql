-- Two tables the app could not read (M13, M68).
--
-- `routines` and `proposals` were created with their indexes, their projector
-- clauses and their event types — and with no GRANTS and no row-level security.
-- Every other table in this schema has both, in the shape migration 4 set:
-- RLS on, a member-scoped read policy for `authenticated`, and full rights for
-- `service_role`, which is the role the desktop app connects as.
--
-- SO BOTH SURFACES WERE DEAD ON ARRIVAL. `routines.list`, `automations.read` and
-- the proposal queue would have answered `permission denied for table routines`
-- the first time the operator opened them. Nothing caught it: the typecheck is
-- happy with a query that fails at runtime, and the supabase client returns
-- `{ data: null, error }` rather than throwing — so the code read `data ?? []`
-- and rendered an empty list. **A missing grant looks exactly like an empty
-- table.**
--
-- Found by a probe asserting a row it had just written was readable back. That
-- is the shape of check that catches this class: not "does the query compile"
-- but "does the answer come back".

alter table routines  enable row level security;
alter table proposals enable row level security;

create policy member_routines_read on routines
  for select to authenticated
  using (estate_id in (select member_estates()));

create policy member_proposals_read on proposals
  for select to authenticated
  using (estate_id in (select member_estates()));

grant select on routines  to authenticated;
grant select on proposals to authenticated;
grant select, insert, update, delete on routines  to service_role;
grant select, insert, update, delete on proposals to service_role;
