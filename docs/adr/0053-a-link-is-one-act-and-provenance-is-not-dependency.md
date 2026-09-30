# ADR-0053 — A link is one act, and provenance is not a dependency

- **Status:** accepted
- **Date:** 2026-09-10
- **Supersedes:** nothing. Refines the write boundary described in [operating-surfaces.md](../architecture/operating-surfaces.md) §4.1.
- **Related:** [ADR-0014](0014-the-event-journal-is-the-spine-and-every-register-is-a-projection.md), [ADR-0049](0049-a-boundary-is-held-by-a-mechanism.md), [ADR-0028](0028-one-effects-algebra-and-the-floor-lives-in-the-schema.md)

## Context

`task.linked@1` orders work: `blocks`, `follows` and `spawned` between two tasks.
The guard against a queue that loops back on itself lived at the write boundary,
in the MCP tool, as three lines.

**Measured 2026-09-09 against the running local stack, at `d28c321`:**

1. **The check was fail-open.** `const { data: closes } = await db.rpc('would_close_cycle', …)`
   drops `error`. A check that cannot run returns `data: null`, `null === true` is
   false, and the append happens. Measured: *"check unavailable → data = null, error
   present = true; the guard `closes === true` evaluates to false → it APPENDS."*
   The guard was present exactly when the database was healthy and gone the moment
   it was not.

2. **The check and the write were separate round trips.** Measured with two clients
   asking together: **both** saw `closes = false`, and both wrote.

3. **And then the journal and the board disagreed.** That race appended **two**
   `task.linked@1` events and left **one** edge on the board, because the projector
   drops a cyclic edge with a `raise warning` rather than aborting a replay. So the
   estate's history recorded something its projection does not contain, and the only
   record of the divergence was a Postgres warning. An event that produces no row is
   invisible to every surface in the product — worse than the loop the check exists
   to prevent, because a loop is at least visible on the board.

4. **Three writers, one of which checked anything.** `apps/desktop/src/main/agentSurface.ts#fabric_task_link`
   checked; `apps/desktop/src/main/agentSurface.ts#fabric_task_create` and `apps/desktop/src/main/index.ts#tasksResearch` appended
   the same event with no scope floor, no topology and no idempotency.

5. **And the vocabulary was conflated.** `would_close_cycle` walked all three rels as
   one graph. Measured: with a parent that blocks its child, recording *"this child
   was spawned by that parent"* reported as a cycle — a true statement about the past,
   refused for the topology of a different graph.

## Decision

**1. A link is one act.** `link_tasks` is the only writer of `task.linked@1`. It takes
`pg_advisory_xact_lock` on the estate — the same lock `append_event` already took —
**before** it asks anything, so scope, project, idempotency, topology and the append
are one indivisible transaction. The lock was always there; the check simply stood
outside it, in the client, one round trip too early.

**2. Uncertainty refuses.** Every outcome is a typed `reason_code`. A command that
cannot run answers `unavailable`, which is a refusal. Nothing is written on the
strength of a question that was not answered.

**3. Provenance is not dependency.** `blocks` and `follows` are **dependency** edges:
claims about what may run next, and only these can form a queue nobody can act on.
`spawned` is a **provenance** edge: a record that this task came out of that one, a
fact about the past. `link_is_dependency(rel)` is the single definition, and the DAG
walk, the trigger and the projector all read it. A provenance edge is never refused
for topology, and never contributes to a dependency cycle.

**4. A refusal does not leak across estates.** A target in another estate answers
`not_found` — the same answer as a target that does not exist — so a refusal cannot be
used to enumerate ids across the boundary one guess at a time.

**5. The scope floor on a write is not looser than on a read.** When the caller names
a project, both tasks must be in it: an agent scoped to one project may order that
project's work and nothing else.

## Consequences

- **Three call sites became one.** The tool, the chain link and the research path all
  call the command. `scripts/check-commands.mjs` refuses a direct append of a commanded
  event type, so the second door is caught at the gate rather than in an audit.
- **The projector still never refuses.** A replay that aborts leaves an estate that
  cannot be rebuilt, which is worse than a dropped edge. What changed is that the arm
  can see the rel, so a provenance edge is written rather than warned away — and a
  cyclic event can no longer be produced through the product at all.
- **The silent drop is now unreachable through the product, not removed.** An event
  written around the command can still produce a warning and no row, and nothing in
  the product surfaces that divergence. Filed as CO-116 rather than fixed here: making
  it visible needs a projection-diagnostics surface that does not exist, and inventing
  one inside a concurrency fix is how an architecture arrives without a decision.
- **`spawned` chains no longer constrain the queue.** A parent may block the child it
  spawned; a child may record the parent that blocks it. Both were refused before.
- **The concurrency claim is proved by construction, not by timing.**
  `packages/schema/test/link-concurrency.test.mjs` opens two connections, holds one
  transaction open and **measures** the second waiting in `pg_locks`. A probe that
  fired two HTTP calls and hoped they overlapped stayed green with the lock removed.
