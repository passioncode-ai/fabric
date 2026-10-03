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

1. **The door refuses.** `append_event` calls `refuse_foreign_identity` after the estate lock, and the
   check first takes an advisory lock on each id it reads, so two estates creating one id are serialised
   (migration 73; lock order estate, then id): an event whose project, or whose created entity id, already
   belongs to another estate raises `check_violation` and nothing is journalled. This covers every create
   keyed on a global id (migration 70: projects, repositories, memory facts, tasks, stages, transcripts,
   context packs; migration 72: hand-offs, heartbeats and the eleven `do nothing` creates) and, since
   migration 73, every event whose payload names a `session_id` another estate holds in any of the six
   session tables (`task_runs`, `project_tasks`, heartbeats, stages, transcripts, context packs). A
   refused append aborts the whole declared import.
2. **The projector skips.** Every upsert keyed on a global id carries
   `where <table>.estate_id = excluded.estate_id`, and no upsert writes `estate_id`, so a journal
   written before these migrations replays without moving a row between estates — a projection may not
   refuse what the journal already holds (migration 50).
3. **One agent per name** in a project is decided under the estate lock in `append_event`
   (`refuse_taken_agent_name`, migration 72), not by a read before the append; names compare casefolded
   under `pg_c_utf8`, the same fold as `agentSpec.ts#nameKey` (migration 73), and the desktop handler maps
   the refusal to the code `agent-name-refused:taken`. A unique index was rejected: a database already
   holding two agents of one name would fail the migration, and its journal could never be replayed. A
   declared import is exempt through a transaction-local authorisation (`declared_import_authorizations`),
   so a workspace that legally held such a pair before this rule still imports whole.
4. **Tests own the rule.** `apps/desktop/test/estate-identity-db.test.mjs` runs each case on an owned
   cluster, including two concurrent sessions creating one id, and was watched failing with migrations 70,
   72 and 73 left out (`FABRIC_SKIP_MIGRATION`). Heartbeat rows the pre-70 projector moved between estates
   are repaired once by `repair_foreign_heartbeats()` (migration 73).

## Consequences

- An estate's journal can no longer carry facts about another estate's rows; cross-estate work must
  mint new ids.
- Every new event type that creates a row keyed on a global id must be added to
  `refuse_foreign_identity` in the same migration that registers it; an event that names a `session_id`
  is covered automatically.
- Each create takes one advisory lock per distinct id for its transaction, so a single import of many
  thousands of ids weighs on the lock table (migration 73's header).
- Migration 70's header overstated its coverage; migration 72's header records the correction, since
  executed migrations are not edited.
