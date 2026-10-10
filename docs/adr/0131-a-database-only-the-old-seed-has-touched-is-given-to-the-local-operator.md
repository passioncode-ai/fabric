# ADR-0131 — A database only the old seed has touched is given to the local operator

**Status:** accepted · 2026-10-10 · operator decisions of the same day: the fix ships now as 0.3.4, with universal
macOS (which reached `main` first, fabric#27), and the Windows/Linux port is 0.3.5 · CO-241 · found by the 0.3.3
release close (CO-228).

## Context

Every fresh install of Fabric 0.3.0–0.3.3 stopped before its first window with "identity could not be
established: that person is not a member of this estate". Measured 2026-10-10 on a disposable stack built the
way a new install builds one (`scripts/test-stack.mjs up`: migrations 79, then the seed): `resolve_subject` for
the default estate and `LOCAL_OPERATOR_PERSON` answered `not_a_member`.

The cause is two identities written in two places. `supabase/seed.sql` (unchanged since the first history) made
the default estate `org #1` and a person `…0002` its owner. Migration 58 (subject resolution, 2026-09-10) made
the app run as `…000a`, and granted that person every estate that existed **when it ran**. On every database
that predated it, that included `org #1`; on a new volume there is no estate when migrations run, the seed comes
after them, and the app's person is a member of nothing. The bootstrap's own founding path (`estate.created@1`
with `owner_person_id`) covers a missing estate, not one the seed already made. The identity probe creates its
estates through that path, so no tier ever opened the estate a fresh install opens.

A fixed seed does not reach a database it has already seeded: a seed runs once. The databases those installs
made — and the operator's own, reset on 2026-10-08 for a fresh onboarding — keep the old shape.

<a id="decision"></a>
## Decision

1. **The seed names the app's person as owner, the way the bootstrap does.** `seed.sql` journals
   `estate.created@1` with `owner_person_id: LOCAL_OPERATOR_PERSON`; the projector grants it (migration 58). The
   seed makes no other person. `apps/desktop/test/first-install-db.test.mjs` (`fresh`) holds the seed to the two
   constants the app runs with, read from the app's own modules.
2. **At start, a database only the old seed has touched is granted to the local operator** (`main/seedRepair.ts`),
   when the identity read answers `not_a_member` and the estate is the default one. All of these must hold, read
   from the database: the estate's journal is exactly one event, `estate.created@1` by the actor `system/seed`;
   that event named no owner; the operator is not a member; every member is the old seed's person `…0002`. Then,
   and only then, the operator is granted `owner` through the membership door (`change_membership`, compare-and-set
   at revision 0, `changed_by` `desktop-bootstrap:seed-repair`), and identity is read again. The outcome is
   recorded (`identity.seed-repair`), granted or not and why.
3. **Anything else is left as it is, and startup still refuses with the boundary's own sentence.** An estate with any
   event after its creation, a creation that named an owner, another member, a chosen or restored estate, or a read
   that failed — each is somebody's decision or an unknown, and the boundary does not invent an owner for it.
4. **No migration.** The schema stays 79, so a 0.3.3 database needs no upgrade procedure (`release-mac.md`).

<a id="boundary"></a>
## Why this does not loosen the identity boundary

The boundary exists so that a writer the estate never admitted cannot act in it (FA-07). The estate this grants
has nothing in it: one creation event, no project, no task, no conversation, no memory. Whoever is given it gains
an empty estate on their own Mac, the one the app would have founded for them had the seed not done it first. The
grant goes through the same door every membership change uses, so a membership that moved between the reading
and the grant is not overwritten (`first-install-db.test.mjs` `legacy`: a late grant answers `conflict`).

## Consequences

- A repaired database keeps the old seed's `…0002` membership: an owner nobody runs as. Removing it is a
  membership revoke, the operator's to decide (CO-241).
- `scripts/fixtures/walk-estate.sql` journals as the app's person, and `scripts/residue-report.mjs` keeps both
  seed persons.
- The fast tier runs `run-first-install-db.mjs` (two owned clusters: the seed, and the database a 0.3.3 install
  made) and `seed-repair.test.mjs`.

## Evidence

- Code: `supabase/seed.sql`, `apps/desktop/src/main/seedRepair.ts#repairSeedOnlyEstate`,
  `apps/desktop/src/main/seedRepair.ts#seedOnlyProblem`, `apps/desktop/src/main/index.ts#bootstrapReady`.
- Tests: `apps/desktop/test/first-install-db.test.mjs` (watched: with the 0.3.3 seed,
  `test/fixtures/legacy-seed-0.3.3.sql`, three of its four `fresh` cases fail), `apps/desktop/test/seed-repair.test.mjs`
  (watched: removing the history check, the other-member check or the receipt check each fails it).
