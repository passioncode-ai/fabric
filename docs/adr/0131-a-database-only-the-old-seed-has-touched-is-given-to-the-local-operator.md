# ADR-0131 — A database only the old seed has touched is given to the local operator

**Status:** accepted · 2026-10-10 · the repair's rule is this run's design, held by the 0.3.4 verification iterations;
the operator decided the release (2026-10-10: the fix ships now as 0.3.4, with universal macOS, which reached `main`
first, fabric#27; the Windows/Linux port is 0.3.5) · CO-241 · found by the 0.3.3 release close (CO-228).

## Context

Every fresh install of Fabric since 0.2.0 stopped before its first window with "identity could not be established:
that person is not a member of this estate". Measured 2026-10-10 on a disposable stack built the way a new install
builds one (`node scripts/test-stack.mjs up <dir>`: migrations 79, then the seed): `resolve_subject` for the default
estate and `LOCAL_OPERATOR_PERSON` answered `not_a_member`; the 0.3.4 verification, iteration 1, measured the same
for 0.2.0's migrations and seed (DO-1) and for 0.3.0's (UX-2).

The cause is two identities written in two places. `supabase/seed.sql` (unchanged since the first history) made
the default estate `org #1` and a person `…0002` its owner. Migration 58 (subject resolution, 2026-09-10) made
the app run as `…000a`, and granted that person every estate that existed **when it ran**. On every database
that predated it, that included `org #1`; on a new volume there is no estate when migrations run, the seed comes
after them, and the app's person is a member of nothing. The bootstrap's own founding path (`estate.created@1`
with `owner_person_id`) covers a missing estate, not one the seed already made. The identity probe creates its
estates through that path, so no tier ever opened the estate a fresh install opens.

A fixed seed does not reach a database it has already seeded: a seed runs once. The databases those installs
made — and the operator's own, reset on 2026-10-08 for a fresh onboarding — keep the old shape. And 0.3.1–0.3.3
opened the agent hub before identity and kept it open behind the error, so a registered agent's access request
could reach such an estate while the start was failing (iteration 1, DA-1, measured on an owned cluster).

<a id="decision"></a>
## Decision

1. **The seed names the app's person as owner, the way the bootstrap does.** `seed.sql` journals
   `estate.created@1` with `owner_person_id: LOCAL_OPERATOR_PERSON`; the projector grants it (migration 58). The
   seed makes no other person. `apps/desktop/test/first-install-db.test.mjs` (`fresh`) holds the seed to the two
   constants the app runs with, read from the app's own modules.
2. **At start, a database only the old seed has touched is granted to the local operator** (`main/seedRepair.ts`),
   when the estate is the default one, it exists, and the identity read answers `not_a_member`. All of these must
   hold, read from the database: the journal begins with `estate.created@1` by the actor `system/seed`, which named
   no owner; every later event is an `access.requested@1` by the hub's own actor `system/fabric-hub` (a request
   grants nothing; any decision on it is somebody's), within `EVENT_READ_LIMIT` (1000) events in all; the operator is not a
   member; every member is the old seed's person `…0002`; and no membership command is on record for the estate (a
   grant or a revoke through the door is a decision). Then, and only then, the operator is granted `owner` through
   the membership door (`change_membership`, compare-and-set at revision 0, `changed_by`
   `desktop-bootstrap:seed-repair`). The outcome is recorded (`identity.seed-repair`), granted or not and why.
3. **The identity gate runs before the retry point and before the hub opens** — the repair, the second identity read
   and the refusal itself — so no agent's request can land between the reading and the grant, no agent writes into an
   estate Fabric could not open, and a refused start offers Retry. Identity is read again after any repair attempt, so
   a grant someone else made meanwhile is still found.
4. **Anything else is left as it is, and startup still refuses** — with its own cause, `identity-refused`
   (`shared/startupFailure.ts`), for the boundary's own refusal only (a read that failed keeps its own cause), and the
   repair's reason in the details the person can copy. An estate with any
   other event, a creation that named an owner, another member, a decision on record, a chosen or restored estate,
   or a read that failed — each is somebody's decision or an unknown, and the boundary does not invent an owner.
5. **No migration.** The schema stays 79. The repair runs only past the schema check: a database a 0.3.2 or 0.3.3
   install made (79) is repaired on the first start; a 0.3.0 or 0.3.1 one (75, 78), or a 0.2.0 one (69), takes the
   upgrade procedure first (`docs/launch/release-mac.md#upgrading-an-existing-database`), which names the shorter
   way for a database Fabric never opened.

<a id="boundary"></a>
## Why this does not loosen the identity boundary

The boundary exists so that a writer the estate never admitted cannot act in it (FA-07). The estate this grants
has nothing in it: one creation event and at most pending access requests nobody has answered — no project, no task,
no conversation, no memory, no grant. Whoever is given it gains an empty estate on their own Mac, the one the app
would have founded for them had the seed not done it first. The grant goes through the same door every membership
change uses, so a membership that moved between the reading and the grant is not overwritten
(`first-install-db.test.mjs` `legacy`: a late grant answers `conflict`), and a revoke through that door is never
undone (`legacy`: the revoke case).

## Consequences

- A repaired database keeps the old seed's `…0002` membership, an owner nobody runs as, and its tenure counts from
  the failed install's creation event; both are CO-242, decided before any person or member surface ships.
- `scripts/fixtures/walk-estate.sql` journals as the app's person, and `scripts/residue-report.mjs` keeps both
  seed persons.
- The fast tier runs `run-first-install-db.mjs` (two owned clusters: the seed, and the database a 0.3.3 install
  made, with a hub request and a revoke) and `seed-repair.test.mjs` (the rule, the reads and the RPC as they go to
  the stack, and the wiring order in `index.ts`).

## Evidence

- Code: `supabase/seed.sql`, `apps/desktop/src/main/seedRepair.ts#repairSeedOnlyEstate`,
  `apps/desktop/src/main/seedRepair.ts#seedOnlyProblem`, `apps/desktop/src/main/seedRepair.ts#seedRepairDb`,
  `apps/desktop/src/main/index.ts#bootstrapReady` (region `seed-repair-wiring`),
  `apps/desktop/src/shared/startupFailure.ts#classifyStartupFailure`.
- Tests: `apps/desktop/test/first-install-db.test.mjs` (watched: with the 0.3.3 seed,
  `test/fixtures/legacy-seed-0.3.3.sql`, three of its four `fresh` cases fail), `apps/desktop/test/seed-repair.test.mjs`
  (watched: removing the history check, the other-member check, the receipt check or the decisions check, reading two
  events, a null revision, admitting any system event, or moving the repair after the hub each fails it),
  `apps/desktop/src/shared/startupFailure.test.ts` (the `identity-refused` case).
