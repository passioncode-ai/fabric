# ADR-0084 — A release is a record with its basis, rolled back by another record

**Status:** accepted architecture; implemented in migration
[`20260929000069_releases.sql`](../../supabase/migrations/20260929000069_releases.sql) and the
Releases screen (L8 of the [launch UI plan](../evidence/plans/2026-09-29-launch-ui-plan.md)).
**Date:** 2026-09-29. **Decided by:** the operator's instruction to build the app to the launch
design (`docs/reports/product.html`, `launch-releases`), which draws releases "with their basis";
this record states the model the design needs, since the product held none.
**Extends:** nothing; changes no meaning of Project, Task, decision or delivery.

## Context

`delivery.*` is an instruction reaching an agent, not a version put somewhere to be used. The
launch design's Releases screen shows, per project: a named version, where it applies, what went
into it, why, the verification that confirms it and what comes next — and a rollback that keeps the
release it replaced. None of that was recorded.

## Decision

1. **A release is a record of a project**: a name (the version as people say it), an environment
   (where it applies), a summary, the tasks that went in and the decisions that justify it. It is
   written by one command, `record_release`, as `release.recorded@1`, by a person.
2. **Verification is a second, separate record**: `verify_release` writes `release.verified@1` with
   an outcome (`accepted` or `failed`) and a receipt — what was checked, in which environment. A
   release with no verification is a **candidate**; the plan is never the result.
3. **A rollback is a new release** that names the one it rolls back (`rolls_back`). The earlier
   record is never edited; its state reads *rolled back* because a later record says so.
4. Each command is idempotent on its command id and the only writer of its event type
   (`check-commands.mjs`). Free text passes the same preparation as every other command
   (bounded, scrubbed).
5. A release's tasks and decisions are **references**, checked to belong to the same estate and
   project; the release does not copy their text.

## Consequences

- The Releases screen reads records the journal holds; with none, it says there are none.
- A release is a claim about a version and an environment, not about code quality; the receipt is
  what backs it, and a release without one is labelled a candidate everywhere.
- Deployment, signing and publishing stay outside Fabric; a release records that they happened and
  what confirms it.
