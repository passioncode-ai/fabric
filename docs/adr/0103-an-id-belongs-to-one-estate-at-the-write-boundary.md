# ADR-0103 — An id belongs to one estate at the write boundary

**Status:** accepted.
**Date:** 2026-10-03. **Decided by:** the release review of run `2026-10-03-onboarding-and-plan`
(verification iterations 1 and 2, [ledger](../evidence/plans/2026-10-03-verification.md)), which
measured events of one estate rewriting another estate's rows. **Extends**
[ADR-0014](0014-the-event-journal-is-the-spine-and-every-register-is-a-projection.md) (the journal is the spine) and the write boundary of
migration 7; supersedes nothing.

## Context

Entity ids in Fabric are global uuids, but every projection row belongs to one estate. Until
migration 70 the projector's upserts keyed on the id alone, so an event appended in estate B that
named estate A's project, memory fact, task, hand-off or session was **accepted** and rewrote A's row
(measured on owned clusters: A's project renamed by B, A's hand-off "WRITTEN BY B" and passed into an
unattended agent's brief by `chainAdvance.ts`, A's heartbeat row moved into B). Creates that ended
`on conflict (id) do nothing` did not overwrite, but journalled in B a fact no projection of B would
ever show. A declared import into an empty estate C reported success while creating nothing.

## Decision

1. **The door refuses.** `append_event` calls `refuse_foreign_identity` before the estate lock: an
   event whose project, or whose created entity id, already belongs to another estate raises
   `check_violation` and nothing is journalled. This covers every create keyed on a global id
   (migration 70: projects, repositories, memory facts, tasks, stages, transcripts, context packs;
   migration 72: hand-offs, heartbeats — including a session another estate's task already holds —
   and the eleven `do nothing` creates). A refused append aborts the whole declared import.
2. **The projector skips.** Every upsert keyed on a global id carries
   `where <table>.estate_id = excluded.estate_id`, and no upsert writes `estate_id`, so a journal
   written before these migrations replays without moving a row between estates — a projection may not
   refuse what the journal already holds (migration 50).
3. **One agent per name** in a project is decided under the estate lock in `append_event`
   (`refuse_taken_agent_name`, migration 72), not by a read before the append; the desktop handler maps
   the refusal to its own sentence. A unique index was rejected: a database already holding two agents
   of one name would fail the migration, and its journal could never be replayed.
4. **Tests own the rule.** `apps/desktop/test/estate-identity-db.test.mjs` runs each case on an owned
   cluster and was watched failing with migrations 70 and 72 left out (`FABRIC_SKIP_MIGRATION`).

## Consequences

- An estate's journal can no longer carry facts about another estate's rows; cross-estate work must
  mint new ids.
- Every new event type that creates a row keyed on a global id must be added to
  `refuse_foreign_identity` in the same migration that registers it.
- Migration 70's header overstated its coverage; migration 72's header records the correction, since
  executed migrations are not edited.
